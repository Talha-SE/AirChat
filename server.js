const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const dotenv = require('dotenv');
const axios = require('axios');
const fs = require('fs');

// Load environment variables first
dotenv.config();

// Add error handling for serverless environment
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

// Import Firebase and Cloudinary configurations with error handling
let admin, db, cloudinary, upload;

try {
  const firebaseModule = require('./firebase-admin');
  admin = firebaseModule.admin;
  db = firebaseModule.db;
  console.log('Firebase Admin loaded successfully');
} catch (firebaseError) {
  console.error('Failed to load Firebase Admin:', firebaseError.message);
  // Create mock objects to prevent crashes
  admin = { firestore: { FieldValue: { serverTimestamp: () => new Date() } } };
  db = null;
}

try {
  const cloudinaryModule = require('./cloudinary-config');
  cloudinary = cloudinaryModule.cloudinary;
  upload = cloudinaryModule.upload;
  console.log('Cloudinary config loaded successfully');
} catch (cloudinaryError) {
  console.error('Failed to load Cloudinary config:', cloudinaryError.message);
  // Create mock upload middleware
  upload = { array: () => (req, res, next) => next() };
}

// Message expiration time in milliseconds (2 hours)
//const MESSAGE_EXPIRATION_TIME = 3 * 60 * 60 * 1000; // 3 hours in milliseconds
const MESSAGE_EXPIRATION_TIME = 60 * 1000;
// Initialize message deletion worker
function initializeMessageExpirationSystem() {
  console.log('Initializing message expiration system...');
  
  // Run initially after server start
  setTimeout(() => {
    deleteExpiredMessages();
  }, 30000); // Wait 30 seconds after startup before first check
  
  // Then schedule to run every 10 minutes
  setInterval(() => {
    deleteExpiredMessages();
  }, 10 * 60 * 1000); // Check every 10 minutes
}

