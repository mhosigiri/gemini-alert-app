import { auth, db, rtdb } from '../firebase';
import { collection, addDoc, serverTimestamp, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';
import { ref, push, set, onValue } from 'firebase/database';
import { findNearbyUsers, getCurrentLocation } from './locationService';
import api from '../utils/api';
// Send an emergency alert to nearby users
export const sendEmergencyAlert = async (message, emergencyType) => {
  if (!auth.currentUser) {
    throw new Error('User must be logged in to send alerts');
  }
  try {
    // Get current location
    const position = await getCurrentLocation();
    const { latitude, longitude } = position.coords;
    const userId = auth.currentUser.uid;
    const userName = auth.currentUser.displayName || 'Anonymous';
    // Send SOS via backend API first
    try {
      const backendResponse = await api.post('/api/send-sos', {
        userId,
        latitude,
        longitude,
        message,
        emergencyType
      });
      // If backend succeeds, we can optionally skip Firebase or use it as backup
      if (backendResponse.data.status === 'sos_sent') {
        return {
          success: true,
          alertId: backendResponse.data.alertId,
          notifiedUsers: backendResponse.data.recipients.length
        };
      }
    } catch (backendError) {
      // Continue with Firebase implementation as fallback
    }
    // Create alert in Firestore
    const alertRef = await addDoc(collection(db, 'alerts'), {
      userId,
      userName,
      message,
      emergencyType,
      location: {
        latitude,
        longitude
      },
      status: 'active',
      createdAt: serverTimestamp(),
      helpResponses: []
    });
    // Create alert in Realtime Database for real-time updates
    const rtdbAlertRef = ref(rtdb, `alerts/${alertRef.id}`);
    await set(rtdbAlertRef, {
      userId,
      userName,
      message,
      emergencyType,
      location: {
        latitude,
        longitude
      },
      status: 'active',
      createdAt: Date.now()
    });
    // Find nearby users within 10km radius
    const nearbyUsers = await findNearbyUsers(10);
    if (nearbyUsers.length === 0) {
    } else {
      // Get FCM tokens for these users from Firestore
      const userIds = nearbyUsers.map(user => user.uid);
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('__name__', 'in', userIds));
      const querySnapshot = await getDocs(q);
      // Store the recipients for this alert
      const recipients = [];
      querySnapshot.forEach((doc) => {
        const userData = doc.data();
        if (userData.fcmToken) {
          recipients.push({
            userId: doc.id,
            fcmToken: userData.fcmToken,
            distance: nearbyUsers.find(u => u.uid === doc.id)?.distance || 0
          });
        }
      });
      // Store recipients in the alert document
      if (recipients.length > 0) {
        // Use cloud function to send notifications (will need to be implemented)
        // This would trigger a Firebase Cloud Function that sends the actual FCM notifications
        const notificationsRef = ref(rtdb, 'notifications/send');
        await push(notificationsRef, {
          alertId: alertRef.id,
          sender: {
            userId,
            userName
          },
          recipients: recipients,
          message,
          emergencyType,
          location: {
            latitude,
            longitude
          },
          timestamp: Date.now()
        });
      }
    }
    return { 
      success: true, 
      alertId: alertRef.id,
      notifiedUsers: nearbyUsers.length
    };
  } catch (error) {
    throw error;
  }
};
// Get active alerts near the current user
export const getNearbyAlerts = async (radius = 10) => {
  if (!auth.currentUser) {
    throw new Error('User must be logged in to get nearby alerts');
  }
  try {
    // Get current location first
    const position = await getCurrentLocation();
    const currentLat = position.coords.latitude;
    const currentLng = position.coords.longitude;
    // Get all active alerts from Realtime Database
    const alertsRef = ref(rtdb, 'alerts');
    return new Promise((resolve, reject) => {
      onValue(alertsRef, (snapshot) => {
        const alerts = snapshot.val();
        if (!alerts) {
          resolve([]);
          return;
        }
        
        // Get current time
        const now = Date.now();
        const threeHoursInMs = 3 * 60 * 60 * 1000; // 3 hours in milliseconds
        
        // Filter and format alerts
        const nearbyAlerts = Object.entries(alerts)
          .filter(([, data]) => {
            // Filter out alerts older than 3 hours
            const alertAge = now - data.createdAt;
            return data.status === 'active' && alertAge < threeHoursInMs;
          })
          .map(([alertId, data]) => {
            const distance = calculateDistance(
              currentLat,
              currentLng,
              data.location.latitude,
              data.location.longitude
            );
            return {
              id: alertId,
              userId: data.userId,
              userName: data.userName,
              message: data.message,
              emergencyType: data.emergencyType,
              distance, // in km
              location: data.location,
              createdAt: new Date(data.createdAt),
              isOwnAlert: data.userId === auth.currentUser.uid,
              responses: data.responses || {}
            };
          })
          .filter(alert => alert.distance <= radius)
          .filter(alert => {
            const THIRTY_MIN = 30 * 60 * 1000;
            return Date.now() - alert.createdAt.getTime() <= THIRTY_MIN;
          })
          .sort((a, b) => a.distance - b.distance);
        resolve(nearbyAlerts);
      }, (error) => {
        reject(error);
      });
    });
  } catch (error) {
    throw error;
  }
};
// Respond to an alert (offer help)
export const respondToAlert = async (alertId, message) => {
  if (!auth.currentUser) {
    throw new Error('User must be logged in to respond to alerts');
  }
  try {
    const userId = auth.currentUser.uid;
    const userName = auth.currentUser.displayName || 'Anonymous';
    // Add response to Realtime Database
    const responseRef = ref(rtdb, `alerts/${alertId}/responses/${userId}`);
    await set(responseRef, {
      userId,
      userName,
      message,
      timestamp: Date.now()
    });
    // Add helper to the Firestore document
    const alertRef = doc(db, 'alerts', alertId);
    await updateDoc(alertRef, {
      [`helpResponses.${userId}`]: {
        userId,
        userName,
        message,
        timestamp: serverTimestamp()
      }
    });
    return { success: true };
  } catch (error) {
    throw error;
  }
};
// Helper function to calculate distance between two points
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2); 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  const distance = R * c; // Distance in km
  return distance;
};
const deg2rad = (deg) => {
  return deg * (Math.PI/180);
}; 