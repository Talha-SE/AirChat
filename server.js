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

// Handle translation requests
app.post('/translate', async (req, res) => {
  try {
    const { text, targetLang } = req.body;
    
    // This is a mock translation for demonstration
    // In a real app, you would call a translation API
    const translatedText = `[${targetLang}] ${text}`;
    
    res.json({ translation: translatedText });
  } catch (error) {
    console.error('Translation error:', error);
    res.status(500).json({ error: 'Translation failed' });
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
