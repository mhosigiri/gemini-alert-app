import { Loader } from '@googlemaps/js-api-loader';
import { ref, onValue } from 'firebase/database';
import { rtdb, auth } from '../firebase';
// Cache for Google Maps API
let googleMapsApi = null;
// Google Maps API key from environment
const MAPS_API_KEY = process.env.VUE_APP_GOOGLE_MAPS_API_KEY || '';
// Map instance
let map = null;
let markers = [];
let currentLocationMarker = null;
let locationCircle = null;
let userListeners = [];
// Track if map has been initialized
let mapInitialized = false;
let loaderPromise = null;
// Initialize Google Maps API loader (singleton)
const getGoogleMapsApi = async () => {
  if (!loaderPromise) {
    const loader = new Loader({
      apiKey: MAPS_API_KEY,
      version: 'beta',  // Use beta for advanced markers
      libraries: ['maps', 'places', 'marker'],
      callback: 'console.debug'  // Required callback, using console.debug as noop
    });
    loaderPromise = loader.load();
  }
  return loaderPromise;
};
// Initialize Google Maps
export const initMap = async (elementId, options = {}) => {
  if (mapInitialized && map) {
    return map;
  }
  try {
    // Get Google Maps API
    googleMapsApi = await getGoogleMapsApi();
    // Check if element exists
    const mapElement = document.getElementById(elementId);
    if (!mapElement) {
      throw new Error(`Element with ID "${elementId}" not found`);
    }
    const defaultOptions = {
      center: { lat: 0, lng: 0 }, // Default center (will be updated)
      zoom: 15,
      mapTypeControl: true,
      streetViewControl: false,
      fullscreenControl: true,
      mapTypeId: googleMapsApi.maps.MapTypeId.ROADMAP,
      mapId: 'DEMO_MAP_ID', // Use the map ID from the boilerplate
      // Improved style settings
      zoomControl: true,
      gestureHandling: 'greedy' // Makes it easier to use on mobile
    };
    const mapOptions = { ...defaultOptions, ...options };
    // Create map
    map = new googleMapsApi.maps.Map(mapElement, mapOptions);
    mapInitialized = true;
    return map;
  } catch (error) {
    mapInitialized = false;
    throw error;
  }
};
// Default location (used when geolocation is not available)
const DEFAULT_LOCATION = { lat: 37.7749, lng: -122.4194 }; // San Francisco
// Center map on user's current location
export const centerMapOnUserLocation = async (radiusInKm = 1) => {
  if (!mapInitialized || !map) {
    return DEFAULT_LOCATION;
  }
  try {
    // Ensure Google Maps API is loaded
    if (!googleMapsApi) {
      googleMapsApi = await getGoogleMapsApi();
    }
    let currentLocation;
    try {
      // Get current position
      const position = await getCurrentPosition();
      const { latitude, longitude } = position.coords;
      currentLocation = { lat: latitude, lng: longitude };
    } catch (geoError) {
      currentLocation = DEFAULT_LOCATION;
      throw geoError; // Re-throw to notify caller
    }
    // Center map
    try {
      map.setCenter(currentLocation);
    } catch (error) {
    }
    // Add marker for current location
    try {
      if (googleMapsApi.maps.marker && googleMapsApi.maps.marker.AdvancedMarkerElement) {
        // Use the new AdvancedMarkerElement if available
        if (currentLocationMarker) {
          try {
            // If using AdvancedMarkerElement, we need to recreate the marker
            // as it doesn't have a setPosition method
            currentLocationMarker.map = null;
          } catch (e) {
          }
          // Create a new advanced marker
          currentLocationMarker = new googleMapsApi.maps.marker.AdvancedMarkerElement({
            position: currentLocation,
            map: map,
            title: 'Your Location',
            gmpDraggable: false,
          });
        } else {
          currentLocationMarker = new googleMapsApi.maps.marker.AdvancedMarkerElement({
            position: currentLocation,
            map: map,
            title: 'Your Location',
            gmpDraggable: false,
          });
        }
      } else {
        // Fallback to regular marker if advanced markers not available
        if (currentLocationMarker) {
          currentLocationMarker.setPosition(currentLocation);
        } else {
          currentLocationMarker = new googleMapsApi.maps.Marker({
            position: currentLocation,
            map: map,
            title: 'Your Location',
            icon: {
              path: googleMapsApi.maps.SymbolPath.CIRCLE,
              scale: 10,
              fillColor: '#4285F4',
              fillOpacity: 1,
              strokeColor: '#FFFFFF',
              strokeWeight: 2
            },
            zIndex: 100
          });
        }
      }
    } catch (markerError) {
    }
    // Create or update a circle showing search radius
    try {
      const radiusInMeters = radiusInKm * 1000;
      if (locationCircle) {
        locationCircle.setCenter(currentLocation);
        locationCircle.setRadius(radiusInMeters);
      } else {
        locationCircle = new googleMapsApi.maps.Circle({
          strokeColor: '#4285F4',
          strokeOpacity: 0.8,
          strokeWeight: 2,
          fillColor: '#4285F4',
          fillOpacity: 0.1,
          map: map,
          center: currentLocation,
          radius: radiusInMeters,
          zIndex: 1
        });
      }
    } catch (circleError) {
    }
    return currentLocation;
  } catch (error) {
    return DEFAULT_LOCATION; // Return default location but don't break the flow
  }
};
// Get current position
const getCurrentPosition = () => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by this browser'));
      return;
    }
    // Use a higher timeout (20 seconds instead of 10) and allow slightly older positions
    navigator.geolocation.getCurrentPosition(
      position => resolve(position),
      error => reject(error),
      { 
        enableHighAccuracy: true, 
        timeout: 20000,  // 20 seconds
        maximumAge: 60000 // Allow positions up to 1 minute old
      }
    );
  });
};
// Show nearby users on the map
export const showNearbyUsers = async () => {
  if (!mapInitialized || !map) {
    return 0;
  }
  if (!auth.currentUser) {
    return 0;
  }
  try {
    // Ensure Google Maps API is loaded
    if (!googleMapsApi) {
      googleMapsApi = await getGoogleMapsApi();
    }
    // Clear existing markers
    clearMarkers();
    // Clear existing listeners
    userListeners.forEach(unsubscribe => unsubscribe());
    userListeners = [];
    // Subscribe to user locations in Realtime Database
    const locationsRef = ref(rtdb, 'locations');
    const unsubscribe = onValue(locationsRef, (snapshot) => {
      if (!map || !mapInitialized) {
        return;
      }
      const locations = snapshot.val();
      if (!locations) return;
      // Clear existing markers
      clearMarkers();
      // Add marker for each user
      Object.entries(locations).forEach(([userId, data]) => {
        // Skip current user
        if (userId === auth.currentUser.uid) return;
        const { latitude, longitude, displayName, timestamp } = data;
        if (!latitude || !longitude) return;
        // Check if location update is recent (within the last 30 minutes)
        const isRecent = (Date.now() - timestamp) < 30 * 60 * 1000;
        if (!isRecent) return;
        const position = { lat: latitude, lng: longitude };
        try {
          // Create marker for user
          let marker;
          if (googleMapsApi.maps.marker && googleMapsApi.maps.marker.AdvancedMarkerElement) {
            // Use advanced marker if available
            marker = new googleMapsApi.maps.marker.AdvancedMarkerElement({
              position,
              map,
              title: displayName || 'User',
              gmpDraggable: false
            });
          } else {
            // Fallback to regular marker
            marker = new googleMapsApi.maps.Marker({
              position,
              map,
              title: displayName || 'User',
              icon: {
                path: googleMapsApi.maps.SymbolPath.CIRCLE,
                scale: 8,
                fillColor: '#34A853',
                fillOpacity: 0.8,
                strokeColor: '#FFFFFF',
                strokeWeight: 2
              }
            });
          }
          // Add click listener to marker
          const infoWindow = new googleMapsApi.maps.InfoWindow({
            content: `
              <div>
                <h3>${displayName || 'User'}</h3>
                <p>Last seen: ${new Date(timestamp).toLocaleString()}</p>
              </div>
            `
          });
          marker.addListener('click', () => {
            infoWindow.open(map, marker);
          });
          markers.push(marker);
        } catch (markerError) {
        }
      });
    });
    userListeners.push(unsubscribe);
    return markers.length;
  } catch (error) {
    return 0; // Continue without throwing
  }
};
// Show alerts on the map
export const showAlerts = async (alerts) => {
  if (!mapInitialized || !map) {
    return 0;
  }
  try {
    // Ensure Google Maps API is loaded
    if (!googleMapsApi) {
      googleMapsApi = await getGoogleMapsApi();
    }
    // Add marker for each alert
    alerts.forEach(alert => {
      try {
        const { id, location, userName, message, emergencyType, createdAt } = alert;
        if (!location || !location.latitude || !location.longitude) return;
        const position = { lat: location.latitude, lng: location.longitude };
        // Create marker for alert
        let marker;
        if (googleMapsApi.maps.marker && googleMapsApi.maps.marker.AdvancedMarkerElement) {
          // Use advanced marker if available
          marker = new googleMapsApi.maps.marker.AdvancedMarkerElement({
            position,
            map,
            title: `Alert from ${userName}`,
            gmpDraggable: false
          });
        } else {
          // Fallback to regular marker
          marker = new googleMapsApi.maps.Marker({
            position,
            map,
            title: `Alert from ${userName}`,
            icon: {
              path: googleMapsApi.maps.SymbolPath.CIRCLE,
              scale: 12,
              fillColor: '#EA4335',
              fillOpacity: 0.8,
              strokeColor: '#FFFFFF',
              strokeWeight: 2
            },
            zIndex: 50
          });
        }
        // Add click listener to marker
        const infoWindow = new googleMapsApi.maps.InfoWindow({
          content: `
            <div class="alert-info-window">
              <h3>${emergencyType || 'Emergency'} Alert</h3>
              <p><strong>From:</strong> ${userName}</p>
              <p><strong>Message:</strong> ${message}</p>
              <p><strong>Time:</strong> ${new Date(createdAt).toLocaleString()}</p>
              <button onclick="window.respondToAlert('${id}')">Respond</button>
            </div>
          `
        });
        marker.addListener('click', () => {
          infoWindow.open(map, marker);
        });
        markers.push(marker);
      } catch (markerError) {
      }
    });
    return markers.length;
  } catch (error) {
    return 0; // Continue without throwing
  }
};
// Clear all markers from the map
export const clearMarkers = () => {
  try {
    markers.forEach(marker => {
      try {
        if (marker) {
          // Handle both regular and advanced markers
          if (marker.setMap) {
            marker.setMap(null);
          } else {
            // For advanced markers, setting map to null removes them
            marker.map = null;
          }
        }
      } catch (e) {
      }
    });
  } catch (error) {
  }
  markers = [];
};
// Clean up map resources
export const cleanupMap = () => {
  try {
    // Clear markers
    clearMarkers();
    // Clean up current location marker
    if (currentLocationMarker) {
      try {
        // Handle both regular and advanced markers
        if (currentLocationMarker.setMap) {
          currentLocationMarker.setMap(null);
        } else {
          // For advanced markers, setting map to null removes them
          currentLocationMarker.map = null;
        }
      } catch (error) {
      }
      currentLocationMarker = null;
    }
    // Clean up location circle
    if (locationCircle) {
      try {
        locationCircle.setMap(null);
      } catch (error) {
      }
      locationCircle = null;
    }
    // Remove listeners
    userListeners.forEach(unsubscribe => {
      try {
        unsubscribe();
      } catch (error) {
      }
    });
    userListeners = [];
    // Reset map state
    map = null;
    mapInitialized = false;
  } catch (error) {
  }
}; 