import { auth, db, rtdb } from '../firebase';
import { doc, setDoc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { ref, set } from 'firebase/database';
/**
 * Create or update a user in Firestore after registration/login
 * This ensures the user has a document in the database
 */
export const ensureUserInDatabase = async (user) => {
  if (!user) return null;
  try {
    // First handle Firestore
    try {
      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);
      // Check if user exists in Firestore
      if (!userSnap.exists()) {
        // Create new user document
        await setDoc(userRef, {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName || user.email.split('@')[0],
          photoURL: user.photoURL || null,
          createdAt: serverTimestamp(),
          lastLoginAt: serverTimestamp()
        });
      } else {
        // Update last login
        await updateDoc(userRef, {
          lastLoginAt: serverTimestamp()
        });
      }
    } catch (firestoreError) {
      // Continue anyway to try RTDB
    }
    // Then handle Realtime Database
    try {
      // Set initial user data in Realtime Database
      const rtdbUserRef = ref(rtdb, `users/${user.uid}`);
      await set(rtdbUserRef, {
        email: user.email,
        displayName: user.displayName || user.email.split('@')[0],
        lastActive: Date.now()
      });
    } catch (rtdbError) {
      // Continue anyway to not block login
    }
    return user;
  } catch (error) {
    // Do not throw the error to prevent login from failing
    return user;
  }
};
/**
 * Update the user's profile data
 */
export const updateUserProfile = async (userData) => {
  if (!auth.currentUser) {
    throw new Error('User must be logged in to update profile');
  }
  try {
    const userRef = doc(db, 'users', auth.currentUser.uid);
    await updateDoc(userRef, {
      ...userData,
      updatedAt: serverTimestamp()
    });
    // Update Realtime Database
    const rtdbUserRef = ref(rtdb, `users/${auth.currentUser.uid}`);
    await set(rtdbUserRef, {
      displayName: userData.displayName || auth.currentUser.displayName,
      email: auth.currentUser.email,
      lastActive: Date.now()
    });
    return true;
  } catch (error) {
    throw error;
  }
};