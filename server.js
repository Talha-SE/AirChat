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
    methods: ["GET", "POST"]
  }
});

// Connect to MongoDB with improved error handling and reconnection logic
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 30s
  socketTimeoutMS: 45000, // Close sockets after 45s of inactivity
})
.then(() => console.log('MongoDB connected'))
.catch(err => console.error('MongoDB connection error:', err));

// Handle MongoDB connection events for better reliability
mongoose.connection.on('error', err => {
  console.error('MongoDB connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('MongoDB disconnected, attempting to reconnect...');
});

mongoose.connection.on('reconnected', () => {
  console.log('MongoDB reconnected');
});

// Define Message Schema with indexes for better query performance
const messageSchema = new mongoose.Schema({
  userId: { type: String, index: true },
  userName: String,
  message: String,
  sourceLang: String,
  timestamp: {
    type: Date,
    default: Date.now,
    index: true // Add index to improve query performance on timestamp
  },
  files: [{
    name: String,
    mimetype: String,
    size: Number,
    url: String,
    fullUrl: String // Add fullUrl to store complete URL
  }],
  isFileShare: {
    type: Boolean,
    default: false,
    index: true // Add index to improve filtering by message type
  }
});

// Add compound index for common queries
messageSchema.index({ timestamp: -1, isFileShare: 1 });

const Message = mongoose.model('Message', messageSchema);

// Define Translation Cache Schema to avoid retranslating the same content
const translationCacheSchema = new mongoose.Schema({
  originalText: { type: String, required: true },
  targetLang: { type: String, required: true },
  translation: { type: String, required: true },
  timestamp: {
    type: Date,
    default: Date.now,
    expires: '7d' // Auto-expire entries after 7 days
  }
});

// Compound index for cache lookup
translationCacheSchema.index({ originalText: 1, targetLang: 1 }, { unique: true });

const TranslationCache = mongoose.model('TranslationCache', translationCacheSchema);

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads
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

// File filter to validate types if needed
const fileFilter = (req, file, cb) => {
  // Accept all file types
  cb(null, true);
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

// Enhanced API endpoint to get chat history with pagination support
app.get('/api/message-history', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 0;
    const limit = parseInt(req.query.limit) || 50;
    const skip = page * limit;
    
    // Get total count for pagination info
    const totalMessages = await Message.countDocuments();
    
    // Get paginated messages, sorted by timestamp
    const messages = await Message.find()
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit)
      .lean();
    
    // Send messages in chronological order (oldest first) with pagination metadata
    res.json({
      messages: messages.reverse(),
      pagination: {
        page,
        limit,
        total: totalMessages,
        pages: Math.ceil(totalMessages / limit),
        hasMore: skip + limit < totalMessages
      }
    });
  } catch (error) {
    console.error('Error fetching message history:', error);
    res.status(500).json({ error: 'Failed to fetch message history' });
  }
});

// New endpoint to get older messages
app.get('/api/older-messages', async (req, res) => {
  try {
    const before = req.query.before; // Timestamp to get messages before
    const limit = parseInt(req.query.limit) || 20;
    
    if (!before) {
      return res.status(400).json({ error: 'Missing "before" timestamp parameter' });
    }
    
    // Get messages older than the provided timestamp
    const messages = await Message.find({ 
      timestamp: { $lt: new Date(before) } 
    })
    .sort({ timestamp: -1 })
    .limit(limit)
    .lean();
    
    res.json({
      messages: messages.reverse(), // Return in chronological order
      hasMore: messages.length === limit
    });
  } catch (error) {
    console.error('Error fetching older messages:', error);
    res.status(500).json({ error: 'Failed to fetch older messages' });
  }
});

// File upload endpoint
app.post('/upload', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    // Get base URL from environment or use request info
    const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
    
    // Return the file information including both relative and full URLs
    const fileUrl = `/uploads/${req.file.filename}`;
    const fullUrl = `${baseUrl}${fileUrl}`;
    
    res.json({ 
      success: true,
      file: {
        name: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        url: fileUrl,
        fullUrl: fullUrl
      }
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'File upload failed', details: error.message });
  }
});

