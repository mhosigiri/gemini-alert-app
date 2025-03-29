<template>
  <div class="app-container">
    <!-- Header -->
    <header class="app-header">
      <div class="logo">
        <h1>Gemini Alert</h1>
      </div>
      <div class="user-info" v-if="user">
        <span>{{ user.displayName || user.email }}</span>
        <button @click="logout" class="logout-btn">Sign Out</button>
      </div>
    </header>

    <!-- Main Content -->
    <main class="main-content">
      <div class="alert-panel">
        <h2>Send Emergency Alert</h2>
        <p class="intro-text">Describe your situation in detail. This will be shared with people nearby who can help you.</p>
        
        <div class="emergency-type">
          <label>Emergency Type</label>
          <div class="type-buttons">
            <button 
              v-for="type in emergencyTypes" 
              :key="type.value" 
              :class="['type-btn', { active: emergencyType === type.value }]"
              @click="emergencyType = type.value"
            >
              {{ type.label }}
            </button>
          </div>
        </div>
        
        <div class="message-input">
          <label for="alert-message">Message</label>
          <textarea 
            id="alert-message" 
            v-model="alertMessage" 
            placeholder="Describe your situation in detail..."
            rows="4"
          ></textarea>
        </div>
        
        <div class="location-status">
          <span :class="['status-indicator', locationTracking ? 'active' : '']"></span>
          <span>{{ locationStatus }}</span>
        </div>
        
        <div v-if="locationErrorMessage" class="location-error">
          <span>{{ locationErrorMessage }}</span>
          <button 
            v-if="mockLocation" 
            class="demo-mode-badge"
            @click="alertMessage = 'Help! This is a test emergency alert from the Gemini Alert app.'"
          >
            Using Demo Mode
          </button>
        </div>
        
        <div class="button-group">
          <button 
            @click="sendAlert" 
            :disabled="!canSendAlert || isLoading" 
            class="send-alert-btn"
          >
            {{ isLoading ? 'Sending...' : 'Send Emergency Alert' }}
          </button>
          
          <button 
            @click="showGeminiPanel = !showGeminiPanel" 
            class="ask-gemini-toggle-btn"
          >
            {{ showGeminiPanel ? 'Hide Gemini AI' : 'Ask Gemini AI' }}
          </button>
        </div>
        
        <div v-if="alertSent" class="alert-success">
          <h3>Alert Sent!</h3>
          <p>{{ notificationMessage }}</p>
        </div>
        
        <!-- Gemini Chat Panel -->
        <div v-if="showGeminiPanel" class="gemini-panel">
          <h3>Ask Gemini AI for Help</h3>
          <p class="gemini-intro">Need advice or tips for a crisis situation? Ask Gemini AI for help.</p>
          
          <div class="message-input">
            <textarea 
              v-model="geminiQuestion" 
              placeholder="Ask a question about de-escalation, crisis management, or safety tips..."
              rows="3"
            ></textarea>
          </div>
          
          <button 
            @click="askGeminiAI" 
            :disabled="!geminiQuestion.trim() || geminiLoading" 
            class="ask-gemini-btn"
          >
            {{ geminiLoading ? 'Getting Answer...' : 'Ask Gemini' }}
          </button>
          
          <div v-if="geminiResponse" class="gemini-response">
            <h4>Gemini's Response:</h4>
            <p v-html="formattedGeminiResponse"></p>
          </div>
        </div>
      </div>
      
      <div class="map-container">
        <h2>Nearby Users</h2>
        <div id="map" ref="mapElement"></div>
        
        <div class="nearby-users">
          <h3>People Who Can Help</h3>
          <div v-if="nearbyUsers.length === 0" class="no-users">
            <p>No users nearby at the moment.</p>
          </div>
          <ul v-else class="user-list">
            <li v-for="user in nearbyUsers" :key="user.uid" class="user-item">
              <div class="user-info">
                <strong>{{ user.displayName }}</strong>
                <span>{{ formatDistance(user.distance) }} away</span>
              </div>
            </li>
          </ul>
        </div>
      </div>
    </main>
    
    <!-- Alert Panel -->
    <div v-if="nearbyAlerts.length > 0" class="alerts-panel">
      <h2>Active Alerts Nearby</h2>
      <ul class="alert-list">
        <li 
          v-for="alert in nearbyAlerts" 
          :key="alert.id" 
          :class="['alert-item', { 'own-alert': alert.isOwnAlert }]"
        >
          <div class="alert-header">
            <span class="alert-type">{{ alert.emergencyType }}</span>
            <span class="alert-distance">{{ formatDistance(alert.distance) }}</span>
          </div>
          <div class="alert-body">
            <p class="alert-message">{{ alert.message }}</p>
            <div class="alert-meta">
              <span>From: {{ alert.userName }}</span>
              <span>{{ formatTime(alert.createdAt) }}</span>
            </div>
          </div>
          <div class="alert-actions" v-if="!alert.isOwnAlert">
            <button @click="respondToAlert(alert.id)" class="respond-btn">Respond</button>
          </div>
        </li>
      </ul>
    </div>
    
    <!-- Response Modal -->
    <div v-if="showResponseModal" class="modal-overlay">
      <div class="modal-content">
        <h3>Respond to Alert</h3>
        <p>Send a message to the person in need:</p>
        <textarea 
          v-model="responseMessage" 
          placeholder="How can you help? (e.g., 'I'm nearby and can assist')"
          rows="3"
        ></textarea>
        <div class="modal-actions">
          <button @click="showResponseModal = false" class="cancel-btn">Cancel</button>
          <button @click="submitResponse" :disabled="!responseMessage.trim()" class="submit-btn">
            Send Response
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, computed, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { auth } from '../firebase'
import { signOut, onAuthStateChanged } from 'firebase/auth'
import { 
  startLocationTracking, 
  stopLocationTracking, 
  findNearbyUsers 
} from '../services/locationService'
import { 
  sendEmergencyAlert, 
  getNearbyAlerts, 
  respondToAlert as respondToAlertService 
} from '../services/alertService'
import { 
  initMap, 
  centerMapOnUserLocation, 
  showNearbyUsers, 
  showAlerts, 
  cleanupMap 
} from '../services/mapService'
import { askGemini } from '../services/geminiService'

