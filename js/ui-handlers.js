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
    messageDiv.className = `message-bubble ${isUser ? 'user-message' : 'other-message'} w-fit`;
    
    const messageContent = document.createElement('div');
    messageContent.className = 'message-content';
    
    if (isUser) {
        // Create message header with avatar and time
        const messageHeader = document.createElement('div');
        messageHeader.className = 'message-header';
        messageHeader.innerHTML = `
            <div class="sender-info">
                <div class="user-avatar">ME</div>
                <div class="sender-name">You</div>
            </div>
            <span class="message-time">${timeString}</span>
        `;
        
        // Create message text - no translation for user messages
        const messageText = document.createElement('p');
        messageText.className = 'message-text';
        messageText.textContent = text;
        
        // Append elements - no translation container for user messages
        messageContent.appendChild(messageHeader);
        messageContent.appendChild(messageText);
        messageDiv.appendChild(messageContent);
    } else {
        // Make sure we have valid sender information
        const displayName = senderName || 'Other User';
        const initials = getInitials(displayName);
        
        // Create message header with avatar and time
        const messageHeader = document.createElement('div');
        messageHeader.className = 'message-header';
        messageHeader.innerHTML = `
            <div class="sender-info">
                <div class="other-avatar">${initials}</div>
                <div class="sender-name">${displayName}</div>
            </div>
            <span class="message-time">${timeString}</span>
        `;
        
        // Create message text - for other users' messages, this might be translated
        const messageText = document.createElement('p');
        messageText.className = 'message-text';
        messageText.textContent = text;
        
        // Store original message for potential re-translation later
        messageText.setAttribute('data-original', text);
        
        // Create original message container (only if we have translation)
        const originalContainer = document.createElement('div');
        originalContainer.className = `translated-message ${translatedText ? '' : 'hidden'}`;
        if (translatedText && translatedText !== text) {
            originalContainer.innerHTML = `
                <span class="translated-label">Original</span>
                <p>${text}</p>
            `;
            // If we have translation, display it as the main message
            messageText.textContent = translatedText;
        }
        
        // Append all elements
        messageContent.appendChild(messageHeader);
        messageContent.appendChild(messageText);
        messageContent.appendChild(originalContainer);
        messageDiv.appendChild(messageContent);
    }
    
    // Insert before typing indicator
    chatContainer.insertBefore(messageDiv, typingIndicator || null);
    chatContainer.scrollTop = chatContainer.scrollHeight;
    
    // Return the message element so we can update it later
    return messageDiv;
}

// Set up language selection
// Set initial language display based on stored preference
const initialLanguage = Array.from(languageSelectors).find(el => el.dataset.lang === window.translationModule.selectedLanguage);
if (initialLanguage) {
    translateToggle.innerHTML = `<i class="fas fa-language text-blue-400"></i><span class="ml-2">${initialLanguage.textContent}</span>`;
} else {
    translateToggle.innerHTML = `<i class="fas fa-language text-blue-400"></i><span class="ml-2">Translate</span>`;
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
            console.log(`Language changed from ${previousLanguage} to ${newLanguage}, retranslating messages`);
            // Get all messages from others
            const otherMessages = document.querySelectorAll('.message-bubble.other-message');
            
            otherMessages.forEach(messageEl => {
                const messageText = messageEl.querySelector('.message-text');
                const translationEl = messageEl.querySelector('.translated-message');
                
                if (!messageText) return; // Skip if no message text element
                
                // Get original text
                const originalText = messageText.getAttribute('data-original');
                if (!originalText) return; // Skip if no original text stored
                
                if (newLanguage) {
                    // Show translating state
                    messageText.textContent = 'Translating...';
                    
                    // Translate to new language
                    window.translationModule.translateText(originalText, newLanguage)
                        .then(translatedText => {
                            if (translatedText !== originalText) {
                                // Update main message content with translation
                                messageText.textContent = translatedText;
                                
                                // Show original in translation area
                                if (translationEl) {
                                    translationEl.innerHTML = `
                                        <span class="translated-label">Original</span>
                                        <p>${originalText}</p>
                                    `;
                                    translationEl.classList.remove('hidden');
                                }
                            } else {
                                // If translation is same as original, just show original
                                messageText.textContent = originalText;
                                if (translationEl) {
                                    translationEl.classList.add('hidden');
                                }
                            }
                        })
                        .catch(err => {
                            console.error('Translation error:', err);
                            messageText.textContent = originalText; // Revert to original on error
                            if (translationEl) {
                                translationEl.classList.add('hidden');
                            }
                        });
                } else {
                    // If no language selected, show original text
                    messageText.textContent = originalText;
                    if (translationEl) {
                        translationEl.classList.add('hidden');
                    }
                }
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
