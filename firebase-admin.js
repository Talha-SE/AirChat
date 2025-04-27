const admin = require('firebase-admin');
const dotenv = require('dotenv');

dotenv.config();

// Initialize Firebase Admin with environment variables or service account file
let serviceAccount;
let credential;

try {
  try {
    // First attempt to load from service account file
    serviceAccount = require('./serviceAccountKey.json');
    console.log("Using service account from local file");
    credential = admin.credential.cert(serviceAccount);
  } catch (fileError) {
    console.log('Service account file not found or invalid, using environment variables');
    
    // Check for required environment variables
    if (!process.env.FIREBASE_PROJECT_ID) {
      console.error("Missing FIREBASE_PROJECT_ID environment variable");
    }
    
    if (!process.env.FIREBASE_CLIENT_EMAIL) {
      console.error("Missing FIREBASE_CLIENT_EMAIL environment variable");
    }
    
    if (!process.env.FIREBASE_PRIVATE_KEY) {
      console.error("Missing FIREBASE_PRIVATE_KEY environment variable");
    } else {
      console.log("FIREBASE_PRIVATE_KEY environment variable found");
    }
    
    // Create service account object from environment variables
    serviceAccount = {
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      // Handle different formats of the private key in environment variables
      privateKey: process.env.FIREBASE_PRIVATE_KEY ? 
                  process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : 
                  undefined
    };
    
    // Debug output for troubleshooting
    console.log("Project ID:", serviceAccount.projectId);
    console.log("Client Email:", serviceAccount.clientEmail);
    console.log("Private Key defined:", !!serviceAccount.privateKey);
    
    // Check for the required properties
    if (!serviceAccount.projectId || !serviceAccount.clientEmail || !serviceAccount.privateKey) {
      throw new Error("Missing required Firebase credentials in environment variables");
    }
    
    credential = admin.credential.cert(serviceAccount);
  }
  
  // Initialize Firebase Admin
  admin.initializeApp({
    credential: credential,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || `${serviceAccount.projectId}.appspot.com`
  });
  
  console.log("Firebase Admin SDK initialized successfully");
} catch (error) {
  console.error("Failed to initialize Firebase Admin SDK:", error);
  // Continue execution without Firebase to allow the app to start
  // This will cause Firebase operations to fail, but the app can still run
}

// Get Firestore database
const db = admin.firestore ? admin.firestore() : null;

module.exports = { admin, db };
