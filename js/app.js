/**
 * Main application file for GlobalTalk chat application
 * Acts as the entry point and connects all modules
 */

document.addEventListener('DOMContentLoaded', function() {
    console.log('GlobalTalk Chat application initialized');
    
    // Initialize tone understanding checkbox
    const toneCheckbox = document.getElementById('tone-understanding');
    if (toneCheckbox) {
        toneCheckbox.checked = localStorage.getItem('tone_understanding') === 'true';
        // Initialize the translation module with the current preference
        window.translationModule.setToneUnderstanding(toneCheckbox.checked);
    }
    
    // Set up message form submission
    const messageForm = document.getElementById('message-form');
    const messageInput = document.getElementById('message-input');
    
    messageForm.addEventListener('submit', function(e) {
        e.preventDefault();
        const messageText = messageInput.value.trim();
        
        if (messageText) {
            // Remove the direct UI update here
            // We'll handle this in the emitChatMessage function instead
            
            // Clear input first
            messageInput.value = '';
            
            // Send message to server
            window.socketModule.emitChatMessage(messageText);
            
            // Focus back on input
            messageInput.focus();
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
            // Add tone understanding indicator if enabled
            const toneEnabled = window.translationModule.isToneUnderstandingEnabled();
            const toneIndicator = toneEnabled ? ' with tone analysis' : '';
            
            statusElement.innerHTML = `<span class="text-green-400">● </span>Using ${testResult.source || 'Unknown'} translation${toneIndicator}`;
            
            // Add tooltip to show fallback service information
            if (testResult.source === 'DeepSeek') {
                statusElement.title = `DeepSeek AI is active${toneEnabled ? ' with tone analysis' : ''} (Gemini and DeepL as fallbacks)`;
            } else if (testResult.source === 'Gemini') {
                statusElement.title = `Using Gemini translation${toneEnabled ? ' with tone analysis' : ''} (DeepL as fallback)`;
            } else if (testResult.source === 'DeepL') {
                statusElement.title = `Using DeepL translation (fallback service${toneEnabled ? ', tone analysis unavailable' : ''})`;
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
