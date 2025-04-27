/**
 * Socket client module for GlobalTalk chat application
 */

let socket;
let userId = localStorage.getItem('chat_user_id') || generateUserId();
let userName = localStorage.getItem('chat_user_name') || ''; // Empty to get server-generated name

// Store user ID for future sessions
localStorage.setItem('chat_user_id', userId);

// Connection status element
const connectionStatus = document.getElementById('connection-status');

/**
 * Connect to the Socket.io server
 * @returns {object} Socket.io connection
 */
function connectToServer() {
    // For deployment on Render:
    const socket = io('https://airchat-global.onrender.com', {
        reconnectionAttempts: Infinity, // Never stop trying to reconnect
        reconnectionDelay: 1000,
        reconnectionDelayMax: 10000,
        timeout: 60000, // Longer timeout (60 seconds)
        pingTimeout: 120000, // Longer ping timeout (2 minutes)
        pingInterval: 25000, // More frequent pings (25 seconds)
    });
    
    // Set up heartbeat to keep connection alive
    const heartbeatInterval = setInterval(() => {
        if (socket.connected) {
            socket.emit('heartbeat', { userId });
        }
    }, 30000); // Send heartbeat every 30 seconds
    
    // Clear heartbeat on page unload
    window.addEventListener('beforeunload', () => {
        clearInterval(heartbeatInterval);
    });
    
    // Add reconnection event handlers
    socket.io.on('reconnect_attempt', (attempt) => {
        connectionStatus.className = 'px-3 py-1 rounded-full bg-yellow-600 text-xs mr-2';
        connectionStatus.innerHTML = `<span>Reconnecting (${attempt})...</span>`;
    });
    
    // Handle disconnect event
    socket.on('disconnect', (reason) => {
        connectionStatus.className = 'px-3 py-1 rounded-full bg-red-600 text-xs mr-2';
        connectionStatus.innerHTML = '<span>Disconnected</span>';
        
        console.log('Disconnect reason:', reason);
        
        // Show disconnection message in chat
        const disconnectionMsg = document.createElement('div');
        disconnectionMsg.className = 'text-center py-2 text-xs text-slate-400';
        disconnectionMsg.textContent = 'Disconnected from global chat. Attempting to reconnect...';
        window.uiModule.chatContainer.appendChild(disconnectionMsg);
        window.uiModule.chatContainer.scrollTop = window.uiModule.chatContainer.scrollHeight;
        
        // Auto-reconnect for non-explicit disconnects
        if (reason !== 'io client disconnect') {
            setTimeout(() => {
                if (!socket.connected) {
                    socket.connect();
                }
            }, 2000);
        }
    });
    
    // Connection events
    socket.on('connect', () => {
        connectionStatus.className = 'px-3 py-1 rounded-full bg-green-600 text-xs mr-2';
        connectionStatus.innerHTML = '<span>Connected</span>';
        
        // Join the global chat
        socket.emit('join', {
            userId: userId,
            userName: userName
        });
        
        // Show active connection message in chat
        const connectionMsg = document.createElement('div');
        connectionMsg.className = 'text-center py-2 text-xs text-slate-400';
        connectionMsg.textContent = 'Connected to global chat';
        window.uiModule.chatContainer.appendChild(connectionMsg);
        window.uiModule.chatContainer.scrollTop = window.uiModule.chatContainer.scrollHeight;
    });
    
    // Handle message history from server
    socket.on('message_history', (messages) => {
        console.log('Received message history:', messages.length, 'messages');
        
        // Clear welcome message if we have history
        if (messages.length > 0) {
            const welcomeContainer = document.querySelector('.welcome-container');
            if (welcomeContainer) {
                welcomeContainer.remove();
            }
            
            // Clear any sample messages
            const sampleMessages = document.querySelectorAll('.message-bubble');
            sampleMessages.forEach(msg => {
                if (!msg.hasAttribute('data-real-message')) {
                    msg.remove();
                }
            });
            
            // Add history notification
            const historyMsg = document.createElement('div');
            historyMsg.className = 'text-center py-2 text-xs text-blue-400';
            historyMsg.textContent = `Showing last ${messages.length} messages`;
            window.uiModule.chatContainer.appendChild(historyMsg);
            
            // Display each message
            messages.forEach(msg => {
                if (msg.isFileShare && msg.files && msg.files.length > 0) {
                    // It's a file share message
                    window.fileModule.createFileShareMessage(msg.files, msg.userId === userId, msg.userName);
                } else {
                    // It's a text message
                    const isUser = msg.userId === userId;
                    const messageElement = window.uiModule.addMessage(msg.message, isUser, '', isUser ? null : msg.userName);
                    messageElement.setAttribute('data-real-message', 'true');
                    
                    // If translation is enabled and it's not user's message
                    const currentLang = window.translationModule.selectedLanguage;
                    if (currentLang && !isUser) {
                        const messageTextElement = messageElement.querySelector('.message-text');
                        const translationElement = messageElement.querySelector('.translated-message');
                        
                        if (messageTextElement) {
                            // Store the original text as data attribute
                            messageTextElement.setAttribute('data-original', msg.message);
                            
                            // Show translating state
                            messageTextElement.textContent = 'Translating...';
                            
                            // Translate the message
                            window.translationModule.translateText(msg.message, currentLang)
                                .then(translatedText => {
                                    // Update the main message content with translation
                                    messageTextElement.textContent = translatedText;
                                    
                                    // Show original text in translation element
                                    if (translationElement) {
                                        translationElement.innerHTML = `<span class="translated-label">Original</span><p>${msg.message}</p>`;
                                        translationElement.classList.remove('hidden');
                                    }
                                })
                                .catch(err => {
                                    console.error('Translation error:', err);
                                    messageTextElement.textContent = msg.message; // Revert to original on error
                                    if (translationElement) {
                                        translationElement.innerHTML = `<span class="translated-label">Translation Failed</span><p>Could not translate message</p>`;
                                        translationElement.classList.remove('hidden');
                                    }
                                });
                        }
                    }
                }
            });
            
            // Scroll to bottom after loading history
            window.uiModule.chatContainer.scrollTop = window.uiModule.chatContainer.scrollHeight;
        }
    });
    
    // Handle name assignment from server
    socket.on('name_assigned', (data) => {
        if (data.userName) {
            userName = data.userName;
            localStorage.setItem('chat_user_name', userName);
            
            // Update UI to show assigned name
            const nameMsg = document.createElement('div');
            nameMsg.className = 'text-center py-2 text-xs text-blue-400';
            nameMsg.textContent = `You are chatting as: ${userName}`;
            window.uiModule.chatContainer.appendChild(nameMsg);
            window.uiModule.chatContainer.scrollTop = window.uiModule.chatContainer.scrollHeight;
        }
    });
    
    // Receive active users list
    socket.on('active_users', (users) => {
        console.log('Active users:', users);
        // Update active users count in UI
        const userCount = users.length;
        if (userCount > 1) {
            connectionStatus.innerHTML = `<span>Connected (${userCount} users)</span>`;
        } else {
            connectionStatus.innerHTML = `<span>Connected</span>`;
        }
    });
    
    // Improved chat message handling
    socket.on('chat_message', (data) => {
        console.log('Received chat message:', data);
        
        // Only process messages from other users
        if (data.userId && data.userId !== userId) {
            console.log('Adding message from:', data.userName);
            
            const currentLang = window.translationModule.selectedLanguage;
            
            // If translation is enabled and target language is different from source
            if (currentLang && (!data.sourceLang || data.sourceLang !== currentLang)) {
                // First add the message in original form
                const otherMessageElement = window.uiModule.addMessage(data.message, false, data.message, data.userName);
                const messageTextElement = otherMessageElement.querySelector('.message-text');
                const translationElement = otherMessageElement.querySelector('.translated-message');
                
                // Play notification sound
                playMessageSound();
                
                // Remove the hidden class from translation element
                if (translationElement) translationElement.classList.remove('hidden');
                
                // Show translating state
                if (messageTextElement) {
                    messageTextElement.textContent = 'Translating...';
                }
                
                // Translate received message
                window.translationModule.translateText(data.message, currentLang)
                    .then(translatedText => {
                        // Update the main message content with translation
                        if (messageTextElement) {
                            // Store the original text as data attribute
                            messageTextElement.setAttribute('data-original', data.message);
                            messageTextElement.textContent = translatedText;
                        }
                        
                        // Show original text in translation element
                        if (translationElement) {
                            translationElement.innerHTML = `<span class="translated-label">Original</span><p>${data.message}</p>`;
                        }
                    })
                    .catch(err => {
                        console.error('Translation error:', err);
                        if (messageTextElement) {
                            messageTextElement.textContent = data.message; // Revert to original on error
                        }
                        if (translationElement) {
                            translationElement.innerHTML = `<span class="translated-label">Translation Failed</span><p>Could not translate message</p>`;
                        }
                    });
            } else {
                // No translation needed, show as is
                window.uiModule.addMessage(data.message, false, '', data.userName);
                playMessageSound();
            }
        } else {
            console.log('Ignoring own message or invalid message');
        }
    });
    
    // Handle file shares from other users
    socket.on('file_shared', (data) => {
        // Only process file shares from other users
        if (data.userId && data.userId !== userId && data.files) {
            // Create file share message
            window.fileModule.createFileShareMessage(data.files, false, data.userName);
            // Play notification sound
            playMessageSound();
        }
    });
    
    // Handle file deletion events from server
    socket.on('file_deleted', (data) => {
      if (data && data.fileId) {
        console.log(`File deleted by another user: ${data.fileId}`);
        
        // Find and remove file elements with this ID
        const fileItems = document.querySelectorAll(`.file-item[data-file-id="${data.fileId}"]`);
        fileItems.forEach(fileItem => {
          // Animate removal
          fileItem.style.height = fileItem.offsetHeight + 'px';
          fileItem.classList.add('file-deleting');
          
          setTimeout(() => {
            fileItem.style.height = '0';
            fileItem.style.opacity = '0';
            fileItem.style.margin = '0';
            fileItem.style.padding = '0';
            
            setTimeout(() => {
              fileItem.remove();
              
              // Check if this was the last file in the container
              const parentContainer = fileItem.closest('.files-container');
              if (parentContainer && parentContainer.children.length === 0) {
                // If it was the last file, remove the entire message
                const messageBubble = parentContainer.closest('.message-bubble');
                if (messageBubble) messageBubble.remove();
              }
            }, 300);
          }, 100);
        });
      }
    });
    
    return socket;
}

/**
 * Emit a chat message to the server
 * @param {string} message - Message text to send 
 */
function emitChatMessage(message) {
    if (!socket || !socket.connected) return;
    
    // Determine the source language - using 'EN' as default for simplicity
    // In a real app, you might want to detect the language
    const sourceLang = 'EN';
    
    // Broadcast message to all connected users with source language info
    socket.emit('chat_message', {
        userId: userId,
        userName: userName,
        message: message,
        sourceLang: sourceLang
    });
}

/**
 * Emit a file share to the server
 * @param {Array} files - Array of file metadata objects
 */
function emitFileShared(files) {
    if (!socket || !socket.connected) return;
    
    // Broadcast file metadata to other users
    socket.emit('file_shared', {
        userId: userId,
        userName: userName,
        files: files
    });
}

// Export objects and functions for use in other modules
window.socketModule = {
    connect: connectToServer,
    emitChatMessage,
    emitFileShared,
    userId: function() { return userId; },
    userName: function() { return userName; }
};

// Initialize socket connection
socket = window.socketModule.connect();
