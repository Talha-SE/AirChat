const admin = require('firebase-admin');
const dotenv = require('dotenv');

dotenv.config();

// Check if service account key exists
let credential;
try {
  const serviceAccount = require('./serviceAccountKey.json');
  credential = admin.credential.cert(serviceAccount);
} catch (error) {
  console.log('Service account file not found, using environment variables');
  // Use environment variables if service account file is not available
  credential = admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID || "w-chat-74ec1",
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL || `firebase-adminsdk@w-chat-74ec1.iam.gserviceaccount.com`,
    // The private key must be replaced because ENV vars often break the format
    privateKey: process.env.FIREBASE_PRIVATE_KEY ? 
                process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : 
                undefined
  });
}

// Initialize Firebase Admin
admin.initializeApp({
  credential: credential,
  projectId: process.env.FIREBASE_PROJECT_ID || "w-chat-74ec1",
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "w-chat-74ec1.firebasestorage.app"
});

// Get Firestore database
const db = admin.firestore();

module.exports = { admin, db };