export default {
  name: 'HomePage',
  
  setup() {
    // User state
    const user = ref(null)
    const router = useRouter()
    
    // Map references
    const mapElement = ref(null)
    const mapAvailable = ref(false)
    
    // UI state
    const showGeminiPanel = ref(false)
    
    // Alert form
    const alertMessage = ref('')
    const emergencyType = ref('general')
    const isLoading = ref(false)
    const alertSent = ref(false)
    const notificationMessage = ref('')
    
    // Gemini chat
    const geminiQuestion = ref('')
    const geminiResponse = ref('')
    const geminiLoading = ref(false)
    
    // Location tracking
    const locationTracking = ref(false)
    const locationStatus = ref('Location tracking inactive')
    const locationErrorMessage = ref('')
    const mockLocation = ref(false) // For testing when geolocation is not available
    
    // Nearby users and alerts
    const nearbyUsers = ref([])
    const nearbyAlerts = ref([])
    
    // Response modal
    const showResponseModal = ref(false)
    const responseMessage = ref('')
    const currentAlertId = ref(null)
    
    // Emergency types
    const emergencyTypes = [
      { label: 'General', value: 'general' },
      { label: 'Medical', value: 'medical' },
      { label: 'Safety', value: 'safety' },
      { label: 'Harassment', value: 'harassment' }
    ]
    
    // Computed properties
    const canSendAlert = computed(() => {
      return alertMessage.value.trim().length > 0 && locationTracking.value;
    })
    
    const formattedGeminiResponse = computed(() => {
      if (!geminiResponse.value) return '';
      // Convert line breaks to <br> for HTML display
      return geminiResponse.value.replace(/\n/g, '<br>');
    })
    
    // Methods
    const initializeMap = async () => {
      try {
        await initMap('map')
        mapAvailable.value = true
        
        try {
          const location = await centerMapOnUserLocation(5) // 5km radius
          console.log('Map centered at:', location)
          
          // Show nearby users on map
          await refreshNearbyUsers()
          
          // Show nearby alerts
          await refreshNearbyAlerts()
        } catch (geoError) {
          console.error('Geolocation error:', geoError)
          if (geoError.code === 1) { // Permission denied
            locationErrorMessage.value = 'Location permission denied. Please enable location access to use all features.'
          } else if (geoError.code === 2) { // Position unavailable
            locationErrorMessage.value = 'Unable to determine your location. Please try again later.'
          } else if (geoError.code === 3) { // Timeout
            locationErrorMessage.value = 'Location request timed out. Using default location.'
          } else {
            locationErrorMessage.value = 'Error getting location: ' + geoError.message
          }
          
          // Use a default location for development
          mockLocation.value = true
          locationStatus.value = 'Using demo location'
        }
      } catch (mapError) {
        console.error('Error initializing map:', mapError)
        mapAvailable.value = false
        locationStatus.value = 'Map service unavailable'
        locationErrorMessage.value = 'Google Maps could not be loaded. Some features will be limited.'
      }
    }
    
    const startTracking = async () => {
      try {
        // Check for mock mode first
        if (mockLocation.value) {
          locationTracking.value = true
          locationStatus.value = 'Using demo location'
          return true
        }
        
        const started = await startLocationTracking()
        locationTracking.value = started
        locationStatus.value = started 
          ? 'Location tracking active' 
          : 'Error starting location tracking'
          
        if (!started) {
          // Fall back to mock location if tracking fails
          mockLocation.value = true
          locationTracking.value = true
          locationStatus.value = 'Using demo location'
        }
        
        return locationTracking.value
      } catch (error) {
        console.error('Error starting location tracking:', error)
        locationTracking.value = false
        locationStatus.value = 'Error starting location tracking'
        
        // Fall back to mock location
        mockLocation.value = true
        locationTracking.value = true
        locationStatus.value = 'Using demo location'
        
        return locationTracking.value
      }
    }
    
    const refreshNearbyUsers = async () => {
      try {
        if (mockLocation.value) {
          // Use mock data for development
          nearbyUsers.value = [
            { uid: 'mock1', displayName: 'Demo User 1', distance: 0.8 },
            { uid: 'mock2', displayName: 'Demo User 2', distance: 1.5 },
            { uid: 'mock3', displayName: 'Demo User 3', distance: 2.3 }
          ]
          return
        }
        
        // Find users within 5km
        const users = await findNearbyUsers(5)
        nearbyUsers.value = users
        
        // Show users on map
        if (mapAvailable.value) {
          await showNearbyUsers(5)
        }
      } catch (error) {
        console.error('Error finding nearby users:', error)
        // Use mock data when real data can't be fetched
        if (nearbyUsers.value.length === 0) {
          nearbyUsers.value = [
            { uid: 'mock1', displayName: 'Demo User 1', distance: 0.8 },
            { uid: 'mock2', displayName: 'Demo User 2', distance: 1.5 }
          ]
        }
      }
    }
    
    const refreshNearbyAlerts = async () => {
      try {
        if (mockLocation.value) {
          // Use mock data for development
          nearbyAlerts.value = [
            { 
              id: 'mock1', 
              userId: 'mock-user-1',
              userName: 'Demo Alert Sender',
              message: 'This is a demonstration alert. In a real emergency, detailed information would appear here.',
              emergencyType: 'general',
              distance: 1.2,
              createdAt: new Date(),
              isOwnAlert: false
            }
          ]
          return
        }
        
        // Get alerts within 10km
        const alerts = await getNearbyAlerts(10)
        nearbyAlerts.value = alerts
        
        // Show alerts on map
        if (mapAvailable.value) {
          await showAlerts(alerts)
        }
      } catch (error) {
        console.error('Error getting nearby alerts:', error)
        // Use mock data when real data can't be fetched
        if (nearbyAlerts.value.length === 0) {
          nearbyAlerts.value = [
            { 
              id: 'mock1', 
              userId: 'mock-user-1',
              userName: 'Demo Alert Sender',
              message: 'This is a demonstration alert. In a real emergency, detailed information would appear here.',
              emergencyType: 'general',
              distance: 1.2,
              createdAt: new Date(),
              isOwnAlert: false
            }
          ]
        }
      }
    }
    
    const sendAlert = async () => {
      if (!canSendAlert.value) return
      
      isLoading.value = true
      alertSent.value = false
      
      try {
        if (mockLocation.value) {
          // Simulate sending an alert in demo mode
          console.log('Demo mode: Simulating alert send')
          
          setTimeout(() => {
            alertSent.value = true
            notificationMessage.value = 'Demo mode: Alert simulated. In a real app, nearby users would be notified.'
            
            // Add the user's alert to the list
            nearbyAlerts.value.unshift({
              id: 'user-mock-' + Date.now(),
              userId: auth.currentUser.uid,
              userName: auth.currentUser.displayName || auth.currentUser.email,
              message: alertMessage.value,
              emergencyType: emergencyType.value,
              distance: 0,
              createdAt: new Date(),
              isOwnAlert: true
            })
            
            // Clear form
            alertMessage.value = ''
          }, 1500)
          
          return
        }
        
        // Real alert sending
        const result = await sendEmergencyAlert(alertMessage.value, emergencyType.value)
        console.log('Alert sent:', result)
        
        alertSent.value = true
        notificationMessage.value = `Alert sent to ${result.notifiedUsers} nearby users.`
        
        // Clear form
        alertMessage.value = ''
        
        // Refresh alerts
        await refreshNearbyAlerts()
      } catch (error) {
        console.error('Error sending alert:', error)
        
        // Check for specific errors
        if (error.name === 'GeolocationPositionError') {
          if (error.code === 1) { // Permission denied
            notificationMessage.value = 'Location permission denied. Please enable location access to send alerts.'
          } else {
            notificationMessage.value = 'Error getting location. Please try again later.'
          }
        } else {
          notificationMessage.value = 'Error sending alert. Please try again.'
        }
        
        // Fall back to mock mode if location errors occur
        if (!mockLocation.value && 
            (error.name === 'GeolocationPositionError' || 
             error.message?.includes('location'))) {
          mockLocation.value = true
          locationTracking.value = true
          locationStatus.value = 'Using demo location'
        }
      } finally {
        isLoading.value = false
        
        // Auto-hide the success message after 5 seconds
        if (alertSent.value) {
          setTimeout(() => {
            alertSent.value = false
          }, 5000)
        }
      }
    }
    
    const askGeminiAI = async () => {
      if (!geminiQuestion.value.trim()) return;
      
      geminiLoading.value = true;
      geminiResponse.value = '';
      
      try {
        const response = await askGemini(geminiQuestion.value);
        geminiResponse.value = response;
      } catch (error) {
        console.error('Error asking Gemini:', error);
        geminiResponse.value = 'Sorry, there was an error getting a response. Please try again later.';
      } finally {
        geminiLoading.value = false;
      }
    };
    
    const respondToAlert = (alertId) => {
      currentAlertId.value = alertId
      showResponseModal.value = true
    }
    
    const submitResponse = async () => {
      if (!responseMessage.value.trim() || !currentAlertId.value) return
      
      try {
        await respondToAlertService(currentAlertId.value, responseMessage.value)
        showResponseModal.value = false
        responseMessage.value = ''
        currentAlertId.value = null
      } catch (error) {
        console.error('Error sending response:', error)
      }
    }
    
    const logout = async () => {
      try {
        // Stop location tracking
        stopLocationTracking()
        
        // Clean up map
        cleanupMap()
        
        // Sign out
        await signOut(auth)
        
        // Navigate to login
        router.push('/login')
      } catch (error) {
        console.error('Error logging out:', error)
      }
    }
    
    // Helper functions
    const formatDistance = (distance) => {
      if (distance < 1) {
        return `${Math.round(distance * 1000)} m`
      }
      return `${distance.toFixed(1)} km`
    }
    
    const formatTime = (dateTime) => {
      const date = new Date(dateTime)
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
    
    // Lifecycle hooks
    onMounted(() => {
      // Check if user is logged in
      onAuthStateChanged(auth, (currentUser) => {
        user.value = currentUser
        if (!currentUser) {
          router.push('/login')
          return
        }
        
        // Start location tracking
        startTracking()
        
        // Initialize map
        if (mapElement.value) {
          initializeMap()
        }
        
        // Set up refresh intervals
        const userInterval = setInterval(refreshNearbyUsers, 30000) // Every 30 seconds
        const alertInterval = setInterval(refreshNearbyAlerts, 15000) // Every 15 seconds
        
        // Clean up intervals on component unmount
        onBeforeUnmount(() => {
          clearInterval(userInterval)
          clearInterval(alertInterval)
        })
      })
      
      // Expose response function for map markers
      window.respondToAlert = respondToAlert
    })
    
    onBeforeUnmount(() => {
      // Stop location tracking
      stopLocationTracking()
      
      // Clean up map
      cleanupMap()
    })
    
    return {
      user,
      mapElement,
      mapAvailable,
      showGeminiPanel,
      alertMessage,
      emergencyType,
      emergencyTypes,
      isLoading,
      alertSent,
      notificationMessage,
      geminiQuestion,
      geminiResponse,
      geminiLoading,
      formattedGeminiResponse,
      locationTracking,
      locationStatus,
      locationErrorMessage,
      mockLocation,
      nearbyUsers,
      nearbyAlerts,
      showResponseModal,
      responseMessage,
      canSendAlert,
      sendAlert,
      askGeminiAI,
      logout,
      respondToAlert,
      submitResponse,
      formatDistance,
      formatTime
    }
  }
}
</script>

<style scoped>
.app-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  max-height: 100vh;
  overflow: hidden;
}

