// src/firebase.js

import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth"; // if using Firebase authentication
import { getFirestore } from "firebase/firestore"; // if using Firestore

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBUv1_PFKKTkChLe2QTBR0OS04Z9WxcA34",
  authDomain: "gemini-alert.firebaseapp.com",
  projectId: "gemini-alert",
  storageBucket: "gemini-alert.appspot.com",
  messagingSenderId: "122544434135",
  appId: "1:122544434135:web:7c559f7121eada9fdfb992",
  measurementId: "G-WM9KGWW1DR"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

// Initialize authentication and Firestore
const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db, analytics }; 