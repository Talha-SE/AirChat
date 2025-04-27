const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const dotenv = require('dotenv');
const axios = require('axios');

// Import Firebase and Cloudinary configurations
const { admin, db } = require('./firebase-admin');
const { cloudinary, upload } = require('./cloudinary-config');

// Load environment variables
dotenv.config();

const app = express();
const server = http.createServer(app);

// Configure CORS for Socket.io to accept connections from anywhere
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "DELETE"]
  }
});

// Serve static files
app.use(express.static(path.join(__dirname)));
app.use(express.json());

// Translation endpoint
app.post('/translate', async (req, res) => {
  try {
    const { text, targetLang } = req.body;
    
    if (!text || !targetLang) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }
    
    console.log(`Translation request: "${text}" to ${targetLang}`);
    
    // Use DeepL API for translation
    const deepLApiKey = process.env.DEEPL_API_KEY;
    
    if (!deepLApiKey) {
      return res.status(500).json({ error: 'Translation API key not configured' });
    }
    
    // Configure DeepL API request
    const response = await axios({
      method: 'POST',
      url: 'https://api-free.deepl.com/v2/translate',
      headers: {
        'Authorization': `DeepL-Auth-Key ${deepLApiKey}`,
        'Content-Type': 'application/json'
      },
      data: {
        text: [text],
        target_lang: targetLang
      }
    });
    
    if (response.data && response.data.translations && response.data.translations.length > 0) {
      const translation = response.data.translations[0].text;
      console.log(`Translation result: "${translation}"`);
      return res.json({ translation });
    } else {
      throw new Error('Invalid response from translation service');
    }
  } catch (error) {
    console.error('Translation error:', error.message);
    res.status(500).json({ 
      error: 'Translation failed', 
      details: error.message 
    });
  }
});

// API endpoint to get chat history
app.get('/api/message-history', async (req, res) => {
  try {
    // Get last 50 messages from Firestore
    const messagesSnapshot = await db.collection('messages')
      .orderBy('timestamp', 'desc')
      .limit(50)
      .get();
    
    const messages = [];
    messagesSnapshot.forEach(doc => {
      messages.push({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate() || new Date()
      });
    });
    
    // Send messages in chronological order (oldest first)
    res.json(messages.reverse());
  } catch (error) {
    console.error('Error fetching message history:', error);
    res.status(500).json({ error: 'Failed to fetch message history' });
  }
});

