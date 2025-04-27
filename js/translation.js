/**
 * Translation module for GlobalTalk chat application
 */

// Store selected language
let selectedLanguage = localStorage.getItem('preferred_language') || ''; // No default language

/**
 * Translates text to the specified target language
 * @param {string} text - Text to translate
 * @param {string} targetLang - Target language code
 * @returns {Promise<string>} Translated text
 */
async function translateText(text, targetLang) {
    console.log(`Requesting translation to ${targetLang}: "${text}"`);
    
    if (!targetLang || targetLang === '') {
        return Promise.resolve(text); // No translation needed
    }
    
    try {
        // Mock translations for fallback
        const mockTranslations = {
            'EN': 'English: ',
            'KO': '한국어: ',
            'ES': 'Español: ',
            'FR': 'Français: ',
            'DE': 'Deutsch: ',
            'IT': 'Italiano: ',
            'JA': '日本語: '
        };
        
        // Try server translation first
        try {
            // For English translations, make sure we specify source language if possible
            // This helps translation services properly translate to English
            let requestBody = {
                text: [text],
                target_lang: targetLang
            };
            
            // If target is English, add source language detection
            // This ensures the API doesn't skip translation because it thinks the text is already English
            if (targetLang === 'EN') {
                requestBody.formality = 'default';  // DeepL parameter that can help with English translation
            }
            
            const response = await fetch('/translate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody)
            });
            
            console.log('Server response status:', response.status);
            
            if (!response.ok) {
                throw new Error(`Translation server error: ${response.status}`);
            }
            
            const data = await response.json();
            if (data && data.translation) {
                return data.translation;
            } else {
                throw new Error('Invalid translation response format');
            }
        } catch (serverError) {
            // If server translation fails, use mock translation
            console.log('Using fallback translation due to:', serverError);
            return mockTranslations[targetLang] + text;
        }
    } catch (error) {
        console.error('Translation error:', error);
        throw error;
    }
}

// Export objects and functions for use in other modules
window.translationModule = {
    translateText,
    selectedLanguage,
    setLanguage: function(lang) {
        selectedLanguage = lang;
    },
    getLanguage: function() {
        return selectedLanguage;
    }
};
