// Firebase client configuration
const firebaseConfig = {
  apiKey: "AIzaSyArfInSiPzp-ozNXFOMz99FEiHydPeN5zs",
  authDomain: "w-chat-74ec1.firebaseapp.com",
  projectId: "w-chat-74ec1",
  storageBucket: "w-chat-74ec1.firebasestorage.app",
  messagingSenderId: "974879028384",
  appId: "1:974879028384:web:4d23180119bb49b4cf05c5",
  measurementId: "G-JMFLJ3VS0H"
};

// Initialize Firebase for client-side
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Initialize Firebase
const firebaseApp = initializeApp(firebaseConfig);

// Initialize services
const db = getFirestore(firebaseApp);
const storage = getStorage(firebaseApp);

export { db, storage, firebaseApp };
