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
 * @param {Date} expiresAt - When the message expires (optional)
 * @returns {HTMLElement} The created message element
 */
function addMessage(text, isUser, translatedText = '', senderName = null, messageId = null, expiresAt = null) {
    const now = new Date();
    const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message-bubble ${isUser ? 'user-message' : 'other-message'} w-fit`;
    
    // Add message ID as data attribute if provided
    if (messageId) {
        messageDiv.dataset.messageId = messageId;
    }
    
    // Add expiration time as data attribute if provided
    if (expiresAt) {
        messageDiv.dataset.expiresAt = expiresAt.getTime();
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
    
    // Add expiration indicator if message expires
    if (expiresAt) {
        const remainingMs = expiresAt - now;
        if (remainingMs > 0) {
            // Format remaining time
            const remainingMins = Math.floor(remainingMs / 60000);
            let timeText;
            
            if (remainingMins > 60) {
                const hours = Math.floor(remainingMins / 60);
                const mins = remainingMins % 60;
                timeText = `${hours}h ${mins}m`;
            } else {
                timeText = `${remainingMins}m`;
            }
            
            // Create expiration element
            const expirationEl = document.createElement('div');
            expirationEl.className = 'message-expiration';
            expirationEl.textContent = `Expires in ${timeText}`;
            
            // Add urgency class based on remaining time
            if (remainingMins < 10) {
                expirationEl.classList.add('urgent');
            } else if (remainingMins < 30) {
                expirationEl.classList.add('warning');
            }
            
            messageContent.appendChild(expirationEl);
        }
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
 * @param {string} reason - Reason for removal ('deleted' or 'expired')
 */
function removeMessageById(messageId, reason = 'deleted') {
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
                
                // Only show deletion notification for manually deleted messages
                if (reason === 'deleted') {
                    // Add deletion notification
                    const deletionMsg = document.createElement('div');
                    deletionMsg.className = 'text-center py-1 text-xs text-slate-500';
                    deletionMsg.textContent = 'A message was deleted';
                    chatContainer.appendChild(deletionMsg);
                    
                    // Remove notification after 5 seconds
                    setTimeout(() => {
                        deletionMsg.remove();
                    }, 5000);
                }
                
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

// Set up tone understanding checkbox
const toneUnderstandingCheckbox = document.getElementById('tone-understanding');
// Set initial state from saved preference
toneUnderstandingCheckbox.checked = localStorage.getItem('tone_understanding') === 'true';

// Handle tone understanding toggle
toneUnderstandingCheckbox.addEventListener('change', function() {
    window.translationModule.setToneUnderstanding(this.checked);
    
    // Show feedback that translation cache was cleared
    const feedback = document.createElement('div');
    feedback.className = 'absolute top-full left-0 mt-2 px-3 py-2 bg-blue-600 text-white text-xs rounded-md z-20';
    feedback.textContent = this.checked ? 
        'Tone understanding enabled. Translations will be context-aware.' : 
        'Tone understanding disabled. Using standard translations.';
    
    // Position the feedback element
    const parentContainer = this.closest('.relative');
    if (parentContainer) {
        parentContainer.appendChild(feedback);
        
        // Remove after a delay
        setTimeout(() => {
            feedback.style.opacity = '0';
            feedback.style.transition = 'opacity 0.5s ease';
            setTimeout(() => feedback.remove(), 500);
        }, 3000);
    }
    
    // If a language is selected, suggest retranslating 
    if (window.translationModule.selectedLanguage) {
        const retranslatePrompt = document.createElement('div');
        retranslatePrompt.className = 'text-center py-2 text-xs text-blue-400 cursor-pointer hover:underline';
        retranslatePrompt.textContent = `Click here to retranslate messages with ${this.checked ? 'tone understanding' : 'standard translation'}`;
        
        chatContainer.appendChild(retranslatePrompt);
        chatContainer.scrollTop = chatContainer.scrollHeight;
        
        // Add click handler to retranslate
        retranslatePrompt.addEventListener('click', function() {
            // Find the active language button and trigger its click event to retranslate
            const activeLanguage = document.querySelector('.language-selector.active');
            if (activeLanguage) {
                activeLanguage.click();
            }
            this.remove(); // Remove the prompt after clicking
        });
        
        // Auto-remove after 10 seconds
        setTimeout(() => {
            if (retranslatePrompt.parentNode) {
                retranslatePrompt.remove();
            }
        }, 10000);
    }
});

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

/**
 * Creates a source label with appropriate styling
 * @param {string} translationSource - Source of translation service
 * @param {string} tone - Detected message tone (if any)
 * @returns {string} HTML for the source label
 */
function createSourceLabel(translationSource, tone = null) {
    if (!translationSource) return 'Original';
    
    let sourceClass = '';
    
    switch(translationSource) {
        case 'DeepSeek':
            sourceClass = 'deepseek-indicator';
            break;
        case 'Gemini':
            sourceClass = 'gemini-indicator';
            break;
        case 'DeepL':
            sourceClass = 'deepl-indicator';
            break;
        default:
            sourceClass = '';
    }
    
    // Add tone information if available
    const toneInfo = tone ? ` <span class="tone-indicator">(${tone})</span>` : '';
    
    return `Original <span class="${sourceClass}">[${translationSource}${toneInfo}]</span>`;
}

// Language selector click handlers
languageSelectors.forEach(selector => {
    selector.addEventListener('click', function() {
        const previousLanguage = window.translationModule.getLanguage();
        const newLanguage = this.dataset.lang;
        
        if (previousLanguage === newLanguage) {
            console.log(`Language already set to ${newLanguage}, no change needed`);
            languageDropdown.classList.add('hidden');
            return; // Skip if language hasn't changed
        }
        
        console.log(`Changing language from ${previousLanguage} to ${newLanguage}`);
        
        // Save language preference
        window.translationModule.setLanguage(newLanguage);
        localStorage.setItem('preferred_language', newLanguage);
        
        // Update UI
        translateToggle.innerHTML = `<i class="fas fa-language text-blue-400"></i><span class="ml-2">${this.textContent}</span>`;
        languageDropdown.classList.add('hidden');
        
        // Highlight selected language
        document.querySelectorAll('.language-selector').forEach(btn => {
            btn.classList.remove('active');
        });
        this.classList.add('active');
        
        // Reset translation cache when language changes
        window.translationModule.clearCache();
        
        // Retranslate all messages when language selector is clicked
        console.log(`Retranslating messages to ${newLanguage}`);
        
        // Get all messages from others
        const otherMessages = document.querySelectorAll('.message-bubble.other-message');
        
        // Show a notification about translation in progress
        const translationMsg = document.createElement('div');
        translationMsg.className = 'text-center py-2 text-xs text-blue-400';
        translationMsg.textContent = `Translating messages to ${this.textContent.trim()}...`;
        chatContainer.appendChild(translationMsg);
        chatContainer.scrollTop = chatContainer.scrollHeight;
        
        // Track translation progress
        let completedTranslations = 0;
        const totalMessages = otherMessages.length;
        
        otherMessages.forEach(messageEl => {
            const messageText = messageEl.querySelector('.message-text');
            const translationEl = messageEl.querySelector('.translated-message');
            
            if (!messageText) {
                completedTranslations++;
                return; // Skip if no message text element
            }
            
            // Get original text
            const originalText = messageText.getAttribute('data-original');
            if (!originalText) {
                completedTranslations++;
                return; // Skip if no original text stored
            }
            
            if (newLanguage) {
                // Show translating state
                messageText.textContent = 'Translating...';
                
                // Translate to new language
                window.translationModule.translateText(originalText, newLanguage)
                    .then(result => {
                        const translatedText = result.translation;
                        const translationSource = result.source;
                        const tone = result.tone; // Get detected tone if available
                        
                        if (translatedText !== originalText) {
                            // Update main message content with translation
                            messageText.textContent = translatedText;
                            
                            // Show original in translation area
                            if (translationEl) {
                                translationEl.innerHTML = `
                                    <span class="translated-label">${createSourceLabel(translationSource, tone)}</span>
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
                        
                        // Track progress
                        completedTranslations++;
                        if (completedTranslations === totalMessages) {
                            // Update notification when all translations are complete
                            translationMsg.textContent = `Messages translated to ${this.textContent.trim()}`;
                            // Remove notification after a delay
                            setTimeout(() => {
                                translationMsg.remove();
                            }, 3000);
                        }
                    })
                    .catch(err => {
                        console.error('Translation error:', err);
                        messageText.textContent = originalText; // Revert to original on error
                        if (translationEl) {
                            translationEl.classList.add('hidden');
                        }
                        
                        // Track progress even on error
                        completedTranslations++;
                        if (completedTranslations === totalMessages) {
                            translationMsg.textContent = `Some translations failed`;
                            setTimeout(() => {
                                translationMsg.remove();
                            }, 3000);
                        }
                    });
            } else {
                // If no language selected, show original text
                messageText.textContent = originalText;
                if (translationEl) {
                    translationEl.classList.add('hidden');
                }
                
                completedTranslations++;
            }
        });
        
        // If there were no messages to translate
        if (totalMessages === 0) {
            translationMsg.textContent = `Language changed to ${this.textContent.trim()}`;
            setTimeout(() => {
                translationMsg.remove();
            }, 3000);
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
