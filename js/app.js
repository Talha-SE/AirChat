/**
 * Main application file for GlobalTalk chat application
 * Acts as the entry point and connects all modules
 */

document.addEventListener('DOMContentLoaded', function() {
    console.log('GlobalTalk Chat application initialized');
    
    // Set up message form submission
    const messageForm = document.getElementById('message-form');
    const messageInput = document.getElementById('message-input');
    
    messageForm.addEventListener('submit', function(e) {
        e.preventDefault();
        const messageText = messageInput.value.trim();
        
        if (messageText) {
            // Add user message to the UI - no translation for own messages
            // We don't have message ID yet as it will be assigned by the server
            window.uiModule.addMessage(messageText, true);
            messageInput.value = '';
            
            // Send message to server
            window.socketModule.emitChatMessage(messageText);
        }
    });
    
    // Initial scroll to bottom
    window.uiModule.chatContainer.scrollTop = window.uiModule.chatContainer.scrollHeight;
});