.app-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  background-color: #4285F4;
  color: white;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.logo h1 {
  margin: 0;
  font-size: 1.5rem;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.logout-btn {
  background-color: transparent;
  border: 1px solid white;
  color: white;
  padding: 0.5rem 1rem;
  cursor: pointer;
  border-radius: 4px;
  transition: background-color 0.3s;
}

.logout-btn:hover {
  background-color: rgba(255, 255, 255, 0.1);
}

.main-content {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  padding: 1rem;
  height: calc(100vh - 70px);
  overflow: auto;
}

.alert-panel, .map-container {
  background: white;
  border-radius: 8px;
  padding: 1.5rem;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
  overflow: auto;
}

.intro-text {
  color: #666;
  margin-bottom: 1.5rem;
}

.emergency-type {
  margin-bottom: 1rem;
}

.type-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.type-btn {
  padding: 0.5rem 1rem;
  border: 1px solid #ddd;
  background-color: #f5f5f5;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}

.type-btn.active {
  background-color: #4285F4;
  color: white;
  border-color: #4285F4;
}

.message-input {
  margin-bottom: 1rem;
}

textarea {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  resize: vertical;
  font-family: inherit;
  font-size: 1rem;
}

.location-status {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1rem;
  font-size: 0.9rem;
  color: #666;
}

.status-indicator {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background-color: #ccc;
}

.status-indicator.active {
  background-color: #34A853;
}

.location-error {
  margin-bottom: 1rem;
  padding: 0.75rem;
  background-color: #ffebee;
  border-left: 4px solid #f44336;
  border-radius: 4px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.demo-mode-badge {
  background-color: #ff9800;
  color: white;
  border: none;
  border-radius: 4px;
  padding: 0.25rem 0.5rem;
  font-size: 0.75rem;
  cursor: pointer;
}

.button-group {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.send-alert-btn {
  flex: 2;
  padding: 0.75rem;
  background-color: #EA4335;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 1rem;
  font-weight: bold;
  cursor: pointer;
  transition: background-color 0.3s;
}

.send-alert-btn:hover:not(:disabled) {
  background-color: #d23c2a;
}

.send-alert-btn:disabled {
  background-color: #f5a199;
  cursor: not-allowed;
}

.ask-gemini-toggle-btn {
  flex: 1;
  padding: 0.75rem;
  background-color: #4285F4;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 1rem;
  font-weight: bold;
  cursor: pointer;
  transition: background-color 0.3s;
}

.ask-gemini-toggle-btn:hover {
  background-color: #3b77db;
}

.gemini-panel {
  margin-top: 1rem;
  padding: 1rem;
  background-color: #f5f8ff;
  border-radius: 8px;
  border: 1px solid #d0e1fd;
  animation: fadeIn 0.3s ease-in-out;
}

.gemini-intro {
  font-size: 0.9rem;
  color: #666;
  margin-bottom: 1rem;
}

.ask-gemini-btn {
  width: 100%;
  padding: 0.75rem;
  background-color: #4285F4;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 1rem;
  font-weight: bold;
  cursor: pointer;
  transition: background-color 0.3s;
}

.ask-gemini-btn:hover:not(:disabled) {
  background-color: #3b77db;
}

.ask-gemini-btn:disabled {
  background-color: #a8c7fa;
  cursor: not-allowed;
}

.gemini-response {
  margin-top: 1rem;
  padding: 1rem;
  background-color: white;
  border-left: 4px solid #4285F4;
  border-radius: 4px;
  max-height: 200px;
  overflow-y: auto;
}

.gemini-response h4 {
  margin-top: 0;
  color: #4285F4;
  margin-bottom: 0.5rem;
}

.alert-success {
  margin-top: 1rem;
  padding: 1rem;
  background-color: #e6f4ea;
  border-left: 4px solid #34A853;
  border-radius: 4px;
}

.alert-success h3 {
  margin-top: 0;
  color: #34A853;
}

#map {
  height: 300px;
  width: 100%;
  border-radius: 8px;
  margin-bottom: 1rem;
}

.nearby-users {
  background-color: #f9f9f9;
  border-radius: 8px;
  padding: 1rem;
}

.no-users {
  text-align: center;
  color: #666;
  padding: 1rem;
}

.user-list {
  list-style: none;
  padding: 0;
  margin: 0;
  max-height: 200px;
  overflow-y: auto;
}

.user-item {
  padding: 0.75rem;
  border-bottom: 1px solid #eee;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.user-item:last-child {
  border-bottom: none;
}

.alerts-panel {
  padding: 1rem;
  background-color: #f9f9f9;
  border-top: 1px solid #eee;
  max-height: 250px;
  overflow-y: auto;
}

.alert-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1rem;
}

.alert-item {
  background-color: white;
  border-radius: 8px;
  padding: 1rem;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  display: flex;
  flex-direction: column;
  border-left: 4px solid #EA4335;
}

.alert-item.own-alert {
  border-left-color: #4285F4;
}

.alert-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 0.5rem;
}

.alert-type {
  font-weight: bold;
  color: #333;
}

.alert-distance {
  color: #666;
  font-size: 0.9rem;
}

.alert-message {
  margin: 0.5rem 0;
}

.alert-meta {
  display: flex;
  justify-content: space-between;
  font-size: 0.9rem;
  color: #666;
}

.alert-actions {
  margin-top: 1rem;
  display: flex;
  justify-content: flex-end;
}

.respond-btn {
  background-color: #4285F4;
  color: white;
  border: none;
  border-radius: 4px;
  padding: 0.5rem 1rem;
  cursor: pointer;
  transition: background-color 0.3s;
}

.respond-btn:hover {
  background-color: #3b77db;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.modal-content {
  background-color: white;
  border-radius: 8px;
  padding: 1.5rem;
  width: 90%;
  max-width: 500px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
}

.modal-content h3 {
  margin-top: 0;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
  margin-top: 1rem;
}

.cancel-btn {
  background-color: #f5f5f5;
  color: #333;
  border: 1px solid #ddd;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;
}

.submit-btn {
  background-color: #4285F4;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;
}

.submit-btn:disabled {
  background-color: #a8c7fa;
  cursor: not-allowed;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* Responsive design */
@media (max-width: 768px) {
  .main-content {
    grid-template-columns: 1fr;
  }
  
  .alert-list {
    grid-template-columns: 1fr;
  }
  
  .button-group {
    flex-direction: column;
  }
}
</style> 