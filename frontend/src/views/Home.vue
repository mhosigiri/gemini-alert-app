<template>
  <div class="app-container">
    <header class="app-header">
      <div class="logo">
        <h1>Gemini Alert</h1>
      </div>
      <div class="user-info" v-if="user">
        <span>{{ user.displayName || user.email }}</span>
        <button @click="showPrivacySettings = true" class="settings-btn">⚙️ Privacy</button>
        <button @click="logout" class="logout-btn">Sign Out</button>
      </div>
    </header>
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
        <div v-if="showGeminiPanel" class="gemini-panel">
          <div class="gemini-header">
            <div class="gemini-header-icon">🤖</div>
            <div class="gemini-header-text">
              <h3>Emergency AI Assistant</h3>
              <p class="gemini-intro">Get instant guidance for crisis situations</p>
            </div>
          </div>
          <div class="chat-container">
            <div v-if="chatHistory.length === 0" class="empty-chat">
              <div class="empty-chat-icon">💬</div>
              <p class="empty-chat-title">How can I help you?</p>
              <p class="empty-chat-subtitle">Ask about emergency procedures, safety tips, or crisis response guidance.</p>
            </div>
            <div v-else class="chat-messages" ref="chatMessagesContainer">
              <div 
                v-for="(message, index) in chatHistory" 
                :key="index" 
                :class="['chat-message', message.sender === 'user' ? 'user-message' : 'ai-message']"
              >
                <div class="message-avatar">
                  <span v-if="message.sender === 'user'">👤</span>
                  <span v-else>🤖</span>
                </div>
                <div class="message-bubble">
                  <div 
                    class="message-text" 
                    v-html="formatMessageText(message.text)"
                  ></div>
                  <div class="message-actions" v-if="message.sender === 'ai'">
                    <button
                      @click="speakMessage(message.text)"
                      :disabled="isSpeaking"
                      class="message-action-btn"
                      title="Listen"
                    >
                      🔊
                    </button>
                    <button
                      @click="copyMessage(message.text)"
                      class="message-action-btn"
                      title="Copy"
                    >
                      📋
                    </button>
                  </div>
                </div>
              </div>
              <div v-if="geminiLoading" class="chat-message ai-message">
                <div class="message-avatar">
                  <span>🤖</span>
                </div>
                <div class="message-bubble typing-indicator">
                  <span class="dot"></span>
                  <span class="dot"></span>
                  <span class="dot"></span>
                </div>
              </div>
            </div>
          </div>
          <div class="chat-input-area">
            <textarea
              v-model="geminiQuestion"
              placeholder="Type your message..."
              rows="1"
              class="chat-input"
              @keydown.enter.prevent="handleEnterKey"
            ></textarea>
            <div class="chat-controls">
              <button
                @click="toggleVoiceInput"
                :class="['voice-input-btn', { active: isListening }]"
                :disabled="!isSpeechRecognitionAvailable"
                :title="isSpeechRecognitionAvailable ? 'Voice input' : 'Not available'"
              >
                🎤
              </button>
              <button
                @click="askGeminiAI"
                :disabled="!geminiQuestion.trim() || geminiLoading"
                class="send-message-btn"
                title="Send message"
              >
                ➤
              </button>
            </div>
          </div>
        </div>
      </div>
      <div class="map-container">
        <h2>Emergency Map</h2>
        <div id="map" ref="mapElement"></div>
      </div>
    </main>
    <div class="alerts-panel">
      <h2>Active Alerts Nearby</h2>
      <div v-if="nearbyAlerts.length === 0" class="no-alerts">
        <p>No active emergency alerts in your area.</p>
      </div>
      <ul v-else class="alert-list">
        <li
          v-for="alert in nearbyAlerts"
          :key="alert.id"
          :class="['alert-item', { 'own-alert': alert.isOwnAlert }]"
        >
          <div class="alert-header">
            <span class="alert-type">{{ alert.emergencyType }}</span>
            <span class="alert-distance">{{ formatDistance(alert.distance) }}</span>
          </div>
          <div class="alert-timer">
            <span class="timer-icon">⏱️</span>
            <span class="timer-text">{{ getRemainingTime(alert.createdAt) }}</span>
          </div>
          <div class="alert-body">
            <p class="alert-message">{{ alert.message }}</p>
            <div class="alert-meta">
              <span>From: {{ alert.userName }}</span>
              <span>{{ formatTime(alert.createdAt) }}</span>
            </div>
          </div>
          <div v-if="alert.responses.length > 0" class="alert-responses">
            <h4>Responses:</h4>
            <ul>
              <li
                v-for="response in alert.responses"
                :key="response.responseId || response.userId"
              >
                <strong>{{ response.userName }}:</strong> {{ response.message }}
                <span class="response-time">{{ formatTime(response.timestamp) }}</span>
              </li>
            </ul>
          </div>
          <div class="alert-actions">
            <button @click="respondToAlert(alert.id)" class="respond-btn">
              {{ alert.isOwnAlert ? 'Add Update' : 'Respond' }}
            </button>
          </div>
        </li>
      </ul>
    </div>
    <div v-if="showResponseModal" class="modal-overlay">
      <div class="modal-content">
        <h3>{{ respondingToOwnAlert ? 'Update Your Alert' : 'Respond to Alert' }}</h3>
        <p>
          {{
            respondingToOwnAlert
              ? 'Share additional details or updates for helpers nearby.'
              : 'Send a message to the person in need:'
          }}
        </p>
        <textarea
          v-model="responseMessage"
          placeholder="How can you help? (e.g., 'I'm nearby and can assist')"
          rows="3"
        ></textarea>
        <div class="modal-actions">
          <button @click="closeResponseModal" class="cancel-btn">Cancel</button>
          <button @click="submitResponse" :disabled="!responseMessage.trim()" class="submit-btn">
            Send Response
          </button>
        </div>
      </div>
    </div>
    <div v-if="showPrivacySettings" class="modal-overlay">
      <div class="modal-content privacy-modal">
        <button @click="showPrivacySettings = false" class="close-btn">×</button>
        <PrivacySettings />
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
  getPrivacySettings,
  getNearestUsers,
  getCurrentLocation
} from '../services/locationService'
import {
  sendEmergencyAlert,
  getNearbyAlerts,
  respondToAlert as respondToAlertService,
  subscribeToNearbyAlerts
} from '../services/alertService'
import {
  initMap,
  centerMapOnUserLocation,
  showNearbyUsers,
  showAlerts,
  cleanupMap
} from '../services/mapService'
import { askGeminiStream, getChatHistory } from '../services/geminiService'
import PrivacySettings from '../components/PrivacySettings.vue'
export default {
  name: 'HomePage',
  components: {
    PrivacySettings
  },
  setup() {
    // User state
    const user = ref(null)
    const router = useRouter()
    // Map references
    const mapElement = ref(null)
    const mapAvailable = ref(false)
    // UI state
    const showGeminiPanel = ref(false)
    const showPrivacySettings = ref(false)
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
    const chatHistory = ref([])  // Store conversation history
    // Location tracking
    const locationTracking = ref(false)
    const locationStatus = ref('Location tracking inactive')
    const locationErrorMessage = ref('')
    // Nearby users and alerts
    const nearbyUsers = ref([])
    const nearbyAlerts = ref([])
    // Response modal
    const showResponseModal = ref(false)
    const responseMessage = ref('')
    const currentAlertId = ref(null)
    const respondingToOwnAlert = ref(false)
    // Emergency types
    const emergencyTypes = [
      { label: 'General', value: 'general' },
      { label: 'Medical', value: 'medical' },
      { label: 'Safety', value: 'safety' },
      { label: 'Harassment', value: 'harassment' }
    ]
    // Voice recognition and speech synthesis
    const isListening = ref(false)
    const isSpeaking = ref(false)
    const speechRecognition = ref(null)
    const speechSynthesis = ref(window.speechSynthesis || null)
    const isSpeechRecognitionAvailable = ref(false)
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
          await centerMapOnUserLocation(5) // 5km radius
          // Show nearby users on map
          await refreshNearbyUsers()
          // Show nearby alerts
          await refreshNearbyAlerts()
        } catch (geoError) {
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
          // mockLocation.value = true // Removed mockLocation
          locationStatus.value = 'Using demo location'
        }
      } catch (mapError) {
        mapAvailable.value = false
        locationStatus.value = 'Map service unavailable'
        
        // Provide specific error messages
        if (mapError.message && mapError.message.includes('restricted')) {
          locationErrorMessage.value = 'Google Maps API key is restricted. Please update API key restrictions in Google Cloud Console. See console for details.'
        } else if (mapError.message && mapError.message.includes('not found')) {
          locationErrorMessage.value = 'Map element not found. Please refresh the page.'
        } else {
          locationErrorMessage.value = `Google Maps could not be loaded: ${mapError.message || 'Unknown error'}. Some features will be limited.`
        }
        
        console.error('Map initialization failed:', mapError)
      }
    }
    const startTracking = async () => {
      try {
        // Check for mock mode first
        // if (mockLocation.value) { // Removed mockLocation
        //   locationTracking.value = true
        //   locationStatus.value = 'Using demo location'
        //   return true
        // }
        const started = await startLocationTracking()
        locationTracking.value = started
        locationStatus.value = started
          ? 'Location tracking active'
          : 'Error starting location tracking'
        if (!started) {
          // Fall back to mock location if tracking fails
          // mockLocation.value = true // Removed mockLocation
          locationTracking.value = true
          locationStatus.value = 'Using demo location'
        }
        return locationTracking.value
      } catch (error) {
        locationTracking.value = false
        locationStatus.value = 'Error starting location tracking'
        // Fall back to mock location
        // mockLocation.value = true // Removed mockLocation
        locationTracking.value = true
        locationStatus.value = 'Using demo location'
        return locationTracking.value
      }
    }
    const refreshNearbyUsers = async () => {
      try {
        // Check privacy settings
        const privacySettings = getPrivacySettings()
        if (!privacySettings.shareWithNearbyUsers) {
          nearbyUsers.value = []
          return
        }
        // Get current location
        const position = await getCurrentLocation()
        const { latitude, longitude } = position.coords
        // Get nearest users from backend
        const users = await getNearestUsers(latitude, longitude)
        nearbyUsers.value = users.map(user => ({
          uid: user.userId,
          displayName: user.displayName,
          distance: user.distance_km,
          latitude: user.latitude,
          longitude: user.longitude
        }))
        // Show users on map
        if (mapAvailable.value) {
          await showNearbyUsers(5)
        }
      } catch (error) {
        nearbyUsers.value = []
        }
      }
    const refreshNearbyAlerts = async () => {
      try {
        // Get alerts within 10km
        const alerts = await getNearbyAlerts(10)
        nearbyAlerts.value = alerts
        // Show alerts on map
        if (mapAvailable.value) {
          await showAlerts(alerts)
        }
      } catch (error) {
        nearbyAlerts.value = []
        }
      }
    const sendAlert = async () => {
      if (!canSendAlert.value) return
      isLoading.value = true
      alertSent.value = false
      try {
        // Send real alert
        await sendEmergencyAlert(alertMessage.value, emergencyType.value)
        alertSent.value = true
        notificationMessage.value = 'Your alert has been sent to users in your area.'
        // Refresh alerts to include the one we just sent
        await refreshNearbyAlerts()
      } catch (error) {
        alertSent.value = true
        notificationMessage.value = 'There was an error sending your alert. Please try again.'
      } finally {
        isLoading.value = false
      }
    }
    const askGeminiAI = async () => {
      if (!geminiQuestion.value.trim()) return;
      // Add the user's message to chat history
      chatHistory.value.push({
        sender: 'user',
        text: geminiQuestion.value,
        timestamp: new Date()
      });
      // Store the question
      const question = geminiQuestion.value;
      // Clear the input field so the user can type a new message
      geminiQuestion.value = '';
      geminiLoading.value = true;
      geminiResponse.value = '';
      try {
        // Use the streaming API for a more interactive experience
        let fullResponse = '';
        const handleChunk = (chunk) => {
          fullResponse += chunk;
          geminiResponse.value = fullResponse;
          // Update the last AI message or add a new one if it doesn't exist yet
          if (chatHistory.value.length > 0 && chatHistory.value[chatHistory.value.length - 1].sender === 'ai') {
            chatHistory.value[chatHistory.value.length - 1].text = fullResponse;
          } else {
            chatHistory.value.push({
              sender: 'ai',
              text: fullResponse,
              timestamp: new Date()
            });
          }
        };
        await askGeminiStream(question, handleChunk);
      } catch (error) {
        const errorMessage = 'Sorry, there was an error getting a response. Please try again later.';
        geminiResponse.value = errorMessage;
        // Add error message to chat history
        chatHistory.value.push({
          sender: 'ai',
          text: errorMessage,
          timestamp: new Date(),
          isError: true
        });
      } finally {
        geminiLoading.value = false;
      }
    };
    const respondToAlert = (alertId) => {
      const targetAlert = nearbyAlerts.value.find(alert => alert.id === alertId)
      respondingToOwnAlert.value = !!(targetAlert && targetAlert.isOwnAlert)
      currentAlertId.value = alertId
      responseMessage.value = ''
      showResponseModal.value = true
    }
    const closeResponseModal = () => {
      showResponseModal.value = false
      responseMessage.value = ''
      currentAlertId.value = null
      respondingToOwnAlert.value = false
    }
    const submitResponse = async () => {
      if (!responseMessage.value.trim() || !currentAlertId.value) return
      try {
        await respondToAlertService(currentAlertId.value, responseMessage.value)
        await refreshNearbyAlerts()
        closeResponseModal()
      } catch (error) {
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
      }
    }
    // Helper functions
    const formatDistance = (distance) => {
      if (typeof distance !== 'number') {
        return '...';
      }
      if (distance < 1) {
        return `${Math.round(distance * 1000)} m`
      }
      return `${distance.toFixed(1)} km`
    }
    const formatTime = (dateTime) => {
      const date = new Date(dateTime)
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
    
    const getRemainingTime = (createdAt) => {
      const now = Date.now();
      const alertTime = createdAt instanceof Date ? createdAt.getTime() : createdAt;
      const threeHoursInMs = 3 * 60 * 60 * 1000;
      const elapsed = now - alertTime;
      const remaining = threeHoursInMs - elapsed;
      
      if (remaining <= 0) {
        return 'Expired';
      }
      
      const hours = Math.floor(remaining / (60 * 60 * 1000));
      const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
      
      if (hours > 0) {
        return `${hours}h ${minutes}m remaining`;
      }
      return `${minutes}m remaining`;
    }
    // Chat functionality
    const formatMessageText = (text) => {
      if (!text) return '';
      // Escape HTML to prevent XSS attacks
      let formatted = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      
      // Convert markdown formatting
      // **text** for bold titles/headings
      formatted = formatted.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
      // *text* for emphasis/bold
      formatted = formatted.replace(/\*(.+?)\*/g, '<em>$1</em>');
      // Convert line breaks to <br> for HTML display
      formatted = formatted.replace(/\n/g, '<br>');
      
      return formatted;
    }
    const handleEnterKey = (event) => {
      // Only proceed if not Shift+Enter and there's content to send
      if (!event.shiftKey && geminiQuestion.value.trim()) {
        askGeminiAI();
      }
    }
    // Voice functionality
    const toggleVoiceInput = () => {
      if (!speechRecognition.value) {
        return
      }
      if (isListening.value) {
        speechRecognition.value.stop()
      } else {
        // Clear the input first
        if (!geminiQuestion.value.trim()) {
          geminiQuestion.value = ''
        }
        try {
          speechRecognition.value.start()
        } catch (error) {
        }
      }
    }
    const speakMessage = (text) => {
      if (!speechSynthesis.value) {
        return
      }
      if (isSpeaking.value) {
        speechSynthesis.value.cancel()
        isSpeaking.value = false
        return
      }
      // Strip HTML tags from response
      const plainText = text.replace(/<[^>]*>/g, '')
      const utterance = new SpeechSynthesisUtterance(plainText)
      utterance.lang = 'en-US'
      utterance.rate = 1.0
      utterance.pitch = 1.0
      utterance.onstart = () => {
        isSpeaking.value = true
      }
      utterance.onend = () => {
        isSpeaking.value = false
      }
      utterance.onerror = () => {
        isSpeaking.value = false
      }
      speechSynthesis.value.speak(utterance)
    }
    // For backward compatibility
    const speakResponse = () => {
      if (geminiResponse.value) {
        speakMessage(geminiResponse.value);
      }
    }
    const copyMessage = (text) => {
      const plainText = text.replace(/<[^>]*>/g, '')
      navigator.clipboard.writeText(plainText)
        .then(() => {
          alert('Message copied to clipboard')
        })
        .catch(() => {
        })
    }
    // For backward compatibility
    const copyResponse = () => {
      if (geminiResponse.value) {
        copyMessage(geminiResponse.value);
      }
    }
    // Initialize speech recognition if available
    const initSpeechRecognition = () => {
      // Check if the browser supports SpeechRecognition
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
      if (!SpeechRecognition) {
        isSpeechRecognitionAvailable.value = false
        return
      }
      isSpeechRecognitionAvailable.value = true
      try {
        speechRecognition.value = new SpeechRecognition()
        speechRecognition.value.continuous = false
        speechRecognition.value.interimResults = true
        speechRecognition.value.lang = 'en-US'
        speechRecognition.value.onstart = () => {
          isListening.value = true
        }
        speechRecognition.value.onend = () => {
          isListening.value = false
        }
        speechRecognition.value.onresult = (event) => {
          const transcript = event.results[0][0].transcript
          geminiQuestion.value = transcript
        }
        speechRecognition.value.onerror = () => {
          isListening.value = false
        }
      } catch (error) {
        isSpeechRecognitionAvailable.value = false
      }
    }
    // Lifecycle hooks
    let userInterval = null
    let privacyUpdateListener = null
    let authUnsubscribe = null
    let alertsUnsubscribe = null

    const clearScheduledUpdates = () => {
      if (userInterval) {
        clearInterval(userInterval)
        userInterval = null
      }
    }

    const detachPrivacyListener = () => {
      if (privacyUpdateListener) {
        window.removeEventListener('privacy-settings-updated', privacyUpdateListener)
        privacyUpdateListener = null
      }
    }

    onMounted(async () => {
      initSpeechRecognition()
      // Fetch initial chat history
      try {
        const history = await getChatHistory()
        chatHistory.value = history
      } catch (error) {
        console.error("Failed to load chat history:", error)
      }

      // Check if user is logged in
      authUnsubscribe = onAuthStateChanged(auth, async (currentUser) => {
        clearScheduledUpdates()
        detachPrivacyListener()
        if (alertsUnsubscribe) {
          alertsUnsubscribe()
          alertsUnsubscribe = null
        }

        user.value = currentUser
        if (!currentUser) {
          stopLocationTracking()
          cleanupMap()
          router.push('/login')
          return
        }
        
        // Wait for DOM to be fully ready before initializing map
        await new Promise(resolve => setTimeout(resolve, 100))
        
        // Start location tracking
        startTracking()
        
        // Initialize map - wait for element to be available
        if (mapElement.value || document.getElementById('map')) {
          initializeMap()
        } else {
          // Retry after a longer delay if element not found
          setTimeout(() => {
            if (document.getElementById('map')) {
              initializeMap()
            } else {
              console.error('Map element not found after timeout')
            }
          }, 500)
        }
        
        // Set up refresh intervals
        userInterval = setInterval(refreshNearbyUsers, 30000) // Every 30 seconds
        alertsUnsubscribe = subscribeToNearbyAlerts(10, async (alerts) => {
          nearbyAlerts.value = alerts
          if (mapAvailable.value) {
            try {
              await showAlerts(alerts)
            } catch (error) {
              console.error('Failed to update map alerts:', error)
            }
          }
        })
        
        // Listen for privacy settings changes
        const handlePrivacyUpdate = (event) => {
          const { detail } = event
          if (detail.locationSharing !== undefined) {
            if (detail.locationSharing) {
              startTracking()
            } else {
              locationTracking.value = false
              locationStatus.value = 'Location sharing disabled'
            }
          }
        }
        
        window.addEventListener('privacy-settings-updated', handlePrivacyUpdate)
        privacyUpdateListener = handlePrivacyUpdate
      })
    })

    onBeforeUnmount(() => {
      clearScheduledUpdates()
      detachPrivacyListener()
      if (alertsUnsubscribe) {
        alertsUnsubscribe()
        alertsUnsubscribe = null
      }
      if (authUnsubscribe) {
        authUnsubscribe()
        authUnsubscribe = null
      }
    })

    return {
      user,
      mapElement,
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
      chatHistory,
      locationTracking,
      locationStatus,
      locationErrorMessage,
      nearbyUsers,
      nearbyAlerts,
      showResponseModal,
      responseMessage,
      respondingToOwnAlert,
      canSendAlert,
      sendAlert,
      askGeminiAI,
      logout,
      respondToAlert,
      closeResponseModal,
      submitResponse,
      formatDistance,
      formatTime,
      getRemainingTime,
      formatMessageText,
      handleEnterKey,
      isListening,
      isSpeaking,
      isSpeechRecognitionAvailable,
      toggleVoiceInput,
      speakMessage,
      speakResponse,
      copyMessage,
      copyResponse,
      showPrivacySettings
    }
  }
}
</script>
<style scoped>
.app-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 20px;
}
.app-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 0;
  border-bottom: 1px solid #e0e0e0;
  margin-bottom: 1.5rem;
}
.logo h1 {
  color: #3f51b5;
  margin: 0;
}
.user-info {
  display: flex;
  align-items: center;
  gap: 1rem;
}
.settings-btn {
  background-color: transparent;
  border: 1px solid #3f51b5;
  color: #3f51b5;
  border-radius: 4px;
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
  transition: all 0.2s;
}
.settings-btn:hover {
  background-color: #3f51b5;
  color: white;
}
.logout-btn {
  background-color: transparent;
  border: 1px solid #d32f2f;
  color: #d32f2f;
  border-radius: 4px;
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
  transition: all 0.2s;
}
.logout-btn:hover {
  background-color: #d32f2f;
  color: white;
}
.main-content {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2rem;
  margin-bottom: 2rem;
}
@media (max-width: 768px) {
  .main-content {
    grid-template-columns: 1fr;
  }
}
.alert-panel, .map-container {
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  padding: 1.5rem;
}
.intro-text {
  margin-bottom: 1.5rem;
  color: #666;
}
.emergency-type {
  margin-bottom: 1.5rem;
}
.type-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.5rem;
}
.type-btn {
  border: 1px solid #3f51b5;
  background-color: white;
  color: #3f51b5;
  border-radius: 4px;
  padding: 0.5rem 1rem;
  transition: all 0.2s;
}
.type-btn.active, .type-btn:hover {
  background-color: #3f51b5;
  color: white;
}
.message-input {
  margin-bottom: 1.5rem;
}
.message-input label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: bold;
}
.message-input textarea {
  width: 100%;
  border: 1px solid #ccc;
  border-radius: 4px;
  padding: 0.75rem;
  font-family: inherit;
  resize: vertical;
}
.location-status {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1rem;
  font-size: 0.875rem;
}
.status-indicator {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background-color: #ccc;
}
.status-indicator.active {
  background-color: #4caf50;
}
.location-error {
  margin-bottom: 1rem;
  padding: 0.5rem;
  background-color: #ffebee;
  border-radius: 4px;
  font-size: 0.875rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.button-group {
  display: flex;
  gap: 1rem;
  margin-bottom: 1.5rem;
}
.send-alert-btn {
  background-color: #d32f2f;
  color: white;
  border: none;
  border-radius: 4px;
  padding: 0.75rem 1.5rem;
  font-weight: bold;
  flex: 1;
  transition: background-color 0.2s;
}
.send-alert-btn:hover:not(:disabled) {
  background-color: #b71c1c;
}
.send-alert-btn:disabled {
  background-color: #e0e0e0;
  color: #9e9e9e;
  cursor: not-allowed;
}
.ask-gemini-toggle-btn {
  background-color: #3f51b5;
  color: white;
  border: none;
  border-radius: 4px;
  padding: 0.75rem 1.5rem;
  transition: background-color 0.2s;
}
.ask-gemini-toggle-btn:hover {
  background-color: #303f9f;
}
.alert-success {
  background-color: #e8f5e9;
  border-radius: 4px;
  padding: 1rem;
  margin-bottom: 1.5rem;
}
.alert-success h3 {
  color: #4caf50;
  margin-top: 0;
}
.gemini-panel {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 20px;
  padding: 1.5rem;
  margin-top: 1rem;
  border: none;
  display: flex;
  flex-direction: column;
  height: 550px;
  box-shadow: 0 15px 40px rgba(102, 126, 234, 0.3);
}
.gemini-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1rem;
}
.gemini-header-icon {
  width: 44px;
  height: 44px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  backdrop-filter: blur(10px);
}
.gemini-header-text h3 {
  color: white;
  margin: 0;
  font-size: 1.25rem;
  font-weight: 700;
  letter-spacing: -0.3px;
}
.gemini-intro {
  margin: 0.125rem 0 0 0;
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.75);
}
/* Chat container styles */
.chat-container {
  flex: 1;
  overflow: hidden;
  margin-bottom: 1rem;
  border-radius: 16px;
  background-color: #f8f9fb;
  box-shadow: inset 0 2px 10px rgba(0, 0, 0, 0.08);
  display: flex;
  flex-direction: column;
}
.empty-chat {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  text-align: center;
  padding: 2rem;
}
.empty-chat-icon {
  font-size: 2.5rem;
  margin-bottom: 0.75rem;
  opacity: 0.6;
}
.empty-chat-title {
  font-size: 1.1rem;
  font-weight: 600;
  color: #444;
  margin: 0 0 0.5rem 0;
}
.empty-chat-subtitle {
  font-size: 0.85rem;
  color: #888;
  margin: 0;
  line-height: 1.5;
  max-width: 280px;
}
.chat-messages {
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  overflow-y: auto;
  flex: 1;
}
.chat-messages::-webkit-scrollbar {
  width: 5px;
}
.chat-messages::-webkit-scrollbar-track {
  background: transparent;
}
.chat-messages::-webkit-scrollbar-thumb {
  background: rgba(102, 126, 234, 0.25);
  border-radius: 10px;
}
.chat-messages::-webkit-scrollbar-thumb:hover {
  background: rgba(102, 126, 234, 0.4);
}
.chat-message {
  display: flex;
  align-items: flex-start;
  animation: slideIn 0.25s ease-out;
}
@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
.message-avatar {
  width: 32px;
  height: 32px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1rem;
  margin-right: 0.625rem;
  flex-shrink: 0;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  box-shadow: 0 3px 10px rgba(102, 126, 234, 0.3);
}
.user-message .message-avatar {
  background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
  order: 2;
  margin-right: 0;
  margin-left: 0.625rem;
}
.message-bubble {
  position: relative;
  padding: 0.875rem 1rem;
  border-radius: 16px;
  max-width: 85%;
  word-break: break-word;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.06);
}
.user-message {
  justify-content: flex-end;
}
.user-message .message-bubble {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border-bottom-right-radius: 4px;
}
.ai-message .message-bubble {
  background: white;
  color: #2d3748;
  border-bottom-left-radius: 4px;
  border: 1px solid rgba(0, 0, 0, 0.04);
}
.message-text {
  line-height: 1.6;
  font-size: 0.9rem;
}
.message-text strong {
  font-weight: 700;
  font-size: 0.95rem;
  display: block;
  margin: 0.75rem 0 0.4rem 0;
  color: #1a202c;
  border-bottom: 1px solid rgba(102, 126, 234, 0.15);
  padding-bottom: 0.3rem;
}
.message-text strong:first-child {
  margin-top: 0;
}
.user-message .message-text strong {
  color: #fff;
  border-bottom-color: rgba(255, 255, 255, 0.2);
}
.message-text em {
  font-style: normal;
  font-weight: 600;
  color: #667eea;
  background: rgba(102, 126, 234, 0.08);
  padding: 0.1rem 0.3rem;
  border-radius: 4px;
}
.user-message .message-text em {
  color: #fff;
  background: rgba(255, 255, 255, 0.15);
}
.message-actions {
  display: flex;
  gap: 0.375rem;
  margin-top: 0.5rem;
  padding-top: 0.5rem;
  border-top: 1px solid rgba(0, 0, 0, 0.05);
  justify-content: flex-end;
}
.message-action-btn {
  background: transparent;
  border: none;
  cursor: pointer;
  font-size: 0.8rem;
  padding: 0.3rem 0.5rem;
  border-radius: 6px;
  transition: all 0.15s;
  opacity: 0.5;
  display: flex;
  align-items: center;
  gap: 0.2rem;
}
.message-action-btn:hover {
  opacity: 1;
  background: rgba(102, 126, 234, 0.1);
}
.typing-indicator {
  display: flex;
  align-items: center;
  padding: 0.75rem 1rem;
  gap: 0.35rem;
  background: white;
  border-radius: 16px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.06);
  max-width: 70px;
  border: 1px solid rgba(0, 0, 0, 0.04);
}
.dot {
  width: 8px;
  height: 8px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 50%;
  animation: bounce 1.4s infinite ease-in-out both;
}
.dot:nth-child(1) {
  animation-delay: -0.32s;
}
.dot:nth-child(2) {
  animation-delay: -0.16s;
}
@keyframes bounce {
  0%, 80%, 100% {
    transform: scale(0.6);
    opacity: 0.4;
  }
  40% {
    transform: scale(1);
    opacity: 1;
  }
}
#map {
  height: 300px;
  width: 100%;
  margin-bottom: 1.5rem;
  border-radius: 4px;
  border: 1px solid #e0e0e0;
}
.nearby-users h3 {
  margin-top: 0;
  margin-bottom: 1rem;
}
.no-users {
  color: #757575;
  font-style: italic;
}
.user-list {
  list-style: none;
  padding: 0;
  margin: 0;
}
.user-item {
  border-bottom: 1px solid #e0e0e0;
  padding: 0.75rem 0;
}
.user-item:last-child {
  border-bottom: none;
}
.user-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.alerts-panel {
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  padding: 1.5rem;
  margin-bottom: 2rem;
}
.alert-list {
  list-style: none;
  padding: 0;
  margin: 0;
}
.alert-item {
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  padding: 1rem;
  margin-bottom: 1rem;
}
.alert-item.own-alert {
  border-color: #3f51b5;
  background-color: #f5f5ff;
}
.alert-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 0.5rem;
  font-size: 0.875rem;
}
.alert-type {
  background-color: #3f51b5;
  color: white;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  text-transform: capitalize;
}
.alert-timer {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  margin: 0.5rem 0;
  font-size: 0.875rem;
}
.timer-icon {
  font-size: 1rem;
}
.timer-text {
  color: #666;
  font-weight: 500;
}
.alert-body {
  margin-bottom: 1rem;
}
.alert-message {
  margin: 0.5rem 0;
}
.alert-meta {
  display: flex;
  justify-content: space-between;
  font-size: 0.75rem;
  color: #757575;
}
.alert-responses {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid #eee;
}
.alert-responses h4 {
  margin-top: 0;
  margin-bottom: 0.5rem;
  font-size: 0.875rem;
  color: #333;
}
.alert-responses ul {
  list-style: none;
  padding: 0;
  margin: 0;
}
.alert-responses li {
  font-size: 0.875rem;
  margin-bottom: 0.5rem;
  color: #555;
}
.response-time {
  font-size: 0.75rem;
  color: #999;
  margin-left: 0.5rem;
}
.alert-actions {
  display: flex;
  justify-content: flex-end;
}
.respond-btn {
  background-color: #4caf50;
  color: white;
  border: none;
  border-radius: 4px;
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
  transition: background-color 0.2s;
}
.respond-btn:hover {
  background-color: #3d8b40;
}
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 100;
}
.modal-content {
  background-color: white;
  border-radius: 8px;
  padding: 1.5rem;
  width: 90%;
  max-width: 500px;
}
.modal-content h3 {
  margin-top: 0;
}
.modal-content textarea {
  width: 100%;
  border: 1px solid #ccc;
  border-radius: 4px;
  padding: 0.75rem;
  margin: 1rem 0;
  font-family: inherit;
  resize: vertical;
}
.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
}
.cancel-btn {
  background-color: transparent;
  border: 1px solid #757575;
  color: #757575;
  border-radius: 4px;
  padding: 0.5rem 1rem;
}
.submit-btn {
  background-color: #3f51b5;
  color: white;
  border: none;
  border-radius: 4px;
  padding: 0.5rem 1rem;
}
.submit-btn:disabled {
  background-color: #e0e0e0;
  color: #9e9e9e;
  cursor: not-allowed;
}
.privacy-modal {
  max-height: 90vh;
  display: flex;
  flex-direction: column;
}
.privacy-modal .close-btn {
  align-self: flex-end;
  background-color: #f0f0f0;
  border: 1px solid #ccc;
  border-radius: 50%;
  width: 2rem;
  height: 2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  cursor: pointer;
  transition: background-color 0.2s;
}
.privacy-modal .close-btn:hover {
  background-color: #e0e0e0;
}
.no-alerts {
  color: #757575;
  font-style: italic;
  text-align: center;
  padding: 2rem;
}

