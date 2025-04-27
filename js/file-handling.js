/**
 * File handling module for GlobalTalk chat application with Cloudinary
 */

// Cache DOM elements
const fileButton = document.getElementById('file-button');
const fileInput = document.getElementById('file-input');

// Track selected files
let selectedFiles = [];

/**
 * Upload files to Cloudinary via server with progress tracking
 * @param {Array} files - Array of files to upload
 */
function handleFileUpload(files) {
    if (files.length === 0) return;
    
    console.log(`Attempting to upload ${files.length} file(s):`, files);
    
    // Show upload in progress
    const uploadingMsg = document.createElement('div');
    uploadingMsg.className = 'text-center py-2 text-xs text-blue-400';
    uploadingMsg.textContent = `Uploading ${files.length} file(s)...`;
    window.uiModule.chatContainer.appendChild(uploadingMsg);
    window.uiModule.chatContainer.scrollTop = window.uiModule.chatContainer.scrollHeight;
    
    // Create form data for the file upload
    const formData = new FormData();
    
    // Add user ID to track file ownership
    formData.append('userId', window.socketModule.userId());
    
    Array.from(files).forEach((file) => {
        // Log file info for debugging
        console.log(`Processing file: ${file.name}, type: ${file.type}, size: ${file.size}`);
        
        // Handle special file formats
        let fileToUpload = file;
        
        // Handle APNG files specifically
        if (file.name.toLowerCase().endsWith('.apng')) {
            console.log("Handling APNG file with special MIME type");
            fileToUpload = new File([file], file.name, { type: 'image/apng' });
        } else if (file.name.toLowerCase().endsWith('.png')) {
            console.log("Handling PNG file");
            fileToUpload = new File([file], file.name, { type: 'image/png' });
        }
        
        formData.append('files', fileToUpload);
    });
    
    // Create XMLHttpRequest for progress tracking
    const xhr = new XMLHttpRequest();
    
    // Track upload progress
    xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
            const percent = (event.loaded / event.total) * 100;
            uploadingMsg.textContent = `Uploading ${files.length} file(s)... ${Math.round(percent)}%`;
        }
    });
    
    // Handle completion
    xhr.addEventListener('load', () => {
        console.log("Upload completed. Status:", xhr.status, "Response:", xhr.responseText);
        
        if (xhr.status >= 200 && xhr.status < 300) {
            try {
                const response = JSON.parse(xhr.responseText);
                console.log("Parsed response:", response);
                
                // Remove uploading message
                uploadingMsg.remove();
                
                // Create message with file attachments including URLs
                if (response.files && response.files.length > 0) {
                    createFileShareMessage(response.files, true);
                    
                    // Broadcast file metadata to other users using socket
                    window.socketModule.emitFileShared(response.files);
                } else {
                    console.error("No files in response or empty array");
                    uploadingMsg.textContent = 'Upload completed but no files were processed';
                    uploadingMsg.classList.replace('text-blue-400', 'text-yellow-400');
                }
            } catch (parseError) {
                console.error('Error parsing upload response:', parseError);
                uploadingMsg.textContent = 'Upload failed: Invalid server response';
                uploadingMsg.classList.replace('text-blue-400', 'text-red-400');
            }
        } else {
            try {
                const errorData = JSON.parse(xhr.responseText);
                console.error("Upload error response:", errorData);
                uploadingMsg.textContent = `Upload failed: ${errorData.error || errorData.details || 'Server error'}`;
                uploadingMsg.classList.replace('text-blue-400', 'text-red-400');
            } catch (e) {
                console.error("Error parsing error response:", e);
                uploadingMsg.textContent = `Upload failed (${xhr.status})`;
                uploadingMsg.classList.replace('text-blue-400', 'text-red-400');
            }
        }
    });
    
    // Handle errors
    xhr.addEventListener('error', (e) => {
        console.error("Network error during upload:", e);
        uploadingMsg.textContent = 'Upload failed: Network error occurred';
        uploadingMsg.classList.replace('text-blue-400', 'text-red-400');
    });
    
    xhr.addEventListener('abort', () => {
        console.log("Upload aborted");
        uploadingMsg.textContent = 'Upload cancelled';
        uploadingMsg.classList.replace('text-blue-400', 'text-red-400');
    });
    
    // Send the request
    console.log("Sending upload request to /upload-multiple");
    xhr.open('POST', '/upload-multiple');
    xhr.send(formData);
    
    // Reset file input to allow selecting the same file again
    fileInput.value = '';
}

