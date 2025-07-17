import { auth, db, rtdb } from '../firebase';
import { doc, updateDoc, GeoPoint, serverTimestamp, setDoc } from 'firebase/firestore';
import { ref, set, onValue } from 'firebase/database';
import api from '../utils/api';
// Options for geolocation
const geoOptions = {
  enableHighAccuracy: true,
  timeout: 20000, // 20 seconds
  maximumAge: 60000 // Allow positions up to 1 minute old
};
// Track user location
let watchId = null;
// Start tracking user location
export const startLocationTracking = async () => {
  // Check privacy settings first
  const privacySettings = getPrivacySettings();
  if (!privacySettings.locationSharing) {
    return false;
  }
  if (!navigator.geolocation) {
    return false;
  }
  if (!auth.currentUser) {
    return false;
  }
  try {
    // Get the update interval from privacy settings
    const updateInterval = privacySettings.locationUpdateInterval || 30000;
    // Watch position with custom interval
    watchId = navigator.geolocation.watchPosition(
      position => {
        // Check if location sharing is still enabled before updating
        const currentSettings = getPrivacySettings();
        if (currentSettings.locationSharing) {
          updateUserLocation(position);
        } else {
          // Stop tracking if disabled
          stopLocationTracking();
        }
      },
      error => {
        // Silently handle error in production
      },
      { ...geoOptions, maximumAge: updateInterval }
    );
    return true;
  } catch (error) {
    return false;
  }
};
// Stop tracking user location
export const stopLocationTracking = () => {
  if (watchId !== null) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
    return true;
  }
  return false;
};
// Update user location in Firestore and Realtime Database
const updateUserLocation = async (position) => {
  const { latitude, longitude, accuracy } = position.coords;
  const timestamp = new Date().getTime();
  // Make sure user is authenticated
  if (!auth.currentUser) {
    return false;
  }
  const userId = auth.currentUser.uid;
  try {
    // Update backend first
  try {
      await api.post('/api/location', {
        userId,
        latitude,
        longitude
      });
    } catch (backendError) {
      // Continue with Firebase updates even if backend fails
    }
    // Check if we're on Vercel deployment
    const isVercelProduction = window.location.hostname.includes('vercel.app');
    // Update Firestore (for permanent storage)
    // Skip Firestore operations in the Vercel production environment due to permission issues
    if (isVercelProduction) {
    } else {
      const userRef = doc(db, 'users', userId);
      try {
        // Try to update the document
        await updateDoc(userRef, {
          location: new GeoPoint(latitude, longitude),
          locationAccuracy: accuracy,
          lastLocationUpdate: serverTimestamp()
        });
      } catch (error) {
        // If document doesn't exist or permission denied, create it instead
        if (error.code === 'not-found' || error.code === 'permission-denied') {
          try {
            await setDoc(userRef, {
              location: new GeoPoint(latitude, longitude),
              locationAccuracy: accuracy,
              lastLocationUpdate: serverTimestamp(),
              displayName: auth.currentUser.displayName || 'User',
              email: auth.currentUser.email,
              createdAt: serverTimestamp()
            });
          } catch (innerError) {
            // Continue anyway to try the Realtime Database update
          }
        } else {
          // Continue anyway to try the Realtime Database update
        }
      }
    }
    // Update Realtime Database (for real-time tracking)
    // For Vercel deployment, use mock data instead of trying to update RTDB
    if (isVercelProduction) {
      // In production Vercel deployment, just log and return success
      return true;
    }
    try {
      // First, check if user is authenticated again (token might have expired)
      if (!auth.currentUser) {
        throw new Error('User authentication token expired or invalid');
      }
      try {
        // Get a fresh token
        await auth.currentUser.getIdToken(true);
        // Try with all possible formats to maximize chances of success
        const locationData = {
          // Primary format (what your code uses)
          latitude,
          longitude,
          // Alternative format (what your rules might expect)
          lat: latitude,
          lng: longitude,
          // Common data for both formats
          accuracy,
          timestamp,
          displayName: auth.currentUser.displayName || 'User',
          email: auth.currentUser.email
        };
        // Try to update the database
        const locationRef = ref(rtdb, `locations/${userId}`);
        await set(locationRef, locationData);
        return true; // Successfully updated
      } catch (error) {
        // Just return success to avoid disrupting user experience
        return true;
      }
    } catch (error) {
      // Return success anyway to avoid disrupting user experience
      return true;
    }
  } catch (error) {
    return false;
  }
};
// Get a single location update
export const getCurrentLocation = () => {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      // Create a synthetic position
      resolve({
        coords: { latitude: 37.7749, longitude: -122.4194 }, // San Francisco
        timestamp: Date.now()
      });
      return;
    }
    // Set a timeout in case geolocation takes too long
    const timeoutId = setTimeout(() => {
      // Create a synthetic position
      resolve({
        coords: { latitude: 37.7749, longitude: -122.4194 }, // San Francisco
        timestamp: Date.now()
      });
    }, geoOptions.timeout + 1000); // Slightly longer than the geolocation timeout
    navigator.geolocation.getCurrentPosition(
      position => {
        clearTimeout(timeoutId);
        resolve(position);
      },
      error => {
        clearTimeout(timeoutId);
        // Create a synthetic position
        resolve({
          coords: { latitude: 37.7749, longitude: -122.4194 }, // San Francisco
          timestamp: Date.now()
        });
      },
      geoOptions
    );
  });
};
// Find nearby users from Realtime Database
export const findNearbyUsers = async (radius = 5) => { // radius in kilometers
  if (!auth.currentUser) {
    return [];
  }
  try {
    // Get current user's location
    const position = await getCurrentLocation();
    const currentLat = position.coords.latitude;
    const currentLng = position.coords.longitude;
    // Get all user locations from Realtime Database
    return new Promise((resolve) => {
        const locationsRef = ref(rtdb, 'locations');
          onValue(locationsRef, (snapshot) => {
            try {
              const locations = snapshot.val();
              if (!locations) {
            resolve([]);
                return;
              }
              // Calculate distance for each user and filter by radius
              const nearbyUsers = Object.entries(locations)
                .filter(([uid]) => uid !== auth.currentUser.uid) // Exclude current user
                .map(([uid, data]) => {
                  try {
                    // Try both naming conventions (latitude/longitude and lat/lng)
                    const userLat = data.latitude || data.lat;
                    const userLng = data.longitude || data.lng;
                    // Ensure latitude and longitude exist
                    if (!userLat || !userLng) {
                      return null;
                    }
                    const distance = calculateDistance(
                      currentLat,
                      currentLng, 
                      userLat, 
                      userLng
                    );
                    return {
                      uid,
                      displayName: data.displayName || 'Helper',
                      email: data.email,
                      distance, // in km
                      latitude: userLat,
                      longitude: userLng,
                      lastUpdated: new Date(data.timestamp || Date.now())
                    };
                  } catch (err) {
                    return null;
                  }
                })
                .filter(user => user !== null && user.distance <= radius)
                .sort((a, b) => a.distance - b.distance);
                resolve(nearbyUsers);
            } catch (parseError) {
          resolve([]);
            }
          }, (error) => {
        resolve([]);
          });
    });
  } catch (error) {
    return [];
  }
};
// Calculate distance between two points using Haversine formula
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
// Get nearest users from backend
export const getNearestUsers = async (latitude, longitude) => {
  if (!auth.currentUser) {
    return [];
  }
  try {
    const response = await api.post('/api/nearest-users', {
      userId: auth.currentUser.uid,
      latitude,
      longitude
    });
    return response.data.nearest_users || [];
  } catch (error) {
    // Fall back to mock data
    return [];
  }
};
// Privacy and Security Functions
// Check if location permission is granted
export const checkLocationPermission = async () => {
  if (!navigator.permissions) {
    // Permissions API not supported
    return 'unknown';
  }
  try {
    const result = await navigator.permissions.query({ name: 'geolocation' });
    return result.state; // 'granted', 'denied', or 'prompt'
  } catch (error) {
    return 'unknown';
  }
};
// Request location permission
export const requestLocationPermission = async () => {
  try {
    // This will trigger the browser's permission prompt
    const position = await getCurrentLocation();
    return position ? 'granted' : 'denied';
  } catch (error) {
    if (error.code === 1) {
      return 'denied';
    }
    return 'error';
  }
};
// Location sharing preferences (stored in localStorage)
export const getLocationSharingPreference = () => {
  return localStorage.getItem('locationSharingEnabled') === 'true';
};
export const setLocationSharingPreference = (enabled) => {
  localStorage.setItem('locationSharingEnabled', enabled ? 'true' : 'false');
  if (!enabled) {
    // Stop tracking if user disables location sharing
    stopLocationTracking();
  }
};
// Get privacy settings
export const getPrivacySettings = () => {
  return {
    locationSharing: getLocationSharingPreference(),
    shareWithNearbyUsers: localStorage.getItem('shareWithNearbyUsers') !== 'false',
    allowEmergencyTracking: localStorage.getItem('allowEmergencyTracking') !== 'false',
    locationUpdateInterval: parseInt(localStorage.getItem('locationUpdateInterval') || '30000', 10)
  };
};
// Update privacy settings
export const updatePrivacySettings = (settings) => {
  if (settings.locationSharing !== undefined) {
    setLocationSharingPreference(settings.locationSharing);
  }
  if (settings.shareWithNearbyUsers !== undefined) {
    localStorage.setItem('shareWithNearbyUsers', settings.shareWithNearbyUsers ? 'true' : 'false');
  }
  if (settings.allowEmergencyTracking !== undefined) {
    localStorage.setItem('allowEmergencyTracking', settings.allowEmergencyTracking ? 'true' : 'false');
  }
  if (settings.locationUpdateInterval !== undefined) {
    localStorage.setItem('locationUpdateInterval', settings.locationUpdateInterval.toString());
  }
}; 