/* Chat input area styles */
.chat-input-area {
  display: flex;
  gap: 0.75rem;
  padding: 0.75rem;
  background: rgba(255, 255, 255, 0.15);
  border-radius: 16px;
  backdrop-filter: blur(10px);
  align-items: center;
}
.chat-input {
  flex: 1;
  background: white;
  border: none;
  border-radius: 12px;
  padding: 0.75rem 1rem;
  font-family: inherit;
  font-size: 0.9rem;
  resize: none;
  outline: none;
  transition: all 0.2s;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  min-height: 44px;
  max-height: 100px;
}
.chat-input:focus {
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
}
.chat-input::placeholder {
  color: #aaa;
}
.chat-controls {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}
.voice-input-btn,
.send-message-btn {
  width: 42px;
  height: 42px;
  border-radius: 12px;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.1rem;
  cursor: pointer;
  transition: all 0.2s;
  flex-shrink: 0;
}
.voice-input-btn {
  background: white;
  color: #667eea;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}
.voice-input-btn:hover:not(:disabled) {
  background: #f5f5f5;
  transform: translateY(-1px);
}
.voice-input-btn.active {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  animation: pulse-ring 1.5s ease-in-out infinite;
}
@keyframes pulse-ring {
  0% {
    box-shadow: 0 0 0 0 rgba(102, 126, 234, 0.6);
  }
  70% {
    box-shadow: 0 0 0 8px rgba(102, 126, 234, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(102, 126, 234, 0);
  }
}
.voice-input-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.send-message-btn {
  background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
  color: white;
  box-shadow: 0 3px 10px rgba(17, 153, 142, 0.3);
}
.send-message-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 5px 15px rgba(17, 153, 142, 0.4);
}
.send-message-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  background: #ccc;
  box-shadow: none;
}
</style>