/**
 * Delete a file from Cloudinary via server
 * @param {string} fileId - ID of the file to delete
 * @param {HTMLElement} fileItemElement - Element to remove on success
 */
async function deleteFile(fileId, fileItemElement) {
    // Show confirmation dialog
    if (!confirm('Are you sure you want to delete this file? This cannot be undone.')) {
        return;
    }
    
    try {
        // Add loading state to the element
        fileItemElement.classList.add('opacity-50');
        const deleteButton = fileItemElement.querySelector('button');
        if (deleteButton) {
            deleteButton.disabled = true;
            deleteButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        }
        
        // Send delete request to server with user ID
        const userId = window.socketModule.userId();
        const response = await fetch(`/file/${fileId}?userId=${userId}`, {
            method: 'DELETE'
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.details || `Delete failed: ${response.status}`);
        }
        
        const result = await response.json();
        console.log('File deleted successfully:', result);
        
        // Remove the file item with animation
        fileItemElement.style.height = fileItemElement.offsetHeight + 'px';
        fileItemElement.classList.add('file-deleting');
        
        setTimeout(() => {
            fileItemElement.style.height = '0';
            fileItemElement.style.opacity = '0';
            fileItemElement.style.margin = '0';
            fileItemElement.style.padding = '0';
            
            setTimeout(() => {
                fileItemElement.remove();
                
                // Check if this was the last file in the container
                const parentContainer = fileItemElement.closest('.files-container');
                if (parentContainer && parentContainer.children.length === 0) {
                    // If it was the last file, remove the entire message
                    const messageBubble = parentContainer.closest('.message-bubble');
                    if (messageBubble) messageBubble.remove();
                }
            }, 300);
        }, 100);
        
    } catch (error) {
        console.error('File deletion error:', error);
        
        // Reset the element's appearance
        fileItemElement.classList.remove('opacity-50');
        const deleteButton = fileItemElement.querySelector('button');
        if (deleteButton) {
            deleteButton.disabled = false;
            deleteButton.innerHTML = '<i class="fas fa-times"></i>';
        }
        
        // Show error notification
        const errorNotification = document.createElement('div');
        errorNotification.className = 'bg-red-500 text-white text-xs p-2 rounded mt-2';
        errorNotification.textContent = `Failed to delete: ${error.message}`;
        fileItemElement.appendChild(errorNotification);
        
        // Auto-remove the error after 5 seconds
        setTimeout(() => {
            errorNotification.remove();
        }, 5000);
    }
}

/**
 * Creates a message with file attachments
 * @param {Array} fileMetadata - Array of file metadata objects 
 * @param {boolean} isUser - Whether the message is from the current user
 * @param {string} senderName - Name of the sender (optional)
 * @param {string} messageId - ID of the message (optional)
 * @param {Date} expiresAt - When the message expires (optional)
 * @returns {HTMLElement} The created message element
 */
