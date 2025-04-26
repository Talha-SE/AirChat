const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');

const app = express();
const server = http.createServer(app);

// Configure CORS for Socket.io to accept connections from anywhere
const io = new Server(server, {
  cors: {
    origin: "*", // Allow all origins
    methods: ["GET", "POST"]
  }
});

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

// File upload endpoint
app.post('/upload', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    // Return the file information including the URL
    const fileUrl = `/uploads/${req.file.filename}`;
    res.json({ 
      success: true,
      file: {
        name: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        url: fileUrl
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
    
    // Return information about all uploaded files
    const filesInfo = req.files.map(file => ({
      name: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      url: `/uploads/${file.filename}`
    }));
    
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

// Update the translation endpoint to use DeepL API
app.post('/translate', async (req, res) => {
  try {
    const { text, targetLang } = req.body;
    
    // DeepL API integration
    const DEEPL_API_KEY = '3d778465-68f0-4548-8b70-22b3af29d268:fx'; // Get this from DeepL
    const DEEPL_API_URL = 'https://api-free.deepl.com/v2/translate';
    
    // Convert our language codes to DeepL format if needed
    // EN->EN-US, JA->JA, etc.
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
  
  socket.on('join', (userData) => {
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
    
    // Notify others that a new user joined
    socket.broadcast.emit('user_joined', {
      userId: userData.userId,
      userName: userData.userName
    });
  });
  
  socket.on('chat_message', (data) => {
    // Broadcast the message to all clients
    io.emit('chat_message', data);
  });
  
  // Enhanced file sharing with real file URLs
  socket.on('file_shared', (data) => {
    // Add the server base URL to any relative URLs
    if (data.files) {
      data.files.forEach(file => {
        if (file.url && file.url.startsWith('/uploads/')) {
          // For absolute URLs in production
          const baseUrl = process.env.BASE_URL || `http://localhost:${PORT}`;
          file.fullUrl = `${baseUrl}${file.url}`;
        }
      });
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
