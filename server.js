const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const app = express();
const server = http.createServer(app);

// Configure CORS for Socket.io to accept connections from anywhere
const io = new Server(server, {
  cors: {
    origin: "*", // Allow all origins
    methods: ["GET", "POST", "DELETE"]
  }
});

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('MongoDB connected'))
.catch(err => console.error('MongoDB connection error:', err));

// Define File Schema
const fileSchema = new mongoose.Schema({
  originalName: String,
  fileName: String,
  mimetype: String,
  size: Number,
  path: String,
  uploadDate: {
    type: Date,
    default: Date.now
  }
});

const File = mongoose.model('File', fileSchema);

// Define Message Schema
const messageSchema = new mongoose.Schema({
  userId: String,
  userName: String,
  message: String,
  sourceLang: String,
  timestamp: {
    type: Date,
    default: Date.now
  },
  files: [{
    fileId: String,
    name: String,
    mimetype: String,
    size: Number,
    url: String
  }],
  isFileShare: {
    type: Boolean,
    default: false
  }
});

const Message = mongoose.model('Message', messageSchema);

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads - store directly in filesystem
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    // Create unique filename by adding timestamp
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});

// File filter to validate types
const fileFilter = (req, file, cb) => {
  // Check for allowed file types
  const allowedMimeTypes = [
    // All image formats
    'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml', 
    'image/bmp', 'image/tiff', 'image/apng', 'image/avif', 'image/heic', 'image/heif',
    
    // Document formats
    'application/msword', 
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
    'application/pdf',
    'text/plain',
    'application/rtf'
  ];

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('File type not allowed'), false);
  }
};

// Configure upload settings with 20MB limit
const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: { 
    fileSize: 20 * 1024 * 1024 // 20MB in bytes
  }
});

// Serve static files including uploads directory
app.use(express.static(path.join(__dirname)));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.json());

// API endpoint to get chat history
app.get('/api/message-history', async (req, res) => {
  try {
    // Get last 50 messages, sorted by timestamp
    const messages = await Message.find()
      .sort({ timestamp: -1 })
      .limit(50)
      .lean();
    
    // Send messages in chronological order (oldest first)
    res.json(messages.reverse());
  } catch (error) {
    console.error('Error fetching message history:', error);
    res.status(500).json({ error: 'Failed to fetch message history' });
  }
});

