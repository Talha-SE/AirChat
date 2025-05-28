/**
 * Translation module for GlobalTalk chat application
 */

// Store selected language
let selectedLanguage = localStorage.getItem('preferred_language') || ''; // No default language

// Store tone understanding preference
let toneUnderstanding = localStorage.getItem('tone_understanding') === 'true' || false;

// Simple translation cache
const translationCache = new Map();

/**
 * Translates text to the specified target language
 * @param {string} text - Text to translate
 * @param {string} targetLang - Target language code
 * @returns {Promise<object>} Translated text and source information
 */
async function translateText(text, targetLang) {
    // Validate inputs to prevent unexpected behavior
    if (!text || typeof text !== 'string' || text.trim() === '') {
        console.warn('Empty or invalid text provided for translation');
        return Promise.resolve({ translation: text, source: null });
    }
    
    if (!targetLang || typeof targetLang !== 'string' || targetLang.trim() === '') {
        console.warn('No target language specified, skipping translation');
        return Promise.resolve({ translation: text, source: null });
    }
    
    // Normalize language code to uppercase for consistency
    const normalizedTargetLang = targetLang.toUpperCase();
    
    console.log(`Requesting translation to ${normalizedTargetLang}: "${text}"`);
    
    // Check cache first - only if tone understanding is disabled
    // When tone understanding is enabled, we skip cache to ensure context-aware translations
    const cacheKey = `${text}|${normalizedTargetLang}|${toneUnderstanding ? 'tone' : 'basic'}`;
    if (!toneUnderstanding && translationCache.has(cacheKey)) {
        console.log('Using cached translation');
        return translationCache.get(cacheKey);
    }
    
    try {
        // Try server translation
        const response = await fetch('/translate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                text: text,
                targetLang: normalizedTargetLang, // Ensure consistent format
                toneUnderstanding: toneUnderstanding // Pass tone understanding preference
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
                source: data.source || 'Unknown',
                tone: data.tone || null // Include tone information if available
            };
            
            // Log successful translation for debugging
            console.log(`Successfully translated to ${normalizedTargetLang} using ${result.source}`);
            if (result.tone) {
                console.log(`Message tone identified as: ${result.tone}`);
            }
            
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

/**
 * Set tone understanding preference
 * @param {boolean} enabled - Whether tone understanding is enabled
 */
function setToneUnderstanding(enabled) {
    toneUnderstanding = enabled;
    localStorage.setItem('tone_understanding', enabled);
    console.log(`Tone understanding ${enabled ? 'enabled' : 'disabled'}`);
    // Clear cache when changing tone understanding setting
    clearTranslationCache();
}

// Export objects and functions for use in other modules
window.translationModule = {
    translateText,
    selectedLanguage,
    setLanguage: function(lang) {
        selectedLanguage = lang;
        console.log(`Language preference set to: ${lang}`);
    },
    getLanguage: function() {
        return selectedLanguage;
    },
    clearCache: clearTranslationCache,
    setToneUnderstanding: setToneUnderstanding,
    isToneUnderstandingEnabled: function() {
        return toneUnderstanding;
    }
};
