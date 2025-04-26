const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

// Configure CORS for Socket.io to accept connections from anywhere
const io = new Server(server, {
  cors: {
    origin: "*", // Allow all origins
    methods: ["GET", "POST"]
  }
});

// Use CORS middleware
app.use(cors());

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

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  
  socket.on('join', (userData) => {
    socket.userData = userData;
    console.log(`${userData.userName} joined the chat`);
    
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
  
  socket.on('file_shared', (data) => {
    // Broadcast file metadata to all clients
    io.emit('file_shared', data);
  });
  
  socket.on('disconnect', () => {
    if (socket.userData) {
      console.log(`${socket.userData.userName} left the chat`);
      
      // Notify others that a user left
      socket.broadcast.emit('user_left', {
        userId: socket.userData.userId,
        userName: socket.userData.userName
      });
    }
  });
});

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
