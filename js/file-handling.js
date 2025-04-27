/**
 * File handling module for GlobalTalk chat application
 */

// Cache DOM elements
const fileButton = document.getElementById('file-button');
const fileInput = document.getElementById('file-input');

// Track selected files
let selectedFiles = [];

/**
 * Creates a message with file attachments
 * @param {Array} fileMetadata - Array of file metadata objects 
 * @param {boolean} isUser - Whether the message is from the current user
 * @param {string} senderName - Name of the sender (optional)
 * @returns {HTMLElement} The created message element
 */
function createFileShareMessage(fileMetadata, isUser, senderName = null) {
    const now = new Date();
    const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message-bubble ${isUser ? 'user-message' : 'other-message'} w-fit`;
    
    const messageContent = document.createElement('div');
    messageContent.className = 'message-content';
    
    // Create message header
    const messageHeader = document.createElement('div');
    messageHeader.className = 'message-header';
    
    if (isUser) {
        messageHeader.innerHTML = `
            <div class="sender-info">
                <div class="user-avatar">ME</div>
                <div class="sender-name">You</div>
            </div>
            <span class="message-time">${timeString}</span>
        `;
    } else {
        const initials = senderName ? getInitials(senderName) : 'OT';
        messageHeader.innerHTML = `
            <div class="sender-info">
                <div class="other-avatar">${initials}</div>
                <div class="sender-name">${senderName || 'Other User'}</div>
            </div>
            <span class="message-time">${timeString}</span>
        `;
    }
    
    messageContent.appendChild(messageHeader);
    
    // Add file attachments
    const filesContainer = document.createElement('div');
    filesContainer.className = 'files-container';
    
    fileMetadata.forEach(file => {
        const fileItem = document.createElement('div');
        fileItem.className = 'file-item flex flex-col p-3 mb-2 bg-opacity-50 rounded-lg';
        
        // Choose icon based on file type
        let fileIcon = 'fa-file';
        const fileType = file.type || file.mimetype || '';
        const fileName = file.name || '';
        
        if (fileType.startsWith('image/') || 
            fileName.toLowerCase().endsWith('.png') || 
            fileName.toLowerCase().endsWith('.jpg') ||
            fileName.toLowerCase().endsWith('.jpeg') ||
            fileName.toLowerCase().endsWith('.gif') ||
            fileName.toLowerCase().endsWith('.apng')) {
            fileIcon = 'fa-file-image';
            
            // If we have a URL from the server, show the image
            if (file.url) {
                const imgContainer = document.createElement('div');
                imgContainer.className = 'mb-3';
                
                const img = document.createElement('img');
                img.className = 'max-h-64 rounded-xl object-contain mx-auto shadow-lg';
                img.src = file.url || file.fullUrl;
                img.alt = file.name;
                
                // Add loading indicator
                const loadingText = document.createElement('div');
                loadingText.className = 'text-xs text-center text-slate-400 my-2';
                loadingText.textContent = 'Loading image...';
                
                img.onload = () => loadingText.remove();
                img.onerror = () => {
                    loadingText.textContent = 'Failed to load image';
                    loadingText.classList.add('text-red-400');
                };
                
                imgContainer.appendChild(loadingText);
                imgContainer.appendChild(img);
                fileItem.appendChild(imgContainer);
            }
        } else if (fileType.startsWith('video/')) {
            fileIcon = 'fa-file-video';
        } else if (fileType.startsWith('audio/')) {
            fileIcon = 'fa-file-audio';
        } else if (fileType.includes('pdf')) {
            fileIcon = 'fa-file-pdf';
        } else if (fileType.includes('word') || 
                  fileName.endsWith('.doc') || 
                  fileName.endsWith('.docx')) {
            fileIcon = 'fa-file-word';
        }
        
        const fileInfoRow = document.createElement('div');
        fileInfoRow.className = 'flex items-center';
        
        fileInfoRow.innerHTML = `
            <div class="w-10 h-10 rounded-xl bg-blue-500 bg-opacity-20 flex items-center justify-center mr-3">
                <i class="fas ${fileIcon} text-blue-400"></i>
            </div>
            <div class="flex-grow overflow-hidden">
                <div class="text-sm font-medium text-white truncate">${file.name}</div>
                <div class="text-xs text-slate-400">${formatFileSize(file.size || 0)}</div>
            </div>
        `;
        
        fileItem.appendChild(fileInfoRow);
        
        // Add download button if URL is available
        if (file.url) {
            const downloadLink = document.createElement('a');
            downloadLink.href = file.url || file.fullUrl;
            downloadLink.className = 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white py-2 px-4 mt-3 rounded-xl text-xs flex items-center justify-center shadow-lg transition-all';
            downloadLink.innerHTML = '<i class="fas fa-download mr-2"></i> Download File';
            downloadLink.target = '_blank';
            downloadLink.rel = 'noopener noreferrer';
            fileItem.appendChild(downloadLink);
        }
        
        filesContainer.appendChild(fileItem);
    });
    
    messageContent.appendChild(filesContainer);
    messageDiv.appendChild(messageContent);
    
    // Insert before typing indicator
    window.uiModule.chatContainer.insertBefore(messageDiv, window.uiModule.typingIndicator);
    window.uiModule.chatContainer.scrollTop = window.uiModule.chatContainer.scrollHeight;
    
    return messageDiv;
}

/**
 * Upload files to server and handle response
 * @param {Array} files - Array of files to upload
 */
async function handleFileUpload(files) {
    if (files.length === 0) return;
    
    // Show upload in progress
    const uploadingMsg = document.createElement('div');
    uploadingMsg.className = 'text-center py-2 text-xs text-blue-400';
    uploadingMsg.textContent = `Uploading ${files.length} file(s)...`;
    window.uiModule.chatContainer.appendChild(uploadingMsg);
    window.uiModule.chatContainer.scrollTop = window.uiModule.chatContainer.scrollHeight;
    
    try {
        // Create form data for the file upload
        const formData = new FormData();
        Array.from(files).forEach((file) => {
            // Handle APNG files specifically
            if (file.name.toLowerCase().endswith('.apng') || file.name.toLowerCase().endswith('.png')) {
                const renamedFile = new File([file], file.name, { 
                    type: file.name.toLowerCase().endswith('.apng') ? 'image/apng' : 'image/png' 
                });
                formData.append('files', renamedFile);
            } else {
                formData.append('files', file);
            }
        });
        
        // Upload files to server
        const response = await fetch('/upload-multiple', {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.details || `Upload failed: ${response.status}`);
        }
        
        const result = await response.json();
        
        // Remove uploading message
        window.uiModule.chatContainer.removeChild(uploadingMsg);
        
        // Create message with file attachments including URLs
        const userMessageElement = createFileShareMessage(result.files, true);
        
        // Broadcast file metadata to other users using socket
        window.socketModule.emitFileShared(result.files);
        
    } catch (error) {
        console.error('File upload error:', error);
        uploadingMsg.textContent = `Upload failed: ${error.message}`;
        uploadingMsg.classList.replace('text-blue-400', 'text-red-400');
    }
}

// Set up file input event listeners
fileButton.addEventListener('click', function() {
    fileInput.click();
});

fileInput.addEventListener('change', function() {
    if (this.files.length > 0) {
        selectedFiles = Array.from(this.files);
        // Send files immediately
        handleFileUpload(selectedFiles);
        // Reset input to allow selecting the same file again
        this.value = '';
    }
});

// Export objects and functions for use in other modules
window.fileModule = {
    createFileShareMessage,
    handleFileUpload
};
