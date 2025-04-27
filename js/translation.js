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
        // Try server translation first
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
    } catch (error) {
        console.error('Translation error:', error);
        // Just return the original text on failure
        return text;
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