// Function to delete messages older than 2 hours
async function deleteExpiredMessages() {
  try {
    console.log('Checking for expired messages...');
    
    // Calculate the cutoff time (2 hours ago)
    const cutoffTime = new Date(Date.now() - MESSAGE_EXPIRATION_TIME);
    
    // Query for messages older than the cutoff time
    const expiredMessagesSnapshot = await db.collection('messages')
      .where('timestamp', '<', admin.firestore.Timestamp.fromDate(cutoffTime))
      .limit(100) // Process in batches to avoid overwhelming the database
      .get();
    
    if (expiredMessagesSnapshot.empty) {
      console.log('No expired messages found');
      return;
    }
    
    console.log(`Found ${expiredMessagesSnapshot.size} expired messages to delete`);
    
    // Create a batch for efficient deletion
    const batch = db.batch();
    const deletedMessageIds = [];
    
    // Add each message to the batch delete operation
    expiredMessagesSnapshot.forEach(doc => {
      const messageData = doc.data();
      const messageId = doc.id;
      
      // Add to batch deletion
      batch.delete(doc.ref);
      deletedMessageIds.push(messageId);
      
      // If message has files, move them to orphanedFiles collection
      if (messageData.files && messageData.files.length > 0) {
        messageData.files.forEach(file => {
          if (file.fileId) {
            // Don't delete files, just track that their parent message was auto-expired
            const orphanedFileRef = db.collection('orphanedFiles').doc(file.fileId);
            batch.set(orphanedFileRef, {
              ...file,
              originalMessageId: messageId,
              autoDeletedAt: admin.firestore.FieldValue.serverTimestamp(),
              userId: messageData.userId,
              expirationReason: 'auto-deleted after 2 hours'
            }, { merge: true });
          }
        });
      }
    });
    
    // Commit the batch operation
    await batch.commit();
    console.log(`Successfully deleted ${deletedMessageIds.length} expired messages`);
    
    // Notify all connected clients about the deleted messages
    if (io && deletedMessageIds.length > 0) {
      io.emit('messages_expired', { messageIds: deletedMessageIds });
    }
    
  } catch (error) {
    console.error('Error deleting expired messages:', error);
  }
}

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
    const { text, targetLang, toneUnderstanding } = req.body;
    
    // Enhanced validation
    if (!text || !targetLang) {
      console.error('Translation request missing parameters:', { text: !!text, targetLang: !!targetLang });
      return res.status(400).json({ error: 'Missing required parameters' });
    }
    
    // Normalize language code to uppercase for consistency
    const normalizedTargetLang = targetLang.toUpperCase();
    
    console.log(`Translation request: "${text}" to ${normalizedTargetLang}, tone understanding: ${toneUnderstanding ? 'enabled' : 'disabled'}`);
    
    // Initialize translation variables
    let translation = null;
    let translationSource = '';
    let detectedTone = null;
    
    // Get API keys
    const huggingfaceApiKey = process.env.HUGGINGFACE_API_KEY;
    const geminiApiKey = process.env.GEMINI_API_KEY;
    const deepLApiKey = process.env.DEEPL_API_KEY;
    
    // Get language name from code for better prompting
    const languageNames = {
      'EN': 'English',
      'ES': 'Spanish',
      'FR': 'French',
      'DE': 'German',
      'IT': 'Italian',
      'JA': 'Japanese',
      'KO': 'Korean',
      'ZH': 'Chinese',
      'RU': 'Russian',
      'PT': 'Portuguese',
      'NL': 'Dutch',
      'PL': 'Polish',
      'AR': 'Arabic',
      'TR': 'Turkish',
      'SV': 'Swedish',
      'HE': 'Hebrew',
      'DA': 'Danish',
      'FI': 'Finnish',
      'CS': 'Czech',
      'HU': 'Hungarian',
      'UK': 'Ukrainian',
      'HI': 'Hindi',
      'TH': 'Thai',
      'VI': 'Vietnamese',
      'ID': 'Indonesian',
      // Additional languages
      'RO': 'Romanian',
      'EL': 'Greek',
      'BG': 'Bulgarian',
      'HR': 'Croatian',
      'SK': 'Slovak',
      'LT': 'Lithuanian',
      'LV': 'Latvian',
      'ET': 'Estonian',
      'SL': 'Slovenian',
      'MS': 'Malay',
      'NO': 'Norwegian',
      'FA': 'Persian',
      'BN': 'Bengali',
      'TA': 'Tamil',
      'UR': 'Urdu',
      'SW': 'Swahili'
    };
    
    // Get the full language name or fall back to the code
    const targetLanguageName = languageNames[normalizedTargetLang] || normalizedTargetLang;
    
    // If tone understanding is enabled, first analyze the tone with DeepSeek
    if (toneUnderstanding && huggingfaceApiKey) {
      try {
        console.log('Analyzing message tone with DeepSeek AI...');
        
        // Prepare tone analysis prompt
        const tonePrompt = `Analyze the tone of the following message and reply with only one word that best describes the tone (e.g., formal, informal, friendly, serious, angry, happy, sad, urgent, etc.): "${text}"`;
        
        // Send request to DeepSeek for tone analysis
        const toneResponse = await axios({
          method: 'POST',
          url: 'https://router.huggingface.co/hyperbolic/v1/chat/completions',
          headers: {
            'Authorization': `Bearer ${huggingfaceApiKey}`,
            'Content-Type': 'application/json'
          },
          data: {
            messages: [
              {
                role: "user",
                content: tonePrompt
              }
            ],
            model: "deepseek-ai/DeepSeek-V3-0324",
            stream: false
          }
        });
        
        if (toneResponse.data && 
            toneResponse.data.choices && 
            toneResponse.data.choices[0] && 
            toneResponse.data.choices[0].message && 
            toneResponse.data.choices[0].message.content) {
          
          detectedTone = toneResponse.data.choices[0].message.content.trim();
          // Clean up response to get just the tone word
          detectedTone = detectedTone.replace(/^the tone is |tone:|the message sounds |the message is |^tone is /i, '');
          detectedTone = detectedTone.split(' ')[0]; // Take just the first word
          detectedTone = detectedTone.replace(/[^a-zA-Z]/g, ''); // Remove any non-letter characters
          
          console.log(`Detected tone: ${detectedTone}`);
        }
      } catch (toneError) {
        console.error('Error analyzing message tone:', toneError.message);
        // Continue with translation even if tone analysis fails
      }
    }
    
    // Try DeepSeek via Hugging Face first if available
    if (huggingfaceApiKey) {
      try {
        console.log(`Attempting translation with DeepSeek AI via Hugging Face to ${targetLanguageName}...`);
        
        // Prepare DeepSeek prompt with tone information if available
        let deepSeekPrompt;
        
        if (toneUnderstanding && detectedTone) {
          deepSeekPrompt = `Translate the following ${detectedTone} message to ${targetLanguageName} language, preserving the ${detectedTone} tone. Return ONLY the translated text with no additional explanations or notes: "${text}"`;
        } else {
          deepSeekPrompt = `Translate the following text to ${targetLanguageName} language only. Return ONLY the translated text with no additional explanations or notes: "${text}"`;
        }
        
        // Prepare Hugging Face API request
        const deepSeekResponse = await axios({
          method: 'POST',
          url: 'https://router.huggingface.co/hyperbolic/v1/chat/completions',
          headers: {
            'Authorization': `Bearer ${huggingfaceApiKey}`,
            'Content-Type': 'application/json'
          },
          data: {
            messages: [
              {
                role: "user",
                content: deepSeekPrompt
              }
            ],
            model: "deepseek-ai/DeepSeek-V3-0324",
            stream: false
          }
        });
        
        // Extract translated text from DeepSeek response
        if (deepSeekResponse.data && 
            deepSeekResponse.data.choices && 
            deepSeekResponse.data.choices[0] && 
            deepSeekResponse.data.choices[0].message && 
            deepSeekResponse.data.choices[0].message.content) {
          
          translation = deepSeekResponse.data.choices[0].message.content.trim();
          translationSource = 'DeepSeek';
          
          // Remove any quotation marks that might have been included
          translation = translation.replace(/^["']|["']$/g, '');
          
          // Remove any "Translation:" prefix if present
          translation = translation.replace(/^Translation:\s*/i, '');
          
          console.log(`DeepSeek translation to ${targetLanguageName} successful: "${translation}"`);
        } else {
          throw new Error('Unexpected DeepSeek API response format');
        }
      } catch (deepSeekError) {
        console.error(`DeepSeek translation to ${targetLanguageName} failed:`, deepSeekError.message);
        console.log('Falling back to Gemini...');
        // Continue to Gemini fallback
      }
    }
    
    // Try Gemini if DeepSeek failed
    if (!translation && geminiApiKey) {
      try {
        console.log(`Attempting translation with Gemini to ${targetLanguageName}...`);
        
        // Prepare Gemini prompt with tone information if available
        let geminiPrompt;
        
        if (toneUnderstanding && detectedTone) {
          geminiPrompt = `Translate the following ${detectedTone} message to ${targetLanguageName} language, preserving the ${detectedTone} tone. Return ONLY the translated text with no additional explanations or notes: "${text}"`;
        } else {
          geminiPrompt = `Translate the following text directly to ${targetLanguageName} language. Return ONLY the translated text with no additional explanations or notes: "${text}"`;
        }
        
        // Prepare Gemini API request
        const geminiResponse = await axios({
          method: 'POST',
          url: `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`,
          headers: {
            'Content-Type': 'application/json'
          },
          data: {
            contents: [
              {
                parts: [
                  {
                    text: geminiPrompt
                  }
                ]
              }
            ]
          }
        });
        
        // Extract translated text from Gemini response
        if (geminiResponse.data && 
            geminiResponse.data.candidates && 
            geminiResponse.data.candidates[0] && 
            geminiResponse.data.candidates[0].content && 
            geminiResponse.data.candidates[0].content.parts && 
            geminiResponse.data.candidates[0].content.parts[0] && 
            geminiResponse.data.candidates[0].content.parts[0].text) {
          
          translation = geminiResponse.data.candidates[0].content.parts[0].text.trim();
          translationSource = 'Gemini';
          
          // Remove any quotation marks that might have been included
          translation = translation.replace(/^["']|["']$/g, '');
          
          console.log(`Gemini translation to ${targetLanguageName} successful: "${translation}"`);
        } else {
          throw new Error('Unexpected Gemini API response format');
        }
      } catch (geminiError) {
        console.error(`Gemini translation to ${targetLanguageName} failed:`, geminiError.message);
        console.log('Falling back to DeepL...');
        // Continue to DeepL fallback
      }
    }
    
    // Fallback to DeepL if both previous methods failed
    // DeepL doesn't support tone understanding, so we use it as a last resort
    if (!translation && deepLApiKey) {
      try {
        console.log('Attempting translation with DeepL...');
        
        // Configure DeepL API request
        const deepLResponse = await axios({
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
        
        if (deepLResponse.data && 
            deepLResponse.data.translations && 
            deepLResponse.data.translations.length > 0) {
          
          translation = deepLResponse.data.translations[0].text;
          translationSource = 'DeepL';
          console.log(`DeepL translation successful: "${translation}"`);
        } else {
          throw new Error('Invalid response from DeepL service');
        }
      } catch (deepLError) {
        console.error('DeepL translation failed:', deepLError.message);
        throw new Error('All translation services failed');
      }
    }
    
    if (!translation) {
      return res.status(500).json({ error: 'Translation failed: No translation service available' });
    }
    
    // Return the successful translation with tone information if available
    return res.json({ 
      translation,
      source: translationSource,
      targetLang: normalizedTargetLang, // Return the target language for verification
      tone: detectedTone // Include detected tone when available
    });
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

// API endpoint to delete a message
app.delete('/api/message/:messageId', async (req, res) => {
  try {
    const messageId = req.params.messageId;
    const userId = req.query.userId || req.body.userId;
    
    // Get the message from Firestore
    const messageDoc = await db.collection('messages').doc(messageId).get();
    
    if (!messageDoc.exists) {
      return res.status(404).json({ error: 'Message not found' });
    }
    
    const messageData = messageDoc.data();
    
    // Check if user is the sender of the message
    if (messageData.userId !== userId) {
      return res.status(403).json({ error: 'You do not have permission to delete this message' });
    }
    
    // Check if message has file attachments
    if (messageData.files && messageData.files.length > 0) {
      console.log(`Message ${messageId} has ${messageData.files.length} file attachments that will be kept in Cloudinary`);
      
      // Optional: You could move file references to a separate collection to keep track of them
      // This prevents files from becoming "orphaned" in Cloudinary
      try {
        const batch = db.batch();
        
        for (const file of messageData.files) {
          if (file.fileId) {
            // Create or update an entry in an "orphanedFiles" collection
            const orphanedFileRef = db.collection('orphanedFiles').doc(file.fileId);
            batch.set(orphanedFileRef, {
              ...file,
              originalMessageId: messageId,
              deletedAt: admin.firestore.FieldValue.serverTimestamp(),
              userId: messageData.userId
            }, { merge: true });
          }
        }
        
        await batch.commit();
        console.log(`Preserved file references for message ${messageId} in orphanedFiles collection`);
      } catch (fileError) {
        console.error('Error preserving file references:', fileError);
        // Continue with message deletion even if preserving files fails
      }
    }
    
    // Delete message from Firestore
    await db.collection('messages').doc(messageId).delete();
    console.log(`Message deleted from Firestore: ${messageId}`);
    
    // Broadcast message deletion to all connected clients
    io.emit('message_deleted', { messageId: messageId });
    
    res.json({ 
      success: true, 
      message: 'Message deleted successfully',
      messageId: messageId
    });
    
  } catch (error) {
    console.error('Message deletion error:', error);
    res.status(500).json({ error: 'Message deletion failed', details: error.message });
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
    
    // Broadcast to all other users that someone joined
    socket.broadcast.emit('user_joined', {
      userId: userData.userId,
      userName: userData.userName
    });
    
    // Send recent message history to the new user
    try {
      const recentMessages = await db.collection('messages')
        .orderBy('timestamp', 'desc')
        .limit(20)
        .get();
      
      const messages = [];
      recentMessages.forEach(doc => {
        messages.push({
          id: doc.id,
          ...doc.data(),
          timestamp: doc.data().timestamp?.toDate() || new Date()
        });
      });
      
      socket.emit('message_history', messages.reverse());
    } catch (error) {
      console.error('Error fetching message history:', error);
    }
  });
  
  // Handle chat messages
  socket.on('chat_message', async (data) => {
    try {
      console.log('Received message from:', data.userName);
      
      // Calculate expiration time (2 hours from now)
      const expiresAt = new Date(Date.now() + MESSAGE_EXPIRATION_TIME);
      
      // Save message to Firestore
      const messageRef = await db.collection('messages').add({
        userId: data.userId,
        userName: data.userName,
        message: data.message,
        sourceLang: data.sourceLang || 'EN',
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
        isFileShare: false
      });
      
      console.log('Message saved to Firestore with ID:', messageRef.id);
      
      // Broadcast to all connected users including sender
      const messageData = {
        id: messageRef.id,
        userId: data.userId,
        userName: data.userName,
        message: data.message,
        sourceLang: data.sourceLang,
        timestamp: new Date(),
        expiresAt: expiresAt,
        tempId: data.tempId
      };
      
      io.emit('chat_message', messageData);
    } catch (error) {
      console.error('Error saving message:', error);
      socket.emit('message_error', { error: 'Failed to save message' });
    }
  });
  
  // Handle file shares
  socket.on('file_shared', async (data) => {
    try {
      console.log('File shared by:', data.userName);
      
      // Calculate expiration time
      const expiresAt = new Date(Date.now() + MESSAGE_EXPIRATION_TIME);
      
      // Save file share message to Firestore
      const messageRef = await db.collection('messages').add({
        userId: data.userId,
        userName: data.userName,
        files: data.files,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
        isFileShare: true
      });
      
      // Broadcast to all other users (not sender)
      socket.broadcast.emit('file_shared', {
        id: messageRef.id,
        userId: data.userId,
        userName: data.userName,
        files: data.files,
        expiresAt: expiresAt
      });
    } catch (error) {
      console.error('Error saving file share:', error);
    }
  });
  
  // Handle heartbeat
  socket.on('heartbeat', (data) => {
    // Update user's last seen time
    if (activeUsers.has(data.userId)) {
      const user = activeUsers.get(data.userId);
      user.lastSeen = new Date();
      activeUsers.set(data.userId, user);
    }
  });
  
  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    
    // Find and remove user from active users
    for (const [userId, userData] of activeUsers.entries()) {
      if (userData.socketId === socket.id) {
        activeUsers.delete(userId);
        
        // Broadcast to remaining users
        socket.broadcast.emit('user_left', {
          userId: userId,
          userName: userData.userName
        });
        
        // Update active users list
        socket.broadcast.emit('active_users', Array.from(activeUsers.values()));
        break;
      }
    }
  });
});

// Helper function to generate unique names
function generateUniqueName() {
  const adjectives = ['Cool', 'Fast', 'Smart', 'Bright', 'Happy', 'Lucky', 'Bold', 'Swift'];
  const nouns = ['Tiger', 'Eagle', 'Dolphin', 'Phoenix', 'Dragon', 'Lion', 'Falcon', 'Wolf'];
  
  let attempts = 0;
  let name;
  
  do {
    const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
    const noun = nouns[Math.floor(Math.random() * nouns.length)];
    const num = Math.floor(Math.random() * 1000);
    name = `${adj}${noun}${num}`;
    attempts++;
  } while (activeUsers.has(name) && attempts < 10);
  
  return name;
}

// Store active users
const activeUsers = new Map();

// Initialize message expiration system
initializeMessageExpirationSystem();

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    process.exit(0);
  });
});

// Export app for Vercel serverless functions
module.exports = { app, server };
