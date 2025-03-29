// src/firebase.js

import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore, doc, updateDoc } from "firebase/firestore";
import { getDatabase } from "firebase/database";

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBUv1_PFKKTkChLe2QTBR0OS04Z9WxcA34",
  authDomain: "gemini-alert.firebaseapp.com",
  projectId: "gemini-alert",
  storageBucket: "gemini-alert.appspot.com",
  messagingSenderId: "122544434135",
  appId: "1:122544434135:web:7c559f7121eada9fdfb992",
  measurementId: "G-WM9KGWW1DR",
  databaseURL: "https://gemini-alert-default-rtdb.firebaseio.com"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

// Initialize authentication and Firestore
const auth = getAuth(app);
const db = getFirestore(app);
const rtdb = getDatabase(app);

// Initialize messaging as null by default
let messaging = null;

// Conditionally import messaging if in browser environment
if (typeof window !== 'undefined') {
  // Dynamic import for Firebase messaging
  import("firebase/messaging").then(({ getMessaging, getToken, onMessage }) => {
    try {
      // Check if messaging is supported
      if (typeof Notification !== 'undefined' && 'serviceWorker' in navigator) {
        messaging = getMessaging(app);
        
        // Request permission function to be called at the appropriate time
        const requestNotificationPermission = async () => {
          try {
            const permission = await Notification.requestPermission();
            if (permission === 'granted') {
              console.log('Notification permission granted.');
              // Get registration token for FCM
              getToken(messaging, { vapidKey: 'BLb-SF1P5RvQcgLJf899-Yna4xWCQ-_XyBptnXa6joDYrXiTG3ZxDl1I5XlrfdM_nhRq-XBtX3fJ3ryT8t6pUgU' })
                .then((currentToken) => {
                  if (currentToken) {
                    console.log('FCM registration token:', currentToken);
                    // Save the token to the user's document in Firestore
                    if (auth.currentUser) {
                      const uid = auth.currentUser.uid;
                      const userRef = doc(db, 'users', uid);
                      updateDoc(userRef, {
                        fcmToken: currentToken
                      }).catch(err => console.error('Error updating FCM token:', err));
                    }
                  } else {
                    console.log('No registration token available.');
                  }
                })
                .catch((err) => {
                  console.log('An error occurred while getting token:', err);
                });
            } else {
              console.log('Unable to get permission for notifications.');
            }
          } catch (error) {
            console.error('Error requesting notification permission:', error);
          }
        };

        // Expose the function
        window.requestNotificationPermission = requestNotificationPermission;

        // Handle incoming messages when the app is in the foreground
        onMessage(messaging, (payload) => {
          console.log('Message received:', payload);
          // Display notification to the user
          if (payload.notification) {
            const notificationTitle = payload.notification.title || 'Alert';
            const notificationOptions = {
              body: payload.notification.body || 'You have a new alert.',
              icon: '/favicon.ico'
            };

            try {
              new Notification(notificationTitle, notificationOptions);
            } catch (err) {
              console.error('Error showing notification:', err);
            }
          }
        });
      }
    } catch (error) {
      console.error('Firebase messaging not supported:', error);
    }
  }).catch(error => {
    console.error('Error loading messaging module:', error);
  });
}

export { 
  app, 
  auth, 
  db, 
  rtdb, 
  messaging,
  analytics 
}; 