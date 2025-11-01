import { auth, rtdb } from '../firebase';
import { ref, set, get } from 'firebase/database';
import api from '../utils/api';

const DEFAULT_COORDS = { latitude: 37.7749, longitude: -122.4194 };
const GEO_OPTIONS = {
  enableHighAccuracy: true,
  timeout: 20000,
  maximumAge: 60000
};
const MIN_UPDATE_INTERVAL_MS = 15000;

let watchId = null;
let lastLocationPersisted = 0;
let lastKnownPosition = null;

const STORAGE_KEYS = {
  locationSharing: 'locationSharingEnabled',
  shareWithNearbyUsers: 'shareWithNearbyUsers',
  allowEmergencyTracking: 'allowEmergencyTracking',
  locationUpdateInterval: 'locationUpdateInterval'
};

const getBooleanSetting = (key, fallback) => {
  const value = localStorage.getItem(key);
  if (value === null) {
    return fallback;
  }
  return value === 'true';
};

const getNumericSetting = (key, fallback) => {
  const value = localStorage.getItem(key);
  const numeric = parseInt(value || '', 10);
  return Number.isFinite(numeric) ? numeric : fallback;
};

const dispatchPrivacyUpdate = () => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('privacy-settings-updated', {
        detail: getPrivacySettings()
      })
    );
  }
};

const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371;
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const deg2rad = (deg) => deg * (Math.PI / 180);

const persistLocation = async (position) => {
  lastKnownPosition = position;

  if (!auth.currentUser) {
    return false;
  }

  const { latitude, longitude, accuracy } = position.coords;
  const timestamp = Date.now();
  const settings = getPrivacySettings();

  const throttleInterval = Math.max(settings.locationUpdateInterval, MIN_UPDATE_INTERVAL_MS);
  if (timestamp - lastLocationPersisted < throttleInterval) {
    return true;
  }
  lastLocationPersisted = timestamp;

  const payload = {
    userId: auth.currentUser.uid,
    latitude,
    longitude,
    accuracy,
    timestamp,
    displayName: auth.currentUser.displayName || (auth.currentUser.email ? auth.currentUser.email.split('@')[0] : 'User'),
    email: auth.currentUser.email
  };

  try {
    await api.post('/api/location', payload);
  } catch (apiError) {
    console.warn('[LocationService] Backend location sync failed', apiError);
  }

  if (rtdb) {
    try {
      const locationRef = ref(rtdb, `locations/${auth.currentUser.uid}`);
      await set(locationRef, {
        latitude,
        longitude,
        lat: latitude,
        lng: longitude,
        accuracy,
        timestamp,
        displayName: auth.currentUser.displayName || 'User',
        email: auth.currentUser.email
      });
    } catch (rtdbError) {
      console.warn('[LocationService] Realtime Database location update failed', rtdbError);
    }
  }

  return true;
};

export const startLocationTracking = async () => {
  const settings = getPrivacySettings();
  if (!settings.locationSharing || !auth.currentUser || typeof navigator === 'undefined' || !navigator.geolocation) {
    return false;
  }

  if (watchId !== null) {
    return true;
  }

  return new Promise((resolve) => {
    let resolved = false;

    const onSuccess = async (position) => {
      await persistLocation(position);
      if (!resolved) {
        resolved = true;
        resolve(true);
      }
    };

    const onError = (error) => {
      console.warn('[LocationService] watchPosition error', error);
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
      }
      if (!resolved) {
        resolved = true;
        resolve(false);
      }
    };

    try {
      watchId = navigator.geolocation.watchPosition(onSuccess, onError, GEO_OPTIONS);
      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          resolve(true);
        }
      }, 3000);
    } catch (error) {
      console.error('[LocationService] Failed to start location tracking', error);
      watchId = null;
      resolve(false);
    }
  });
};

export const stopLocationTracking = () => {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return false;
  }
  if (watchId !== null) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
    lastLocationPersisted = 0;
    return true;
  }
  return false;
};

