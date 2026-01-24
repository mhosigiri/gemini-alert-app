import { auth } from '../firebase';
import api from '../utils/api';

export const ensureUserInDatabase = async (user, extraData = {}) => {
  if (!user) return null;
  try {
    await api.post('/api/users/sync', {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName || (user.email ? user.email.split('@')[0] : 'User'),
      photoURL: user.photoURL || null,
      ...extraData
    });
  } catch (error) {
    console.warn('[UserService] Failed to sync user profile', error);
  }
  return user;
};

export const updateUserProfile = async (userData = {}) => {
  if (!auth.currentUser) {
    throw new Error('User must be logged in to update profile');
  }
  try {
    await api.post('/api/users/sync', {
      uid: auth.currentUser.uid,
      email: auth.currentUser.email,
      displayName: userData.displayName,
      photoURL: userData.photoURL,
      phoneNumber: userData.phoneNumber,
      address: userData.address
    });
    return true;
  } catch (error) {
    console.error('[UserService] Failed to update profile', error);
    throw error;
  }
};
