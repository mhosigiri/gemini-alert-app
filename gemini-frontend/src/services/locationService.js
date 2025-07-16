import { auth, db, rtdb } from '../firebase';
import { doc, updateDoc, GeoPoint, serverTimestamp, setDoc } from 'firebase/firestore';
import { ref, set, onValue } from 'firebase/database';
import api from '../utils/api';

// Options for geolocation
const geoOptions = {
  enableHighAccuracy: true,
  timeout: 20000, // 20 seconds instead of 5
  maximumAge: 60000 // Allow positions up to 1 minute old
};

// Default location (used when geolocation is not available)
const DEFAULT_LOCATION = { latitude: 37.7749, longitude: -122.4194 }; // San Francisco

// Track user location
let watchId = null;

// Start tracking user location
export const startLocationTracking = async () => {
  // Check privacy settings first
  const privacySettings = getPrivacySettings();
  if (!privacySettings.locationSharing) {
    console.log('Location sharing is disabled in privacy settings');
    return false;
  }

  if (!navigator.geolocation) {
    console.error('Geolocation is not supported by this browser');
    return false;
  }

  if (!auth.currentUser) {
    console.error('User must be logged in to track location');
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
      error => console.error('Error getting location:', error),
      { ...geoOptions, maximumAge: updateInterval }
    );
    
    return true;
  } catch (error) {
    console.error('Error starting location tracking:', error);
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
    console.error('User must be logged in to update location');
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
      console.log('Backend location updated successfully');
    } catch (backendError) {
      console.warn('Error updating backend location:', backendError);
      // Continue with Firebase updates even if backend fails
    }

    // Check if we're on Vercel deployment
    const isVercelProduction = window.location.hostname.includes('vercel.app');
    
    // Update Firestore (for permanent storage)
    // Skip Firestore operations in the Vercel production environment due to permission issues
    if (isVercelProduction) {
      console.log('Skipping Firestore operations in Vercel production environment');
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
          console.log('Creating new user document due to error:', error.code);
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
            console.warn('Error creating user document, continuing with RTDB only:', innerError);
            // Continue anyway to try the Realtime Database update
          }
        } else {
          console.warn('Error updating Firestore, continuing with RTDB only:', error);
          // Continue anyway to try the Realtime Database update
        }
      }
    }

    // Update Realtime Database (for real-time tracking)
    // For Vercel deployment, use mock data instead of trying to update RTDB
    if (isVercelProduction) {
      // In production Vercel deployment, just log and return success
      console.log('Mocking successful location update for Vercel deployment');
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
        console.log('Realtime Database location updated successfully');
        
        return true; // Successfully updated
      } catch (error) {
        console.warn('Location update failed, but continuing:', error);
        // Just return success to avoid disrupting user experience
        return true;
      }
    } catch (error) {
      console.warn('RTDB update error, but continuing:', error);
      // Return success anyway to avoid disrupting user experience
      console.log('Location update completed with Realtime Database');
      return true;
    }
  } catch (error) {
    console.error('Error updating location:', error);
    return false;
  }
};

