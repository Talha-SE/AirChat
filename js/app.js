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
            // Add user message to the UI
            const userMessageElement = window.uiModule.addMessage(messageText, true);
            messageInput.value = '';
            
            // Send message
            window.socketModule.emitChatMessage(messageText);
            
            // For consistency, if the user has translation enabled,
            // show their own message in their selected language too
            if (window.translationModule.selectedLanguage && window.translationModule.selectedLanguage !== 'EN') {
                const translationElement = userMessageElement.querySelector('.translated-message');
                translationElement.textContent = 'Translating...';
                translationElement.classList.remove('hidden');
                
                window.translationModule.translateText(messageText, window.translationModule.selectedLanguage)
                    .then(translatedText => {
                        translationElement.innerHTML = `<span class="text-xs text-slate-400">Translation: </span>${translatedText}`;
                    })
                    .catch(err => {
                        console.error('Translation error:', err);
                        translationElement.textContent = 'Translation failed';
                    });
            }
        }
    });
    
    // Initial scroll to bottom
    window.uiModule.chatContainer.scrollTop = window.uiModule.chatContainer.scrollHeight;
});
