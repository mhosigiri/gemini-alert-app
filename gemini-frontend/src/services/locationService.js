import { auth, db, rtdb } from '../firebase';
import { doc, updateDoc, GeoPoint, serverTimestamp, setDoc } from 'firebase/firestore';
import { ref, set, onValue } from 'firebase/database';

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
  if (!navigator.geolocation) {
    console.error('Geolocation is not supported by this browser');
    return false;
  }

  if (!auth.currentUser) {
    console.error('User must be logged in to track location');
    return false;
  }

  try {
    // Watch position
    watchId = navigator.geolocation.watchPosition(
      position => updateUserLocation(position),
      error => console.error('Error getting location:', error),
      geoOptions
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
    // Update Firestore (for permanent storage)
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
          console.error('Error creating user document:', innerError);
          // Continue anyway to try the Realtime Database update
        }
      } else {
        console.error('Error updating Firestore:', error);
        // Continue anyway to try the Realtime Database update
      }
    }

    // Update Realtime Database (for real-time tracking)
    try {
      const locationRef = ref(rtdb, `locations/${userId}`);
      await set(locationRef, {
        latitude,
        longitude,
        accuracy,
        timestamp,
        displayName: auth.currentUser.displayName || 'User',
        email: auth.currentUser.email
      });
      console.log('Realtime Database location updated successfully');
    } catch (rtdbError) {
      console.error('Error updating Realtime Database:', rtdbError);
      // We successfully updated at least one database, so consider it partial success
      return true;
    }

    console.log('Location updated successfully in both databases');
    return true;
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
      }, 10000); // 10 second timeout
      
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
                  // Ensure latitude and longitude exist
                  if (!data.latitude || !data.longitude) {
                    return null;
                  }
                  
                  const distance = calculateDistance(
                    currentLat,
                    currentLng, 
                    data.latitude, 
                    data.longitude
                  );
                  
                  return {
                    uid,
                    displayName: data.displayName || 'Unknown User',
                    email: data.email,
                    distance, // in km
                    latitude: data.latitude,
                    longitude: data.longitude,
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
const getMockNearbyUsers = (/* Removed unused parameters */) => {
  // Return empty array instead of mock users
  return [];
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