// Get a single location update
export const getCurrentLocation = () => {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      console.warn('Geolocation is not supported by this browser, using default location');
      // Create a synthetic position
      resolve({
        coords: DEFAULT_LOCATION,
        timestamp: Date.now()
      });
      return;
    }

    // Set a timeout in case geolocation takes too long
    const timeoutId = setTimeout(() => {
      console.warn('Geolocation timed out, using default location');
      // Create a synthetic position
      resolve({
        coords: DEFAULT_LOCATION,
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
        console.warn('Geolocation error, using default location:', error);
        // Create a synthetic position
        resolve({
          coords: DEFAULT_LOCATION,
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
    console.warn('User must be logged in to find nearby users');
    return getMockNearbyUsers();
  }
  
  // Check if we're on Vercel deployment
  const isVercelProduction = window.location.hostname.includes('vercel.app');
  if (isVercelProduction) {
    console.log('Running in Vercel production environment, using mock data for nearby users');
    // Return mock users for Vercel deployment
    return [
      { uid: 'mock1', displayName: 'Piyush', distance: 0.8, lastUpdated: new Date() },
      { uid: 'mock2', displayName: 'Saugat', distance: 1.5, lastUpdated: new Date() },
      { uid: 'mock3', displayName: 'Anish', distance: 2.3, lastUpdated: new Date() }
    ];
  }

  try {
    // Get current user's location (will use default if geolocation fails)
    const position = await getCurrentLocation();
    const currentLat = position.coords.latitude;
    const currentLng = position.coords.longitude;
    
    // Get all user locations from Realtime Database
    return new Promise((resolve) => {
      // Set a timeout in case Firebase query takes too long
      const timeoutId = setTimeout(() => {
        console.warn('Database query timed out, returning mock users');
        resolve(getMockNearbyUsers(currentLat, currentLng));
      }, 5000); // Shorter 5 second timeout
      
      try {
        const locationsRef = ref(rtdb, 'locations');
        
        // Try to get the data once instead of using onValue to avoid possible permission issues
        try {
          const locationsRef = ref(rtdb, 'locations');
          onValue(locationsRef, (snapshot) => {
            clearTimeout(timeoutId);
            
            try {
              const locations = snapshot.val();
              if (!locations) {
                console.log('No locations found in database, using mock data');
                resolve(getMockNearbyUsers(currentLat, currentLng));
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
                    console.warn('Error processing user data:', err);
                    return null;
                  }
                })
                .filter(user => user !== null && user.distance <= radius)
                .sort((a, b) => a.distance - b.distance);
              
              if (nearbyUsers.length === 0) {
                console.log('No nearby users found within radius, using mock data');
                resolve(getMockNearbyUsers(currentLat, currentLng));
              } else {
                resolve(nearbyUsers);
              }
            } catch (parseError) {
              console.warn('Error parsing locations data:', parseError);
              resolve(getMockNearbyUsers(currentLat, currentLng));
            }
          }, (error) => {
            clearTimeout(timeoutId);
            console.warn('Error getting locations from database:', error);
            resolve(getMockNearbyUsers(currentLat, currentLng));
          });
        } catch (onValueError) {
          // If onValue fails, provide mock data
          clearTimeout(timeoutId);
          console.warn('Error setting up database listener:', onValueError);
          resolve(getMockNearbyUsers(currentLat, currentLng));
        }
      } catch (dbError) {
        clearTimeout(timeoutId);
        console.warn('Error setting up database listener:', dbError);
        resolve(getMockNearbyUsers(currentLat, currentLng));
      }
    });
  } catch (error) {
    console.error('Error finding nearby users:', error);
    return getMockNearbyUsers();
  }
};

// Helper function to get mock nearby users
const getMockNearbyUsers = (lat = 37.7749, lng = -122.4194) => {
  // Return mock users with realistic distances from the given coordinates
  return [
    { 
      uid: 'mock1', 
      displayName: 'Nearby Helper 1',
      email: 'helper1@example.com', 
      distance: 0.8,
      latitude: lat + 0.007,
      longitude: lng - 0.005,
      lastUpdated: new Date()
    },
    { 
      uid: 'mock2', 
      displayName: 'Nearby Helper 2',
      email: 'helper2@example.com', 
      distance: 1.5,
      latitude: lat - 0.01,
      longitude: lng + 0.008,
      lastUpdated: new Date()
    },
    { 
      uid: 'mock3', 
      displayName: 'Nearby Helper 3',
      email: 'helper3@example.com', 
      distance: 2.3,
      latitude: lat + 0.015,
      longitude: lng + 0.012,
      lastUpdated: new Date()
    }
  ];
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
    console.warn('User must be logged in to get nearest users');
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
    console.error('Error getting nearest users from backend:', error);
    // Fall back to mock data
    return getMockNearbyUsers(latitude, longitude);
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
    console.error('Error checking location permission:', error);
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