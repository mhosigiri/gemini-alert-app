<template>
  <div class="privacy-settings">
    <h3>Privacy Settings</h3>
    
    <div class="setting-group">
      <div class="setting-item">
        <label class="toggle-label">
          <input 
            type="checkbox" 
            v-model="settings.locationSharing" 
            @change="updateSettings"
          />
          <span class="toggle-slider"></span>
          <span class="setting-text">Share Location</span>
        </label>
        <p class="setting-description">Allow the app to access your location for emergency alerts</p>
      </div>
      
      <div class="setting-item">
        <label class="toggle-label">
          <input 
            type="checkbox" 
            v-model="settings.shareWithNearbyUsers" 
            @change="updateSettings"
          />
          <span class="toggle-slider"></span>
          <span class="setting-text">Share with Nearby Users</span>
        </label>
        <p class="setting-description">Share your emergency alerts with users in your area</p>
      </div>
      
      <div class="setting-item">
        <label class="toggle-label">
          <input 
            type="checkbox" 
            v-model="settings.allowEmergencyTracking" 
            @change="updateSettings"
          />
          <span class="toggle-slider"></span>
          <span class="setting-text">Emergency Tracking</span>
        </label>
        <p class="setting-description">Allow continuous location tracking during emergencies</p>
      </div>
      
      <div class="setting-item">
        <label for="update-interval">Location Update Interval</label>
        <select 
          id="update-interval" 
          v-model="settings.locationUpdateInterval" 
          @change="updateSettings"
          class="interval-select"
        >
          <option :value="10000">10 seconds</option>
          <option :value="30000">30 seconds</option>
          <option :value="60000">1 minute</option>
          <option :value="300000">5 minutes</option>
        </select>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted } from 'vue'
import { getPrivacySettings, updatePrivacySettings } from '../services/locationService'

export default {
  name: 'PrivacySettings',
  setup() {
    const settings = ref({
      locationSharing: false,
      shareWithNearbyUsers: true,
      allowEmergencyTracking: true,
      locationUpdateInterval: 30000
    })

    const loadSettings = () => {
      const currentSettings = getPrivacySettings()
      settings.value = { ...currentSettings }
    }

    const updateSettings = () => {
      updatePrivacySettings(settings.value)
    }

    onMounted(() => {
      loadSettings()
    })

    return {
      settings,
      updateSettings
    }
  }
}
</script>

<style scoped>
.privacy-settings {
  padding: 20px;
}

.privacy-settings h3 {
  margin-bottom: 20px;
  color: #333;
  font-size: 1.5rem;
}

.setting-group {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.setting-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.toggle-label {
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  font-weight: 500;
}

.toggle-label input[type="checkbox"] {
  display: none;
}

.toggle-slider {
  position: relative;
  width: 44px;
  height: 24px;
  background-color: #ccc;
  border-radius: 24px;
  transition: background-color 0.3s;
}

.toggle-slider::before {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 20px;
  height: 20px;
  background-color: white;
  border-radius: 50%;
  transition: transform 0.3s;
}

.toggle-label input[type="checkbox"]:checked + .toggle-slider {
  background-color: #007bff;
}

.toggle-label input[type="checkbox"]:checked + .toggle-slider::before {
  transform: translateX(20px);
}

.setting-text {
  flex: 1;
  color: #333;
}

.setting-description {
  margin: 0;
  font-size: 0.875rem;
  color: #666;
  margin-left: 56px;
}

.interval-select {
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 1rem;
  max-width: 200px;
}
</style>
