/**
 * Firebase client integration for GlobalTalk chat application
 */

// Firebase configuration object
const firebaseConfig = {
  apiKey: "AIzaSyArfInSiPzp-ozNXFOMz99FEiHydPeN5zs",
  authDomain: "w-chat-74ec1.firebaseapp.com",
  projectId: "w-chat-74ec1",
  storageBucket: "w-chat-74ec1.firebasestorage.app",
  messagingSenderId: "974879028384",
  appId: "1:974879028384:web:4d23180119bb49b4cf05c5",
  measurementId: "G-JMFLJ3VS0H"
};

// Initialize Firebase - use this if not using ES modules
let db, storage;
if (typeof firebase !== 'undefined') {
  firebase.initializeApp(firebaseConfig);
  db = firebase.firestore();
  storage = firebase.storage();
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
