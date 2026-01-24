import { Loader } from '@googlemaps/js-api-loader';
import { auth } from '../firebase';
import { getCurrentLocation, getNearestUsers } from './locationService';
// Cache for Google Maps API
let googleMapsApi = null;
// Google Maps API key from environment
const MAPS_API_KEY = process.env.VUE_APP_GOOGLE_MAPS_API_KEY || '';
const MAP_ID = process.env.VUE_APP_GOOGLE_MAPS_MAP_ID || '';

// Validate API key
if (!MAPS_API_KEY) {
  console.warn('⚠️  Google Maps API key is not set. Set VUE_APP_GOOGLE_MAPS_API_KEY in your .env file.');
}
// Map instance
let map = null;
let markers = [];
let currentLocationMarker = null;
let locationCircle = null;
// Track if map has been initialized
let mapInitialized = false;
let loaderPromise = null;
let myLocationControlAdded = false;
// Initialize Google Maps API loader (singleton)
const getGoogleMapsApi = async () => {
  if (!MAPS_API_KEY) {
    throw new Error('Google Maps API key is not configured. Please set VUE_APP_GOOGLE_MAPS_API_KEY in your environment variables.');
  }
  
  if (!loaderPromise) {
    const loaderConfig = {
      apiKey: MAPS_API_KEY,
      version: 'beta',  // Use beta for advanced markers
      libraries: ['maps', 'places', 'marker'],
      // Use loading strategy for better performance
      loadingStrategy: 'async',
    };
    if (MAP_ID) {
      loaderConfig.mapIds = [MAP_ID];
    }
    const loader = new Loader(loaderConfig);
    loaderPromise = loader.load().catch(error => {
      console.error('Google Maps API Load Error:', error);
      
      // Check for API key restriction errors
      if (error.message && (error.message.includes('ApiTargetBlockedMapError') || error.message.includes('RefererNotAllowedMapError'))) {
        const errorMsg = '🚫 Google Maps API key is restricted!\n\n' +
          'To fix this:\n' +
          '1. Go to: https://console.cloud.google.com/apis/credentials\n' +
          '2. Click on your API key\n' +
          '3. Under "Application restrictions", select "HTTP referrers (web sites)"\n' +
          '4. Add these referrers:\n' +
          '   • http://localhost:8080/*\n' +
          '   • http://localhost:*/*\n' +
          '   • http://127.0.0.1:8080/*\n' +
          '5. Click "Save" and wait 1-5 minutes\n\n' +
          'Alternatively, temporarily set restrictions to "None" for testing.';
        console.error(errorMsg);
        alert(errorMsg); // Show alert so user sees it
        throw new Error(errorMsg);
      }
      
      // Reset promise on error so we can retry
      loaderPromise = null;
      throw error;
    });
  }
  return loaderPromise;
};
// Initialize Google Maps
export const initMap = async (elementId, options = {}) => {
  if (mapInitialized && map) {
    return map;
  }
  try {
    // Wait for the element to be available in the DOM
    let mapElement = document.getElementById(elementId);
    let retries = 5;
    while (!mapElement && retries > 0) {
      await new Promise(resolve => setTimeout(resolve, 200));
      mapElement = document.getElementById(elementId);
      retries--;
    }
    
    if (!mapElement) {
      throw new Error(`Element with ID "${elementId}" not found after multiple retries. Make sure the element exists in the DOM.`);
    }
    
    // Ensure element is visible and has dimensions
    if (mapElement.offsetWidth === 0 || mapElement.offsetHeight === 0) {
      console.warn('Map element has zero dimensions. Waiting for layout...');
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // Get Google Maps API
    googleMapsApi = await getGoogleMapsApi();
    
    // Verify API loaded correctly
    if (!googleMapsApi || !googleMapsApi.maps) {
      throw new Error('Google Maps API did not load correctly');
    }
    
    const defaultOptions = {
      center: { lat: 0, lng: 0 }, // Default center (will be updated)
      zoom: 15,
      mapTypeControl: true,
      streetViewControl: false,
      fullscreenControl: true,
      mapTypeId: googleMapsApi.maps.MapTypeId.ROADMAP,
      ...(MAP_ID ? { mapId: MAP_ID } : {}),
      zoomControl: true,
      gestureHandling: 'greedy' // Makes it easier to use on mobile
    };
    const mapOptions = { ...defaultOptions, ...options };
    
    // Create map
    map = new googleMapsApi.maps.Map(mapElement, mapOptions);
    addMyLocationControl();
    mapInitialized = true;
    return map;
  } catch (error) {
    mapInitialized = false;
    console.error('Map initialization error:', error);
    
    // Show user-friendly error message
    if (error.message && error.message.includes('restricted')) {
      // Error already shown in getGoogleMapsApi
    } else {
      console.error('Failed to initialize map:', error.message);
    }
    
    throw error;
  }
};
// Default location (used when geolocation is not available)
const DEFAULT_LOCATION = { lat: 37.7749, lng: -122.4194 }; // San Francisco

const addMyLocationControl = () => {
  if (!googleMapsApi || !map || myLocationControlAdded) {
    return;
  }

  const controlDiv = document.createElement('div');
  controlDiv.style.margin = '16px';

  const button = document.createElement('button');
  button.type = 'button';
  button.setAttribute('aria-label', 'Center map on your location');
  button.textContent = '📍';
  button.style.backgroundColor = '#fff';
  button.style.border = 'none';
  button.style.borderRadius = '50%';
  button.style.boxShadow = '0 1px 4px rgba(0,0,0,0.3)';
  button.style.width = '44px';
  button.style.height = '44px';
  button.style.fontSize = '20px';
  button.style.display = 'flex';
  button.style.alignItems = 'center';
  button.style.justifyContent = 'center';
  button.style.color = '#1a73e8';
  button.style.cursor = 'pointer';
  button.style.outline = 'none';

  const setLoading = (state) => {
    button.disabled = state;
    button.style.opacity = state ? '0.6' : '1';
  };

  button.addEventListener('click', async () => {
    setLoading(true);
    try {
      await centerMapOnUserLocation();
    } catch (error) {
      console.error('Failed to center on user location:', error);
    } finally {
      setLoading(false);
    }
  });

  controlDiv.appendChild(button);
  map.controls[googleMapsApi.maps.ControlPosition.RIGHT_BOTTOM].push(controlDiv);
  myLocationControlAdded = true;
};
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
    const currentPosition = await getCurrentLocation();
    const nearestUsers = await getNearestUsers(
      currentPosition.coords.latitude,
      currentPosition.coords.longitude,
      25
    );
    nearestUsers.forEach((user) => {
      if (!user.latitude || !user.longitude) {
        return;
      }
      const position = { lat: user.latitude, lng: user.longitude };
      try {
        let marker;
        if (googleMapsApi.maps.marker && googleMapsApi.maps.marker.AdvancedMarkerElement) {
          marker = new googleMapsApi.maps.marker.AdvancedMarkerElement({
            position,
            map,
            title: user.displayName || 'User',
            gmpDraggable: false
          });
        } else {
          marker = new googleMapsApi.maps.Marker({
            position,
            map,
            title: user.displayName || 'User',
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
        const infoWindow = new googleMapsApi.maps.InfoWindow({
          content: `
            <div>
              <h3>${user.displayName || 'User'}</h3>
              <p>Distance: ${user.distance_km?.toFixed?.(2) ?? ''} km</p>
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
    
    // Get current time
    const now = Date.now();
    const threeHoursInMs = 3 * 60 * 60 * 1000; // 3 hours in milliseconds
    
    // Filter out expired alerts and add markers for active ones
    const activeAlerts = alerts.filter(alert => {
      const alertAge = now - (alert.createdAt instanceof Date ? alert.createdAt.getTime() : alert.createdAt);
      return alertAge < threeHoursInMs;
    });
    
    // Add marker for each active alert
    activeAlerts.forEach(alert => {
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
        console.error('Error adding alert marker:', markerError);
      }
    });
    return activeAlerts.length;
  } catch (error) {
    console.error('Error showing alerts:', error);
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
    // Reset map state
    map = null;
    mapInitialized = false;
    myLocationControlAdded = false;
  } catch (error) {
  }
}; 