export const getCurrentLocation = () => {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      resolve({
        coords: DEFAULT_COORDS,
        timestamp: Date.now()
      });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        lastKnownPosition = position;
        resolve(position);
      },
      () => {
        if (lastKnownPosition) {
          resolve(lastKnownPosition);
          return;
        }
        resolve({
          coords: DEFAULT_COORDS,
          timestamp: Date.now()
        });
      },
      GEO_OPTIONS
    );
  });
};

export const findNearbyUsers = async (radiusInKm = 5) => {
  if (!auth.currentUser || !rtdb) {
    return [];
  }

  try {
    const currentPosition = await getCurrentLocation();
    const currentLat = currentPosition.coords.latitude;
    const currentLng = currentPosition.coords.longitude;

    const locationsRef = ref(rtdb, 'locations');
    const snapshot = await get(locationsRef);
    const locations = snapshot.val();

    if (!locations) {
      return [];
    }

    return Object.entries(locations)
      .filter(([uid]) => uid !== auth.currentUser.uid)
      .map(([uid, data]) => {
        const lat = Number(data.latitude ?? data.lat);
        const lng = Number(data.longitude ?? data.lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
          return null;
        }
        const distance = calculateDistance(currentLat, currentLng, lat, lng);
        return {
          uid,
          displayName: data.displayName || 'Helper',
          email: data.email,
          distance,
          latitude: lat,
          longitude: lng,
          lastUpdated: new Date(data.timestamp || Date.now())
        };
      })
      .filter((entry) => entry && entry.distance <= radiusInKm)
      .sort((a, b) => a.distance - b.distance);
  } catch (error) {
    console.warn('[LocationService] Failed to load nearby users', error);
    return [];
  }
};

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
    console.warn('[LocationService] Backend nearest users lookup failed', error);
    return [];
  }
};

export const checkLocationPermission = async () => {
  if (typeof navigator === 'undefined' || !navigator.permissions) {
    return 'unknown';
  }
  try {
    const result = await navigator.permissions.query({ name: 'geolocation' });
    return result.state;
  } catch {
    return 'unknown';
  }
};

export const requestLocationPermission = async () => {
  try {
    const position = await getCurrentLocation();
    return position ? 'granted' : 'denied';
  } catch (error) {
    if (error && error.code === 1) {
      return 'denied';
    }
    return 'error';
  }
};

export const getLocationSharingPreference = () => {
  return getBooleanSetting(STORAGE_KEYS.locationSharing, true);
};

export const setLocationSharingPreference = (enabled) => {
  localStorage.setItem(STORAGE_KEYS.locationSharing, enabled ? 'true' : 'false');
  if (!enabled) {
    stopLocationTracking();
  }
  dispatchPrivacyUpdate();
};

export const getPrivacySettings = () => {
  return {
    locationSharing: getBooleanSetting(STORAGE_KEYS.locationSharing, true),
    shareWithNearbyUsers: getBooleanSetting(STORAGE_KEYS.shareWithNearbyUsers, true),
    allowEmergencyTracking: getBooleanSetting(STORAGE_KEYS.allowEmergencyTracking, true),
    locationUpdateInterval: getNumericSetting(STORAGE_KEYS.locationUpdateInterval, 30000)
  };
};

export const updatePrivacySettings = (settings) => {
  if (settings.locationSharing !== undefined) {
    localStorage.setItem(STORAGE_KEYS.locationSharing, settings.locationSharing ? 'true' : 'false');
    if (!settings.locationSharing) {
      stopLocationTracking();
    }
  }
  if (settings.shareWithNearbyUsers !== undefined) {
    localStorage.setItem(STORAGE_KEYS.shareWithNearbyUsers, settings.shareWithNearbyUsers ? 'true' : 'false');
  }
  if (settings.allowEmergencyTracking !== undefined) {
    localStorage.setItem(STORAGE_KEYS.allowEmergencyTracking, settings.allowEmergencyTracking ? 'true' : 'false');
  }
  if (settings.locationUpdateInterval !== undefined) {
    localStorage.setItem(
      STORAGE_KEYS.locationUpdateInterval,
      String(settings.locationUpdateInterval)
    );
  }
  dispatchPrivacyUpdate();
};
