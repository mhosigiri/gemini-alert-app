import { auth } from '../firebase';
import api from '../utils/api';
import { getCurrentLocation } from './locationService';

const DEFAULT_RADIUS_KM = 10;
const ALERT_POLL_INTERVAL_MS = 10000;

export const sendEmergencyAlert = async (message, emergencyType) => {
  if (!auth.currentUser) {
    throw new Error('User must be logged in to send alerts');
  }
  if (!message?.trim()) {
    throw new Error('Message is required');
  }

  const position = await getCurrentLocation();
  const { latitude, longitude } = position.coords;

  try {
    const response = await api.post('/api/send-sos', {
      latitude,
      longitude,
      message,
      emergencyType
    });
    const recipients = response.data.recipients || [];
    return {
      success: response.data.status === 'sos_sent',
      alertId: response.data.alertId,
      notifiedUsers: recipients.length,
      recipients
    };
  } catch (error) {
    console.error('[AlertService] Failed to send SOS alert', error);
    throw error;
  }
};

export const getNearbyAlerts = async (radius = DEFAULT_RADIUS_KM) => {
  if (!auth.currentUser) {
    throw new Error('User must be logged in to view alerts');
  }

  const position = await getCurrentLocation();
  const { latitude, longitude } = position.coords;

  try {
    const response = await api.post('/api/alerts/nearby', {
      latitude,
      longitude,
      radius
    });
    return response.data.alerts || [];
  } catch (error) {
    console.error('[AlertService] Failed to fetch nearby alerts', error);
    throw error;
  }
};

export const subscribeToNearbyAlerts = (radius = DEFAULT_RADIUS_KM, onUpdate = () => {}) => {
  if (!auth.currentUser) {
    onUpdate([]);
    return () => {};
  }

  let isCancelled = false;
  let intervalId = null;

  const fetchAlerts = async () => {
    try {
      const alerts = await getNearbyAlerts(radius);
      if (!isCancelled) {
        onUpdate(alerts);
      }
    } catch (error) {
      if (!isCancelled) {
        onUpdate([]);
      }
    }
  };

  fetchAlerts();
  intervalId = setInterval(fetchAlerts, ALERT_POLL_INTERVAL_MS);

  return () => {
    isCancelled = true;
    if (intervalId) {
      clearInterval(intervalId);
    }
  };
};

export const respondToAlert = async (alertId, message) => {
  if (!auth.currentUser) {
    throw new Error('User must be logged in to respond to alerts');
  }
  if (!message?.trim()) {
    throw new Error('Message is required');
  }

  try {
    const response = await api.post(`/api/alerts/${alertId}/respond`, {
      message
    });
    return {
      success: response.data.status === 'response_recorded',
      responseId: response.data.responseId
    };
  } catch (error) {
    console.error('[AlertService] Failed to respond to alert', error);
    throw error;
  }
};