// Upload files to Cloudinary
app.post('/upload-multiple', upload.array('files', 10), async (req, res) => {
  try {
    console.log('Upload request received');
    
    if (!req.files || req.files.length === 0) {
      console.log('No files in request');
      return res.status(400).json({ error: 'No files uploaded' });
    }
    
    const userId = req.body.userId || 'anonymous';
    console.log(`Processing ${req.files.length} uploaded files for user ${userId}`);
    
    const filesInfo = [];
    
    // Process each file (already uploaded to Cloudinary by multer middleware)
    for (const file of req.files) {
      try {
        console.log(`Processing file: ${file.originalname}, type: ${file.mimetype}, size: ${file.size}`);
        
        // Generate a unique ID for the file
        const fileId = uuidv4();
        
        // Each file uploaded with Cloudinary multer storage has these properties
        const publicUrl = file.path; // Cloudinary URL
        const secureUrl = file.secure_url || file.path.replace('http://', 'https://');
        const cloudinaryId = file.filename; // Cloudinary public ID
        
        // Save file metadata to Firestore
        const fileRef = await db.collection('files').doc(fileId).set({
          fileId: fileId,
          name: file.originalname,
          mimetype: file.mimetype,
          size: file.size,
          url: secureUrl,
          cloudinaryId: cloudinaryId,
          userId: userId,
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        console.log(`File ${file.originalname} uploaded to Cloudinary: ${secureUrl}`);
        
        // Add file info for response
        filesInfo.push({
          fileId: fileId,
          name: file.originalname,
          mimetype: file.mimetype,
          size: file.size,
          url: secureUrl
        });
      } catch (fileError) {
        console.error(`Error processing file ${file.originalname}:`, fileError);
        
        // Add error info
        filesInfo.push({
          name: file.originalname,
          error: 'Failed to process file',
          details: fileError.message
        });
      }
    }
    
    // Return information about all uploaded files
    const successfulFiles = filesInfo.filter(file => !file.error);
    console.log(`Completed processing ${successfulFiles.length} files successfully`);
    
    res.json({ 
      success: true,
      files: successfulFiles
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'File upload failed', details: error.message });
  }
});

// API endpoint to delete a file
app.delete('/file/:fileId', async (req, res) => {
  try {
    const fileId = req.params.fileId;
    const userId = req.query.userId || req.body.userId;
    
    // Get file reference from Firestore
    const fileDoc = await db.collection('files').doc(fileId).get();
    
    if (!fileDoc.exists) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    const fileData = fileDoc.data();
    
    // Check if user is the owner (optional)
    if (fileData.userId !== userId) {
      return res.status(403).json({ error: 'You do not have permission to delete this file' });
    }
    
    // Delete file from Cloudinary
    try {
      // Extract public ID from Cloudinary URL if not stored directly
      const cloudinaryId = fileData.cloudinaryId || 
          fileData.url.split('/').pop().split('.')[0];
          
      await cloudinary.uploader.destroy(cloudinaryId);
      console.log(`File deleted from Cloudinary: ${cloudinaryId}`);
    } catch (cloudinaryError) {
      console.error('Error deleting from Cloudinary:', cloudinaryError);
      // Continue with Firestore deletion even if Cloudinary deletion fails
    }
    
    // Delete file metadata from Firestore
    await db.collection('files').doc(fileId).delete();
    console.log(`File metadata deleted from Firestore: ${fileId}`);
    
    // Update any messages that reference this file
    const messagesWithFile = await db.collection('messages')
      .where('files', 'array-contains', { fileId: fileId })
      .get();
    
    // Batch update messages to remove the file reference
    if (!messagesWithFile.empty) {
      const batch = db.batch();
      
      messagesWithFile.forEach(doc => {
        const message = doc.data();
        const updatedFiles = message.files.filter(file => file.fileId !== fileId);
        batch.update(doc.ref, { files: updatedFiles });
      });
      
      await batch.commit();
    }
    
    res.json({ 
      success: true, 
      message: 'File deleted successfully',
      fileId: fileId
    });
    
    // Broadcast file deletion to all connected clients
    io.emit('file_deleted', { fileId: fileId });
    
  } catch (error) {
    console.error('File deletion error:', error);
    res.status(500).json({ error: 'File deletion failed', details: error.message });
  }
});

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  
  socket.on('join', async (userData) => {
    // ...existing user join code...
    
    // Generate a unique name if not provided or already taken
    if (!userData.userName || userData.userName.startsWith('User_') || activeUsers.has(userData.userName)) {
      userData.userName = generateUniqueName();
    }
    
    // Store user data with socket ID
    socket.userData = userData;
    activeUsers.set(userData.userId, {
      ...userData,
      socketId: socket.id,
      joinedAt: new Date()
    });
    
    console.log(`${userData.userName} (${userData.userId}) joined the chat`);
    
    // Send the updated username back to the client
    socket.emit('name_assigned', {
      userId: userData.userId,
      userName: userData.userName
    });
    
    // Send the list of active users to the newly joined user
    socket.emit('active_users', Array.from(activeUsers.values()));
    
    // Send message history from Firestore
    try {
      const messagesSnapshot = await db.collection('messages')
        .orderBy('timestamp', 'desc')
        .limit(50)
        .get();
      
      const messages = [];
      messagesSnapshot.forEach(doc => {
        messages.push({
          id: doc.id,
          ...doc.data(),
          timestamp: doc.data().timestamp?.toDate() || new Date()
        });
      });
      
      // Send messages in chronological order
      socket.emit('message_history', messages.reverse());
    } catch (error) {
      console.error('Error fetching message history:', error);
    }
    
    // Notify others that a new user joined
    socket.broadcast.emit('user_joined', {
      userId: userData.userId,
      userName: userData.userName
    });
  });
  
  socket.on('chat_message', async (data) => {
    // Ensure message has the source language
    const completeData = {
      ...data,
      sourceLang: data.sourceLang || 'EN', // Default to English if not specified
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    };
    
    try {
      // Save message to Firestore
      const messageRef = await db.collection('messages').add({
        userId: completeData.userId,
        userName: completeData.userName,
        message: completeData.message,
        sourceLang: completeData.sourceLang,
        timestamp: completeData.timestamp
      });
      
      // Add Firestore ID to the emitted message
      completeData.id = messageRef.id;
      // Convert timestamp for client
      completeData.timestamp = new Date();
    } catch (error) {
      console.error('Error saving message to database:', error);
    }
    
    // Broadcast the message to all clients
    io.emit('chat_message', completeData);
  });
  
  socket.on('file_shared', async (data) => {
    try {
      // Save file share to Firestore
      const messageRef = await db.collection('messages').add({
        userId: data.userId,
        userName: data.userName,
        files: data.files,
        isFileShare: true,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      });
      
      // Add Firestore ID to the emitted message
      data.id = messageRef.id;
      data.timestamp = new Date();
      
      console.log(`File share saved and broadcast: ${data.files?.length || 0} files from ${data.userName}`);
    } catch (error) {
      console.error('Error saving file share to database:', error);
    }
    
    // Broadcast file metadata to all clients
    io.emit('file_shared', data);
  });
  
  // ...existing socket event handlers...

  socket.on('disconnect', () => {
    if (socket.userData) {
      console.log(`${socket.userData.userName} (${socket.userData.userId}) left the chat`);
      
      // Remove user from active users
      activeUsers.delete(socket.userData.userId);
      
      // Notify others that a user left
      socket.broadcast.emit('user_left', {
        userId: socket.userData.userId,
        userName: socket.userData.userName
      });
    }
  });
});

// Track active users
const activeUsers = new Map(); // userId -> userData

// Random name generator - first and last name combinations
const firstNames = ['Amber', 'Blake', 'Casey', 'Dana', 'Ellis', 'Fran', 'Glenn', 'Harper', 'Indigo', 'Jordan', 'Kelly', 'Logan', 'Morgan', 'Noel', 'Parker', 'Quinn', 'Riley', 'Sage', 'Taylor', 'Val'];
const lastNames = ['Sky', 'River', 'Stone', 'Wood', 'Moon', 'Star', 'Cloud', 'Ocean', 'Mountain', 'Meadow', 'Forest', 'Field', 'Valley', 'Garden', 'Lake', 'Dawn', 'Dusk', 'Storm', 'Wind', 'Rain'];

function generateUniqueName() {
  const first = firstNames[Math.floor(Math.random() * firstNames.length)];
  const last = lastNames[Math.floor(Math.random() * lastNames.length)];
  return `${first} ${last}`;
}

// Serve index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
