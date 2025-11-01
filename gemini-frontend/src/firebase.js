import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getDatabase } from 'firebase/database';
import { getAnalytics, isSupported } from 'firebase/analytics';

const firebaseConfig = {
  apiKey: process.env.VUE_APP_FIREBASE_API_KEY,
  authDomain: process.env.VUE_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VUE_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VUE_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VUE_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VUE_APP_FIREBASE_APP_ID,
  measurementId: process.env.VUE_APP_FIREBASE_MEASUREMENT_ID
};

const missingConfigKeys = Object.entries({
  VUE_APP_FIREBASE_API_KEY: firebaseConfig.apiKey,
  VUE_APP_FIREBASE_AUTH_DOMAIN: firebaseConfig.authDomain,
  VUE_APP_FIREBASE_PROJECT_ID: firebaseConfig.projectId,
  VUE_APP_FIREBASE_STORAGE_BUCKET: firebaseConfig.storageBucket,
  VUE_APP_FIREBASE_MESSAGING_SENDER_ID: firebaseConfig.messagingSenderId,
  VUE_APP_FIREBASE_APP_ID: firebaseConfig.appId
}).filter(([, value]) => !value).map(([key]) => key);

if (missingConfigKeys.length && typeof console !== 'undefined') {
  console.warn(
    `[Firebase] Missing environment variables: ${missingConfigKeys.join(', ')}`
  );
}

const app = initializeApp(firebaseConfig);

const auth = getAuth(app);
const db = getFirestore(app);
const rtdb = getDatabase(app);

let analytics = null;

if (typeof window !== 'undefined') {
  isSupported()
    .then((supported) => {
      if (supported && firebaseConfig.measurementId) {
        analytics = getAnalytics(app);
      }
    })
    .catch((error) => {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[Firebase] Analytics not supported in this environment.', error);
      }
    });
}

export { app, auth, db, rtdb, analytics };
