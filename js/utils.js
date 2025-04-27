/**
 * Utility functions for the GlobalTalk chat application
 */

/**
 * Generates a random user ID
 * @returns {string} A unique user ID
 */
function generateUserId() {
    return 'user_' + Math.random().toString(36).substr(2, 9);
}

/**
 * Gets initials from a name
 * @param {string} name - Full name
 * @returns {string} Initials (max 2 characters)
 */
function getInitials(name) {
    if (!name) return 'OT';
    return name.split(' ')
        .map(part => part.charAt(0).toUpperCase())
        .join('')
        .substring(0, 2);
}

/**
 * Format file size in readable format
 * @param {number} bytes - Size in bytes
 * @returns {string} Formatted size string
 */
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Play a notification sound for new messages
 */
function playMessageSound() {
    // Implement sound notification if available
    // For example: new Audio('notification.mp3').play();
    console.log('Message notification sound would play here');
}
