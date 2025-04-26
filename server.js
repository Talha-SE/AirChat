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

// Static files and other server setup
app.use(express.static(path.join(__dirname)));
app.use(express.json());

// Serve the HTML file
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Translation endpoint
app.post('/translate', async (req, res) => {
    try {
        const { text, targetLang } = req.body;
        
        if (!text || !targetLang) {
            return res.status(400).json({ 
                error: 'Missing required parameters: text and targetLang' 
            });
        }

        console.log(`Translating to ${targetLang}: "${text}"`);
        
        // Call DeepL API
        const response = await axios({
            method: 'POST',
            url: 'https://api-free.deepl.com/v2/translate',
            headers: {
                'Authorization': `DeepL-Auth-Key 7dcb43e7-39ee-4587-95da-ef4585c1fa6c:fx`,
                'Content-Type': 'application/json'
            },
            data: {
                text: [text],
                target_lang: targetLang
            }
        });

        console.log('DeepL API response:', response.data);
        
        if (response.data && response.data.translations && response.data.translations.length > 0) {
            res.json({ translation: response.data.translations[0].text });
        } else {
            throw new Error('Invalid translation response from DeepL');
        }
    } catch (error) {
        console.error('Translation error:', error.message);
        res.status(500).json({ 
            error: `Translation failed: ${error.message}`, 
            details: error.response?.data || error 
        });
    }
});

// Use PORT from environment (Render sets this) or fallback to 3000
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
