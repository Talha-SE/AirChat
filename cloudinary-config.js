const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');
const dotenv = require('dotenv');

dotenv.config();

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Configure storage
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'chat_files',
    resource_type: 'auto', // auto-detect file type
    public_id: (req, file) => `${Date.now()}_${file.originalname.replace(/\s+/g, '_')}`,
    // Optional upload preset for client-side security
    upload_preset: process.env.CLOUDINARY_UPLOAD_PRESET || undefined
  }
});

// Configure upload middleware
const upload = multer({ 
  storage: storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB limit
  fileFilter: (req, file, cb) => {
    // Check for allowed file types
    const allowedMimeTypes = [
      // All image formats
      'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml', 
      'image/bmp', 'image/tiff', 'image/apng', 'image/avif', 'image/heic', 'image/heif',
      
      // Document formats
      'application/msword', 
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/pdf',
      'text/plain',
      'application/rtf'
    ];
  
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('File type not allowed'), false);
    }
  }
});

module.exports = { cloudinary, upload };
