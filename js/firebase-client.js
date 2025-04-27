/**
 * Firebase client integration for GlobalTalk chat application
 */

// Firebase configuration object - using window variables that will be set in index.html
const firebaseConfig = {
  apiKey: window.FIREBASE_API_KEY || null,
  authDomain: window.FIREBASE_AUTH_DOMAIN || null,
  projectId: window.FIREBASE_PROJECT_ID || null,
  storageBucket: window.FIREBASE_STORAGE_BUCKET || null,
  messagingSenderId: window.FIREBASE_MESSAGING_SENDER_ID || null,
  appId: window.FIREBASE_APP_ID || null,
  measurementId: window.FIREBASE_MEASUREMENT_ID || null
};

// Initialize Firebase - use this if not using ES modules
let db, storage;
if (typeof firebase !== 'undefined' && firebaseConfig.apiKey) {
  firebase.initializeApp(firebaseConfig);
  db = firebase.firestore();
  storage = firebase.storage();
  console.log("Firebase initialized successfully");
} else {
  console.warn("Firebase not initialized. Check your configuration.");
}

// Listen for real-time updates to messages
function listenForMessages() {
  if (!db) return;

  const messagesRef = db.collection('messages').orderBy('timestamp', 'desc').limit(50);
  
  // Real-time listener
  return messagesRef.onSnapshot((snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type === 'added') {
        const msg = {
          id: change.doc.id,
          ...change.doc.data(),
          timestamp: change.doc.data().timestamp?.toDate() || new Date()
        };
        
        // Process new message
        console.log('New message:', msg);
        
        // You can integrate this with your existing message handling system
        // or dispatch a custom event
        document.dispatchEvent(new CustomEvent('firebase-new-message', { detail: msg }));
      }
    });
  });
}

// Export Firebase functions for use in other modules
window.firebaseModule = {
  listenForMessages,
  // Add other firebase methods as needed
};
