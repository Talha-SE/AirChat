const admin = require('firebase-admin');
const dotenv = require('dotenv');

dotenv.config();

// Use environment variables directly for deployment compatibility
const credential = admin.credential.cert({
  projectId: process.env.FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  // The private key must be replaced because ENV vars often break the format
  privateKey: process.env.FIREBASE_PRIVATE_KEY ? 
              process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : 
              undefined
});

// Initialize Firebase Admin
admin.initializeApp({
  credential: credential,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET
});

// Get Firestore database
const db = admin.firestore();

module.exports = { admin, db };
