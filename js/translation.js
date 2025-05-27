/**
 * Translation module for GlobalTalk chat application
 */

// Store selected language
let selectedLanguage = localStorage.getItem('preferred_language') || ''; // No default language

// Simple translation cache
const translationCache = new Map();

/**
 * Translates text to the specified target language
 * @param {string} text - Text to translate
 * @param {string} targetLang - Target language code
 * @returns {Promise<object>} Translated text and source information
 */
async function translateText(text, targetLang) {
    console.log(`Requesting translation to ${targetLang}: "${text}"`);
    
    if (!targetLang || targetLang === '') {
        return Promise.resolve({ translation: text, source: null }); // No translation needed
    }
    
    // Check cache first
    const cacheKey = `${text}|${targetLang}`;
    if (translationCache.has(cacheKey)) {
        console.log('Using cached translation');
        return translationCache.get(cacheKey);
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
            const result = {
                translation: data.translation,
                source: data.source || 'Unknown'
            };
            
            // Cache the result
            translationCache.set(cacheKey, result);
            
            return result;
        } else {
            throw new Error('Invalid translation response format');
        }
    } catch (error) {
        console.error('Translation error:', error);
        // Just return the original text on failure
        return { translation: text, source: null };
    }
}

/**
 * Clears the translation cache
 */
function clearTranslationCache() {
    console.log('Clearing translation cache');
    translationCache.clear();
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
    },
    clearCache: clearTranslationCache
};
