<template>
  <div class="privacy-settings">
    <h2>Privacy & Security Settings</h2>
    
    <div class="setting-group">
      <h3>Location Sharing</h3>
      
      <div class="setting-item">
        <label class="switch">
          <input 
            type="checkbox" 
            v-model="settings.locationSharing"
            @change="updateSetting('locationSharing')"
          >
          <span class="slider"></span>
        </label>
        <div class="setting-info">
          <span class="setting-label">Enable Location Sharing</span>
          <span class="setting-description">Allow the app to access and share your location</span>
        </div>
      </div>
      
      <div class="setting-item" :class="{ disabled: !settings.locationSharing }">
        <label class="switch">
          <input 
            type="checkbox" 
            v-model="settings.shareWithNearbyUsers"
            @change="updateSetting('shareWithNearbyUsers')"
            :disabled="!settings.locationSharing"
          >
          <span class="slider"></span>
        </label>
        <div class="setting-info">
          <span class="setting-label">Visible to Nearby Users</span>
          <span class="setting-description">Let other users see you when they search for help</span>
        </div>
      </div>
      
      <div class="setting-item">
        <label class="switch">
          <input 
            type="checkbox" 
            v-model="settings.allowEmergencyTracking"
            @change="updateSetting('allowEmergencyTracking')"
          >
          <span class="slider"></span>
        </label>
        <div class="setting-info">
          <span class="setting-label">Emergency Override</span>
          <span class="setting-description">Share location automatically when sending SOS alerts</span>
        </div>
      </div>
    </div>
    
    <div class="setting-group">
      <h3>Location Update Frequency</h3>
      <div class="setting-item">
        <label for="update-interval">Update location every:</label>
        <select 
          id="update-interval"
          v-model="settings.locationUpdateInterval"
          @change="updateSetting('locationUpdateInterval')"
        >
          <option value="10000">10 seconds</option>
          <option value="30000">30 seconds</option>
          <option value="60000">1 minute</option>
          <option value="300000">5 minutes</option>
        </select>
      </div>
    </div>
    
    <div class="location-permission-status">
      <h3>Location Permission Status</h3>
      <div class="permission-info">
        <span class="status-label">Browser Permission:</span>
        <span :class="['status-value', permissionStatus]">{{ permissionStatus }}</span>
      </div>
      <button 
        v-if="permissionStatus === 'prompt' || permissionStatus === 'denied'"
        @click="requestPermission"
        class="request-permission-btn"
      >
        Request Location Permission
      </button>
    </div>
    
    <div class="data-privacy">
      <h3>Data Privacy</h3>
      <ul class="privacy-info">
        <li>Your location is only shared when location sharing is enabled</li>
        <li>Location data is encrypted during transmission</li>
        <li>You can disable location sharing at any time</li>
        <li>In emergency situations, your location helps responders find you</li>
        <li>We do not store location history beyond active sessions</li>
      </ul>
    </div>
  </div>
</template>

<script>
import { ref, onMounted } from 'vue';
import { 
  getPrivacySettings, 
  updatePrivacySettings,
  checkLocationPermission,
  requestLocationPermission
} from '../services/locationService';

export default {
  name: 'PrivacySettings',
  
  setup() {
    const settings = ref({
      locationSharing: true,
      shareWithNearbyUsers: true,
      allowEmergencyTracking: true,
      locationUpdateInterval: 30000
    });
    
    const permissionStatus = ref('unknown');
    
    const loadSettings = () => {
      const savedSettings = getPrivacySettings();
      settings.value = { ...settings.value, ...savedSettings };
    };
    
    const updateSetting = (key) => {
      const update = {};
      update[key] = settings.value[key];
      updatePrivacySettings(update);
      
      // Emit event for parent components to react
      window.dispatchEvent(new CustomEvent('privacy-settings-updated', { 
        detail: { [key]: settings.value[key] } 
      }));
    };
    
    const checkPermission = async () => {
      const status = await checkLocationPermission();
      permissionStatus.value = status;
    };
    
    const requestPermission = async () => {
      const result = await requestLocationPermission();
      permissionStatus.value = result;
      
      if (result === 'granted') {
        settings.value.locationSharing = true;
        updateSetting('locationSharing');
      }
    };
    
    onMounted(() => {
      loadSettings();
      checkPermission();
    });
    
    return {
      settings,
      permissionStatus,
      updateSetting,
      requestPermission
    };
  }
};
</script>

<style scoped>
.privacy-settings {
  max-width: 600px;
  margin: 0 auto;
  padding: 20px;
}

.setting-group {
  margin-bottom: 30px;
  padding: 20px;
  background: #f5f5f5;
  border-radius: 8px;
}

.setting-group h3 {
  margin-top: 0;
  margin-bottom: 20px;
  color: #333;
}

.setting-item {
  display: flex;
  align-items: center;
  margin-bottom: 20px;
  padding: 15px;
  background: white;
  border-radius: 4px;
  transition: opacity 0.3s;
}

.setting-item.disabled {
  opacity: 0.6;
}

.setting-item:last-child {
  margin-bottom: 0;
}

.switch {
  position: relative;
  display: inline-block;
  width: 50px;
  height: 24px;
  margin-right: 15px;
}

.switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #ccc;
  transition: .4s;
  border-radius: 24px;
}

.slider:before {
  position: absolute;
  content: "";
  height: 16px;
  width: 16px;
  left: 4px;
  bottom: 4px;
  background-color: white;
  transition: .4s;
  border-radius: 50%;
}

input:checked + .slider {
  background-color: #4caf50;
}

input:checked + .slider:before {
  transform: translateX(26px);
}

input:disabled + .slider {
  opacity: 0.6;
  cursor: not-allowed;
}

.setting-info {
  flex: 1;
}

.setting-label {
  display: block;
  font-weight: 600;
  margin-bottom: 4px;
}

.setting-description {
  display: block;
  font-size: 14px;
  color: #666;
}

.location-permission-status {
  margin-bottom: 30px;
  padding: 20px;
  background: #f5f5f5;
  border-radius: 8px;
}

.permission-info {
  display: flex;
  align-items: center;
  margin-bottom: 15px;
}

.status-label {
  font-weight: 600;
  margin-right: 10px;
}

.status-value {
  padding: 4px 12px;
  border-radius: 4px;
  font-size: 14px;
  text-transform: capitalize;
}

.status-value.granted {
  background: #e8f5e9;
  color: #2e7d32;
}

.status-value.denied {
  background: #ffebee;
  color: #c62828;
}

.status-value.prompt,
.status-value.unknown {
  background: #fff3e0;
  color: #ef6c00;
}

.request-permission-btn {
  background-color: #3f51b5;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: background-color 0.3s;
}

.request-permission-btn:hover {
  background-color: #303f9f;
}

.data-privacy {
  padding: 20px;
  background: #e3f2fd;
  border-radius: 8px;
}

.privacy-info {
  margin: 0;
  padding-left: 20px;
}

.privacy-info li {
  margin-bottom: 10px;
  color: #1976d2;
}

select {
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
  margin-left: 10px;
}
</style> 