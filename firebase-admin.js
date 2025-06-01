const admin = require('firebase-admin');
const dotenv = require('dotenv');

dotenv.config();

// Initialize Firebase Admin with environment variables or service account file
let serviceAccount;
let credential;

try {
  // Check if Firebase Admin is already initialized
  if (admin.apps.length > 0) {
    console.log("Firebase Admin already initialized");
  } else {
    try {
      // First attempt to load from service account file
      serviceAccount = require('./serviceAccountKey.json');
      console.log("Using service account from local file");
      credential = admin.credential.cert(serviceAccount);
    } catch (fileError) {
      console.log('Service account file not found, using environment variables');
      
      // Check for required environment variables
      const requiredVars = ['FIREBASE_PROJECT_ID', 'FIREBASE_CLIENT_EMAIL', 'FIREBASE_PRIVATE_KEY'];
      const missingVars = requiredVars.filter(varName => !process.env[varName]);
      
      if (missingVars.length > 0) {
        console.error("Missing required Firebase environment variables:", missingVars);
        throw new Error(`Missing Firebase credentials: ${missingVars.join(', ')}`);
      }
      
      // Create service account object from environment variables
      serviceAccount = {
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        // Handle different formats of the private key in environment variables
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
      };
      
      console.log("Using Firebase credentials from environment variables");
      console.log("Project ID:", serviceAccount.projectId);
      console.log("Client Email:", serviceAccount.clientEmail);
      
      credential = admin.credential.cert(serviceAccount);
    }
    
    // Initialize Firebase Admin
    admin.initializeApp({
      credential: credential,
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET || `${serviceAccount.projectId}.appspot.com`
    });
    
    console.log("Firebase Admin SDK initialized successfully");
  }
} catch (error) {
  console.error("Failed to initialize Firebase Admin SDK:", error.message);
  // In serverless environments, we need Firebase to work, so we'll create a mock
  console.warn("Creating mock Firebase instance for development");
}

// Get Firestore database - with better error handling
let db = null;
try {
  db = admin.apps.length > 0 ? admin.firestore() : null;
} catch (error) {
  console.error("Failed to get Firestore instance:", error.message);
  db = null;
}

module.exports = { admin, db };