function createFileShareMessage(fileMetadata, isUser, senderName = null, messageId = null, expiresAt = null) {
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
        
        // Store file ID for potential deletion
        if (file.fileId) {
            fileItem.dataset.fileId = file.fileId;
        }
        
        // Choose icon based on file type
        let fileIcon = 'fa-file';
        const fileType = file.type || file.mimetype || '';
        const fileName = file.name || '';
        const fileExtension = fileName.split('.').pop().toLowerCase();
        
        // Map file types to icons
        if (fileType.startsWith('image/') || 
            ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'tiff', 'apng', 'avif', 'heic', 'heif'].includes(fileExtension)) {
            fileIcon = 'fa-file-image';
            
            // If we have a URL from the server, show the image
            if (file.url) {
                // For image files, show a preview
                if (fileIcon === 'fa-file-image') {
                    const imgContainer = document.createElement('div');
                    imgContainer.className = 'mb-3 relative';
                    
                    const img = document.createElement('img');
                    img.className = 'max-h-64 rounded-xl object-contain mx-auto shadow-lg';
                    
                    // Always use the complete URL for image sources
                    img.src = file.url; // This should be an absolute URL
                    img.alt = file.name;
                    
                    // Add loading indicator
                    const loadingText = document.createElement('div');
                    loadingText.className = 'text-xs text-center text-slate-400 my-2';
                    loadingText.textContent = 'Loading image...';
                    
                    img.onload = () => loadingText.remove();
                    img.onerror = () => {
                        loadingText.textContent = 'Failed to load image';
                        loadingText.classList.add('text-red-400');
                        console.error('Image load error:', file.url);
                    };
                    
                    imgContainer.appendChild(loadingText);
                    imgContainer.appendChild(img);
                    fileItem.appendChild(imgContainer);
                }
            }
        } else if (fileType.startsWith('video/')) {
            fileIcon = 'fa-file-video';
        } else if (fileType.startsWith('audio/')) {
            fileIcon = 'fa-file-audio';
        } else if (fileType.includes('pdf') || fileExtension === 'pdf') {
            fileIcon = 'fa-file-pdf';
        } else if (fileType.includes('word') || 
                  ['doc', 'docx'].includes(fileExtension)) {
            fileIcon = 'fa-file-word';
        } else if (fileType.includes('excel') || 
                  ['xls', 'xlsx'].includes(fileExtension)) {
            fileIcon = 'fa-file-excel';
        } else if (fileType.includes('text') || 
                  ['txt', 'rtf'].includes(fileExtension)) {
            fileIcon = 'fa-file-lines';
        }
        
        const fileInfoRow = document.createElement('div');
        fileInfoRow.className = 'flex items-center justify-between';
        
        // Left side: file icon and info
        const fileInfoLeft = document.createElement('div');
        fileInfoLeft.className = 'flex items-center flex-1';
        fileInfoLeft.innerHTML = `
            <div class="w-10 h-10 rounded-xl bg-blue-500 bg-opacity-20 flex items-center justify-center mr-3">
                <i class="fas ${fileIcon} text-blue-400"></i>
            </div>
            <div class="flex-grow overflow-hidden">
                <div class="text-sm font-medium text-white truncate">${file.name}</div>
                <div class="text-xs text-slate-400">${formatFileSize(file.size || 0)}</div>
            </div>
        `;
        
        // Right side: delete button (only for user's files)
        if (isUser && file.fileId) {
            const deleteButton = document.createElement('button');
            deleteButton.className = 'ml-2 p-2 rounded-full bg-slate-700 hover:bg-red-500 text-slate-400 hover:text-white transition-colors';
            deleteButton.innerHTML = '<i class="fas fa-times"></i>';
            deleteButton.title = 'Delete file';
            deleteButton.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                deleteFile(file.fileId, fileItem);
            };
            
            fileInfoRow.appendChild(fileInfoLeft);
            fileInfoRow.appendChild(deleteButton);
        } else {
            fileInfoRow.appendChild(fileInfoLeft);
        }
        
        fileItem.appendChild(fileInfoRow);
        
        // Add download button if URL is available
        if (file.url) {
            const downloadLink = document.createElement('a');
            downloadLink.href = file.url; // This should be an absolute URL
            downloadLink.className = 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white py-2 px-4 mt-3 rounded-xl text-xs flex items-center justify-center shadow-lg transition-all';
            downloadLink.innerHTML = '<i class="fas fa-download mr-2"></i> Download File';
            downloadLink.target = '_blank';
            downloadLink.rel = 'noopener noreferrer';
            
            // Add download attribute for better experience
            downloadLink.setAttribute('download', file.name);
            
            fileItem.appendChild(downloadLink);
        }
        
        filesContainer.appendChild(fileItem);
    });
    
    messageContent.appendChild(filesContainer);
    messageDiv.appendChild(messageContent);
    
    // Insert before typing indicator
    window.uiModule.chatContainer.insertBefore(messageDiv, window.uiModule.typingIndicator);
    window.uiModule.chatContainer.scrollTop = window.uiModule.chatContainer.scrollHeight;
    
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
    
    return messageDiv;
}

// Set up file input event listeners
fileButton.addEventListener('click', function() {
    fileInput.click();
});

fileInput.addEventListener('change', function() {
    if (this.files.length > 0) {
        console.log(`Selected ${this.files.length} files for upload`);
        selectedFiles = Array.from(this.files);
        // Send files
        handleFileUpload(selectedFiles);
    }
});

// Add drag and drop support
window.addEventListener('DOMContentLoaded', () => {
    const dropArea = document.querySelector('.chat-container');
    
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
        });
    });
    
    // Highlight drop area
    ['dragenter', 'dragover'].forEach(eventName => {
        dropArea.addEventListener(eventName, () => {
            dropArea.classList.add('file-drag-active');
        });
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, () => {
            dropArea.classList.remove('file-drag-active');
        });
    });
    
    // Handle dropped files
    dropArea.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        
        if (files.length > 0) {
            handleFileUpload(files);
        }
    });
});

// Export objects and functions for use in other modules
window.fileModule = {
    createFileShareMessage,
    handleFileUpload,
    deleteFile
};
