/**
 * Translation module for GlobalTalk chat application
 */

// Store selected language
let selectedLanguage = localStorage.getItem('preferred_language') || 'EN'; // Default to English

/**
 * Translates text to the specified target language
 * @param {string} text - Text to translate
 * @param {string} targetLang - Target language code
 * @returns {Promise<string>} Translated text
 */
async function translateText(text, targetLang) {
    console.log(`Requesting translation to ${targetLang}: "${text}"`);
    
    try {
        // Mock translations as fallback
        const mockTranslations = {
            'EN': 'English: ',
            'ES': 'Español: ',
            'FR': 'Français: ',
            'DE': 'Deutsch: ',
            'IT': 'Italiano: ',
            'JA': '日本語: ',
            'KO': '한국어: '
        };
        
        // Try server translation first
        try {
            const response = await fetch('/translate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    text: text,
                    targetLang: targetLang
                })
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