// Multiple file upload endpoint
app.post('/upload-multiple', upload.array('files', 10), async (req, res) => {
  try {
    console.log('Upload request received');
    
    if (!req.files || req.files.length === 0) {
      console.log('No files in request');
      return res.status(400).json({ error: 'No files uploaded' });
    }
    
    console.log(`Processing ${req.files.length} uploaded files`);
    const filesInfo = [];
    
    // Get base URL for absolute file paths
    const protocol = req.protocol;
    const host = req.get('host');
    const baseUrl = `${protocol}://${host}`;
    
    // Process each file
    for (const file of req.files) {
      try {
        console.log(`Processing file: ${file.originalname}, type: ${file.mimetype}, size: ${file.size}`);
        
        // Save file metadata to MongoDB
        const fileDoc = new File({
          originalName: file.originalname,
          fileName: file.filename,
          mimetype: file.mimetype,
          size: file.size,
          path: file.path
        });
        
        // Save the file document
        const savedFile = await fileDoc.save();
        console.log(`File ${file.originalname} saved to database with ID: ${savedFile._id}`);
        
        // Create file info with absolute URL for client
        filesInfo.push({
          fileId: savedFile._id,
          name: file.originalname,
          mimetype: file.mimetype,
          size: file.size,
          url: `${baseUrl}/uploads/${file.filename}`,
          relativeUrl: `/uploads/${file.filename}`
        });
      } catch (fileError) {
        console.error(`Error processing file ${file.originalname}:`, fileError);
        
        // Try to delete the file if saving to DB failed
        try {
          fs.unlinkSync(file.path);
          console.log(`Deleted failed upload file: ${file.path}`);
        } catch (unlinkError) {
          console.error('Failed to delete file after DB error:', unlinkError);
        }
        
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

// API endpoint to delete a file - Improved with immediate deletion
app.delete('/file/:fileId', async (req, res) => {
  try {
    const fileId = req.params.fileId;
    
    // Find file in database
    const fileDoc = await File.findById(fileId);
    if (!fileDoc) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    // Delete the physical file immediately
    if (fileDoc.path && fs.existsSync(fileDoc.path)) {
      fs.unlinkSync(fileDoc.path);
      console.log(`File deleted from filesystem: ${fileDoc.path}`);
    }
    
    // Delete file from database
    await File.findByIdAndDelete(fileId);
    console.log(`File deleted from database: ${fileId}`);
    
    // Update any messages that reference this file
    const updateResult = await Message.updateMany(
      { 'files.fileId': fileId },
      { $pull: { files: { fileId: fileId } } }
    );
    console.log(`Updated ${updateResult.modifiedCount} messages to remove file reference`);
    
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

// Error handler for file size limit
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ 
        error: 'File size limit exceeded', 
        details: 'Maximum file size is 20MB' 
      });
    }
  }
  next(err);
});

// Serve index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Update the translation endpoint to use DeepL API with improved caching
const translationCache = new Map(); // Cache to store recent translations
const CACHE_EXPIRY = 3600000; // Cache expiration time in ms (1 hour)

app.post('/translate', async (req, res) => {
  try {
    const { text, targetLang } = req.body;
    
    // Create a cache key combining text and target language
    const cacheKey = `${text.substring(0, 100)}_${targetLang}`;
    
    // Check if translation is in cache and not expired
    if (translationCache.has(cacheKey)) {
      const cacheEntry = translationCache.get(cacheKey);
      if (Date.now() - cacheEntry.timestamp < CACHE_EXPIRY) {
        return res.json({ translation: cacheEntry.translation });
      }
    }
    
    // DeepL API integration
    const DEEPL_API_KEY = process.env.DEEPL_API_KEY; // Use API key from environment variables
    const DEEPL_API_URL = 'https://api-free.deepl.com/v2/translate';
    
    // Convert our language codes to DeepL format if needed
    const deepLLangCode = {
      'EN': 'EN-US',
      'ES': 'ES',
      'FR': 'FR',
      'DE': 'DE',
      'IT': 'IT',
      'JA': 'JA',
      'KO': 'KO'
    }[targetLang] || 'EN-US';
    
    const response = await fetch(DEEPL_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `DeepL-Auth-Key ${DEEPL_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text: [text],
        target_lang: deepLLangCode
      })
    });
    
    if (!response.ok) {
      throw new Error(`DeepL API error: ${response.status}`);
    }
    
    const data = await response.json();
    const translation = data.translations[0].text;
    
    // Store in cache
    translationCache.set(cacheKey, {
      translation: translation,
      timestamp: Date.now()
    });
    
    // Clean up old cache entries occasionally
    if (Math.random() < 0.1) { // 10% chance to clean up each request
      const now = Date.now();
      for (const [key, value] of translationCache.entries()) {
        if (now - value.timestamp > CACHE_EXPIRY) {
          translationCache.delete(key);
        }
      }
    }
    
    res.json({ translation });
  } catch (error) {
    console.error('Translation error:', error);
    res.status(500).json({ error: 'Translation failed', details: error.message });
  }
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

// Improved Socket.io connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  
  socket.on('join', async (userData) => {
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
    
    // Send message history to the newly joined user
    try {
      const messages = await Message.find()
        .sort({ timestamp: -1 })
        .limit(50)
        .lean();
      
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
      timestamp: new Date()
    };
    
    try {
      // Create and save the message to MongoDB
      const message = new Message({
        userId: completeData.userId,
        userName: completeData.userName,
        message: completeData.message,
        sourceLang: completeData.sourceLang,
        timestamp: completeData.timestamp
      });
      
      await message.save();
      
      // Add MongoDB _id to the emitted message
      completeData._id = message._id;
    } catch (error) {
      console.error('Error saving message to database:', error);
    }
    
    // Broadcast the message to all clients
    io.emit('chat_message', completeData);
  });
  
  // Enhanced file sharing with absolute URLs
  socket.on('file_shared', async (data) => {
    // Process file information before broadcasting
    if (data.files) {
      // Get the server's base URL for this connection
      const protocol = socket.request.headers['x-forwarded-proto'] || 'http';
      const host = socket.request.headers.host;
      const baseUrl = `${protocol}://${host}`;
      
      data.files.forEach(file => {
        // Ensure every file has an absolute URL
        if (file.relativeUrl) {
          file.url = `${baseUrl}${file.relativeUrl}`;
        } else if (file.url && file.url.startsWith('/')) {
          file.url = `${baseUrl}${file.url}`;
        }
        
        // Keep the original reference too
        if (!file.relativeUrl && file.url) {
          if (file.url.includes(baseUrl)) {
            file.relativeUrl = file.url.replace(baseUrl, '');
          }
        }
      });
    }
    
    try {
      // Create and save the file share message to MongoDB
      const message = new Message({
        userId: data.userId,
        userName: data.userName,
        files: data.files,
        isFileShare: true,
        timestamp: new Date()
      });
      
      await message.save();
      
      // Add MongoDB _id to the emitted message
      data._id = message._id;
      
      console.log(`File share saved and broadcast: ${data.files.length} files from ${data.userName}`);
    } catch (error) {
      console.error('Error saving file share to database:', error);
    }
    
    // Broadcast file metadata to all clients
    io.emit('file_shared', data);
  });
  
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
  
  // Handle connection errors
  socket.on('error', (error) => {
    console.error('Socket error:', error);
  });
});

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