// Multiple file upload endpoint
app.post('/upload-multiple', upload.array('files', 10), (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }
    
    // Get base URL from environment or use request info
    const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
    
    // Return information about all uploaded files
    const filesInfo = req.files.map(file => {
      const fileUrl = `/uploads/${file.filename}`;
      const fullUrl = `${baseUrl}${fileUrl}`;
      
      return {
        name: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        url: fileUrl,
        fullUrl: fullUrl
      };
    });
    
    res.json({ 
      success: true,
      files: filesInfo
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'File upload failed', details: error.message });
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

// Static files
app.use(express.static(path.join(__dirname)));
app.use(express.json());

// Serve index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Update the translation endpoint to use DeepL API with improved caching via MongoDB
app.post('/translate', async (req, res) => {
  try {
    const { text, targetLang } = req.body;
    
    // Check for empty text or missing target language
    if (!text || !targetLang) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }
    
    // Check if translation is in MongoDB cache
    const cachedTranslation = await TranslationCache.findOne({
      originalText: text.substring(0, 500), // Limit text length for cache key
      targetLang: targetLang
    });
    
    if (cachedTranslation) {
      console.log('Translation cache hit');
      return res.json({ translation: cachedTranslation.translation });
    }
    
    // DeepL API integration
    const DEEPL_API_KEY = process.env.DEEPL_API_KEY;
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
    
    // Store in MongoDB cache
    try {
      await new TranslationCache({
        originalText: text.substring(0, 500), // Limit text length
        targetLang: targetLang,
        translation: translation,
        timestamp: new Date()
      }).save();
    } catch (cacheError) {
      // If cache save fails, just log it but don't fail the request
      console.error('Error saving translation to cache:', cacheError);
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
    
    // Send message history to the newly joined user with improved error handling
    try {
      const messages = await Message.find()
        .sort({ timestamp: -1 })
        .limit(30) // Reduce initial load to 30 messages for faster startup
        .lean();
      
      // Get the base URL for file URLs
      const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
      
      // Add complete URLs to files if needed
      messages.forEach(msg => {
        if (msg.files && msg.files.length > 0) {
          msg.files.forEach(file => {
            if (file.url && !file.fullUrl) {
              file.fullUrl = `${baseUrl}${file.url}`;
            }
          });
        }
      });
      
      // Send messages in chronological order with metadata
      socket.emit('message_history', {
        messages: messages.reverse(),
        hasMore: await Message.countDocuments() > messages.length,
        oldestTimestamp: messages.length > 0 ? messages[0].timestamp : null
      });
    } catch (error) {
      console.error('Error fetching message history:', error);
      socket.emit('error', { message: 'Failed to fetch message history' });
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
      
      // Broadcast the message to all clients
      io.emit('chat_message', completeData);
    } catch (error) {
      console.error('Error saving message to database:', error);
      socket.emit('error', { message: 'Failed to save message' });
    }
  });
  
  // Enhanced file sharing with real file URLs and database storage
  socket.on('file_shared', async (data) => {
    // Get base URL from environment variables
    const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
    
    // Add the server base URL to any relative URLs
    if (data.files) {
      data.files.forEach(file => {
        if (file.url && !file.fullUrl) {
          file.fullUrl = `${baseUrl}${file.url}`;
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
      
      // Broadcast file metadata to all clients
      io.emit('file_shared', data);
    } catch (error) {
      console.error('Error saving file share to database:', error);
      socket.emit('error', { message: 'Failed to save file share' });
    }
  });
  
  // Handle request for older messages
  socket.on('fetch_older_messages', async (options) => {
    try {
      const before = options.before; // Timestamp to get messages before
      const limit = options.limit || 20;
      
      if (!before) {
        return socket.emit('error', { message: 'Missing timestamp for older messages' });
      }
      
      // Get messages older than the provided timestamp
      const messages = await Message.find({ 
        timestamp: { $lt: new Date(before) } 
      })
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();
      
      // Get base URL for files
      const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
      
      // Add complete URLs to files if needed
      messages.forEach(msg => {
        if (msg.files && msg.files.length > 0) {
          msg.files.forEach(file => {
            if (file.url && !file.fullUrl) {
              file.fullUrl = `${baseUrl}${file.url}`;
            }
          });
        }
      });
      
      // Send older messages to the client
      socket.emit('older_messages', {
        messages: messages.reverse(), // Send in chronological order
        hasMore: messages.length === limit,
        oldestTimestamp: messages.length > 0 ? messages[0].timestamp : null
      });
    } catch (error) {
      console.error('Error fetching older messages:', error);
      socket.emit('error', { message: 'Failed to fetch older messages' });
    }
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
