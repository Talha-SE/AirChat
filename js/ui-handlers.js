/**
 * UI Handlers for GlobalTalk chat application
 */

// Cache DOM elements
const chatContainer = document.querySelector('.chat-container');
const typingIndicator = document.getElementById('typing-indicator');
const translateToggle = document.getElementById('translate-toggle');
const languageDropdown = document.getElementById('language-dropdown');
const languageSelectors = document.querySelectorAll('.language-selector');

/**
 * Adds a message to the chat UI
 * @param {string} text - Message text
 * @param {boolean} isUser - Whether the message is from the current user
 * @param {string} translatedText - Translated message text (optional)
 * @param {string} senderName - Name of the sender (optional)
 * @returns {HTMLElement} The created message element
 */
function addMessage(text, isUser, translatedText = '', senderName = null) {
    const now = new Date();
    const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message-bubble ${isUser ? 'user-message' : 'other-message'} p-5 w-fit`;
    
    if (isUser) {
        messageDiv.innerHTML = `
            <div class="flex items-center space-x-3 mb-2 justify-end">
                <div>
                    <span class="text-xs text-slate-300 mr-2">${timeString}</span>
                    <span class="font-medium">You</span>
                </div>
                <div class="w-8 h-8 rounded-full user-avatar flex items-center justify-center text-xs">ME</div>
            </div>
            <p class="leading-relaxed">${text}</p>
            <div class="translated-message hidden">
                ${translatedText || ''}
            </div>
        `;
    } else {
        // Make sure we have valid sender information
        const displayName = senderName || 'Other User';
        const initials = getInitials(displayName);
        
        messageDiv.innerHTML = `
            <div class="flex items-center space-x-3 mb-2">
                <div class="w-8 h-8 rounded-full other-avatar flex items-center justify-center text-xs">${initials}</div>
                <div>
                    <span class="font-medium">${displayName}</span>
                    <span class="text-xs text-slate-300 ml-2">${timeString}</span>
                </div>
            </div>
            <p class="leading-relaxed">${text}</p>
            <div class="translated-message ${window.translationModule.selectedLanguage ? '' : 'hidden'}">
                ${translatedText || ''}
            </div>
        `;
    }
    
    // Insert before typing indicator
    chatContainer.insertBefore(messageDiv, typingIndicator);
    chatContainer.scrollTop = chatContainer.scrollHeight;
    
    // Return the message element so we can update it later
    return messageDiv;
}

// Set up language selection
// Set initial language display based on stored preference
const initialLanguage = Array.from(languageSelectors).find(el => el.dataset.lang === window.translationModule.selectedLanguage);
if (initialLanguage) {
    translateToggle.innerHTML = `<i class="fas fa-language text-blue-400"></i><span class="ml-2">${initialLanguage.textContent}</span>`;
}

// Toggle translation dropdown
translateToggle.addEventListener('click', function() {
    languageDropdown.classList.toggle('hidden');
});

// Close dropdown when clicking outside
document.addEventListener('click', function(event) {
    if (!translateToggle.contains(event.target) && !languageDropdown.contains(event.target)) {
        languageDropdown.classList.add('hidden');
    }
});

// Language selector click handlers
languageSelectors.forEach(selector => {
    selector.addEventListener('click', function() {
        const previousLanguage = window.translationModule.getLanguage();
        const newLanguage = this.dataset.lang;
        
        // Save language preference
        window.translationModule.setLanguage(newLanguage);
        localStorage.setItem('preferred_language', newLanguage);
        
        translateToggle.innerHTML = `<i class="fas fa-language text-blue-400"></i><span class="ml-2">${this.textContent}</span>`;
        languageDropdown.classList.add('hidden');
        
        // Only retranslate messages if the language changed
        if (previousLanguage !== newLanguage) {
            // Get all messages from others
            const otherMessages = document.querySelectorAll('.message-bubble.other-message');
            
            otherMessages.forEach(messageEl => {
                const messageText = messageEl.querySelector('p.leading-relaxed');
                const translationEl = messageEl.querySelector('.translated-message');
                
                // Get original text (if available) or current text
                const originalText = messageText.getAttribute('data-original') || messageText.textContent;
                
                // Show translating state
                messageText.textContent = 'Translating...';
                
                // Translate to new language
                window.translationModule.translateText(originalText, newLanguage)
                    .then(translatedText => {
                        // Update main message content
                        messageText.textContent = translatedText;
                        
                        // Show original in translation area
                        if (translationEl) {
                            translationEl.innerHTML = `<span class="text-xs text-slate-400">Original: </span>${originalText}`;
                            translationEl.classList.remove('hidden');
                        }
                    })
                    .catch(err => {
                        console.error('Translation error:', err);
                        messageText.textContent = originalText; // Revert to original on error
                        if (translationEl) {
                            translationEl.textContent = 'Translation failed';
                            translationEl.classList.remove('hidden');
                        }
                    });
            });
        }
    });
});

// Export objects and functions for use in other modules
window.uiModule = {
    addMessage,
    chatContainer,
    typingIndicator
};
