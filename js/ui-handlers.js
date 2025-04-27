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
 * @param {string} messageId - ID of the message (optional)
 * @returns {HTMLElement} The created message element
 */
function addMessage(text, isUser, translatedText = '', senderName = null, messageId = null) {
    const now = new Date();
    const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message-bubble ${isUser ? 'user-message' : 'other-message'} w-fit`;
    
    // Add message ID as data attribute if provided
    if (messageId) {
        messageDiv.dataset.messageId = messageId;
    }
    
    const messageContent = document.createElement('div');
    messageContent.className = 'message-content';
    
    if (isUser) {
        // Create message header with avatar, time and delete button
        const messageHeader = document.createElement('div');
        messageHeader.className = 'message-header';
        
        // Header content with sender info and time
        messageHeader.innerHTML = `
            <div class="sender-info">
                <div class="user-avatar">ME</div>
                <div class="sender-name">You</div>
            </div>
            <div class="message-actions">
                <span class="message-time">${timeString}</span>
                ${messageId ? `
                <button class="delete-message-btn ml-2 text-slate-400 hover:text-red-400 transition-colors" title="Delete message">
                    <i class="fas fa-trash-alt text-xs"></i>
                </button>` : ''}
            </div>
        `;
        
        // Create message text - no translation for user messages
        const messageText = document.createElement('p');
        messageText.className = 'message-text';
        messageText.textContent = text;
        
        // Append elements - no translation container for user messages
        messageContent.appendChild(messageHeader);
        messageContent.appendChild(messageText);
        messageDiv.appendChild(messageContent);
        
        // Add delete message functionality if message ID is provided
        if (messageId) {
            const deleteBtn = messageHeader.querySelector('.delete-message-btn');
            if (deleteBtn) {
                deleteBtn.addEventListener('click', function() {
                    deleteMessage(messageId, messageDiv);
                });
            }
        }
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

/**
 * Delete a message both locally and on the server
 * @param {string} messageId - ID of the message to delete
 * @param {HTMLElement} messageElement - Message element to remove from DOM
 */
function deleteMessage(messageId, messageElement) {
    // Ask for confirmation
    if (!confirm('Delete this message for everyone?')) {
        return;
    }
    
    // Show deletion in progress
    messageElement.classList.add('opacity-50');
    const messageText = messageElement.querySelector('.message-text');
    if (messageText) {
        messageText.innerHTML = '<i>Deleting message...</i>';
    }
    
    // Call the API to delete the message
    fetch(`/api/message/${messageId}?userId=${window.socketModule.userId()}`, {
        method: 'DELETE'
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`Failed to delete message: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        console.log('Message deleted successfully:', data);
        
        // Remove the message from the UI with animation
        messageElement.style.height = messageElement.offsetHeight + 'px';
        messageElement.classList.add('message-deleting');
        
        setTimeout(() => {
            messageElement.style.height = '0';
            messageElement.style.opacity = '0';
            messageElement.style.margin = '0';
            messageElement.style.padding = '0';
            
            setTimeout(() => {
                messageElement.remove();
            }, 300);
        }, 100);
    })
    .catch(error => {
        console.error('Delete message error:', error);
        
        // Reset the message to its original state
        messageElement.classList.remove('opacity-50');
        if (messageText) {
            messageText.textContent = messageText.getAttribute('data-original') || '';
        }
        
        // Show error notification
        const errorMsg = document.createElement('div');
        errorMsg.className = 'text-xs text-red-400 mt-1';
        errorMsg.textContent = 'Failed to delete message';
        messageElement.appendChild(errorMsg);
        
        // Auto-remove error after 3 seconds
        setTimeout(() => {
            errorMsg.remove();
        }, 3000);
    });
}

/**
 * Remove a message from the UI based on message ID
 * @param {string} messageId - ID of the message to remove
 */
function removeMessageById(messageId) {
    const messageElement = document.querySelector(`.message-bubble[data-message-id="${messageId}"]`);
    
    if (messageElement) {
        // Remove with animation
        messageElement.style.height = messageElement.offsetHeight + 'px';
        messageElement.classList.add('message-deleting');
        
        setTimeout(() => {
            messageElement.style.height = '0';
            messageElement.style.opacity = '0';
            messageElement.style.margin = '0';
            messageElement.style.padding = '0';
            
            setTimeout(() => {
                messageElement.remove();
                
                // Add deletion notification
                const deletionMsg = document.createElement('div');
                deletionMsg.className = 'text-center py-1 text-xs text-slate-500';
                deletionMsg.textContent = 'A message was deleted';
                chatContainer.appendChild(deletionMsg);
                
                // Remove notification after 5 seconds
                setTimeout(() => {
                    deletionMsg.remove();
                }, 5000);
                
            }, 300);
        }, 100);
    }
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
    typingIndicator,
    removeMessageById,
    deleteMessage
};
