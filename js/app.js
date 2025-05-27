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
    
    // Check translation service status
    checkTranslationStatus();
});

/**
 * Checks the translation service status and updates the UI
 */
async function checkTranslationStatus() {
    try {
        // Simple translation to test service availability
        const testResult = await window.translationModule.translateText("Hello world", "ES");
        
        // Update the translation service status in header
        const statusElement = document.querySelector('.app-header p');
        if (statusElement) {
            statusElement.innerHTML = `<span class="text-green-400">● </span>Using ${testResult.source || 'Unknown'} translation`;
            
            // Add tooltip to show fallback service information
            if (testResult.source === 'DeepSeek') {
                statusElement.title = 'DeepSeek AI is active (Gemini and DeepL as fallbacks)';
            } else if (testResult.source === 'Gemini') {
                statusElement.title = 'Using Gemini translation (DeepL as fallback)';
            } else if (testResult.source === 'DeepL') {
                statusElement.title = 'Using DeepL translation (fallback service)';
            }
        }
    } catch (error) {
        console.error('Translation service check failed:', error);
        
        // Update status to show error
        const statusElement = document.querySelector('.app-header p');
        if (statusElement) {
            statusElement.innerHTML = '<span class="text-red-400">● </span>Translation service unavailable';
            statusElement.title = 'Check your internet connection or API keys';
        }
    }
}
