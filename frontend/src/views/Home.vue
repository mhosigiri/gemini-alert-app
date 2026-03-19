<template>
  <div class="page">
    <!-- Header -->
    <header class="hdr">
      <span class="brand">Gemini Alert</span>
      <div class="hdr-right" v-if="user">
        <span class="user-name">{{ user.displayName || user.email }}</span>
        <button @click="showPrivacySettings = true" class="btn-ghost" aria-label="Settings">Settings</button>
        <button @click="logout" class="btn-ghost btn-out" aria-label="Sign out">Sign Out</button>
      </div>
    </header>

    <!-- Liquid Emotion Bar -->
    <div class="emotion-bar-wrap" aria-label="Situation assessment">
      <div class="emotion-bar-track">
        <div 
          class="emotion-bar-fill" 
          :style="{ 
            width: (emotionLevel / 5 * 100) + '%',
            background: barGradient 
          }"
        >
          <div class="liquid-blobs">
            <span class="blob"></span>
            <span class="blob"></span>
            <span class="blob"></span>
          </div>
        </div>
        <div class="emotion-bar-glow" :style="{ background: glowColor, opacity: 0.4 }"></div>
      </div>
      <div class="emotion-meta">
        <span class="emotion-label">{{ emotionLabel }}</span>
        <span class="emotion-level">{{ emotionLevel }}/5</span>
      </div>
    </div>

    <!-- Emergency Quick Actions -->
    <nav class="actions" role="toolbar" aria-label="Emergency quick actions">
      <a href="tel:911" class="action-btn action-critical">Call 911</a>
      <button @click="copyEmergencyNumber" class="action-btn">{{ numberCopied ? 'Copied!' : 'Copy Number' }}</button>
      <button @click="shareLocation" class="action-btn">Share Location</button>
      <button @click="scrollToAlerts" class="action-btn">Threads <span class="badge" v-if="nearbyAlerts.length">{{ nearbyAlerts.length }}</span></button>
    </nav>

    <!-- DR GEMINI Chat — the mascot lives here -->
    <section class="chat">
      <div class="chat-head">
        <div class="dr-avatar">Dr</div>
        <div class="chat-info">
          <h2 class="chat-title">Dr Gemini</h2>
          <p class="chat-sub">Crisis guidance &middot; First aid &middot; De-escalation</p>
        </div>
        <div class="loc-indicator">
          <span :class="['loc-dot', { active: locationTracking }]"></span>
          {{ locationTracking ? 'Live' : 'Off' }}
        </div>
      </div>

      <div class="chat-body">
        <div v-if="chatHistory.length === 0" class="chat-empty">
          <div class="dr-avatar dr-avatar-lg">Dr</div>
          <p class="empty-title">How can I help?</p>
          <p class="empty-sub">Describe your situation or pick a prompt.</p>
          <div class="prompts">
            <button v-for="p in quickPrompts" :key="p" class="prompt-btn" @click="useQuickPrompt(p)">{{ p }}</button>
          </div>
        </div>
        <div v-else class="msgs" ref="chatMessagesContainer">
          <div
            v-for="(msg, i) in chatHistory"
            :key="i"
            :class="['msg', msg.sender === 'user' ? 'msg-user' : 'msg-ai']"
          >
            <div :class="['msg-avatar', msg.sender === 'user' ? 'msg-avatar-user' : 'msg-avatar-ai']">
              <span v-if="msg.sender === 'user'">You</span>
              <span v-else>Dr</span>
            </div>
            <div class="msg-bubble">
              <div class="msg-text" v-html="formatMessageText(msg.text)"></div>
              <div v-if="msg.sender === 'ai'" class="msg-tools">
                <button @click="speakMessage(msg.text)" :disabled="isSpeaking" class="tool-btn" aria-label="Listen">🔊</button>
                <button @click="copyMessage(msg.text)" class="tool-btn" aria-label="Copy">📋</button>
              </div>
            </div>
          </div>
          <div v-if="geminiLoading" class="msg msg-ai">
            <div class="msg-avatar msg-avatar-ai"><span>Dr</span></div>
            <div class="msg-bubble typing"><span class="dot"></span><span class="dot"></span><span class="dot"></span></div>
          </div>
        </div>
      </div>

      <div class="chat-foot">
        <textarea
          v-model="geminiQuestion"
          placeholder="Describe your situation..."
          rows="1"
          class="chat-input"
          @keydown.enter.prevent="handleEnterKey"
          aria-label="Message"
        ></textarea>
        <button
          @click="toggleVoiceInput"
          :class="['circle-btn', { active: isListening }]"
          :disabled="!isSpeechRecognitionAvailable"
          aria-label="Voice input"
        >🎤</button>
        <button
          @click="askGeminiAI"
          :disabled="!geminiQuestion.trim() || geminiLoading"
          class="circle-btn circle-btn-send"
          aria-label="Send"
        >↑</button>
      </div>
    </section>

    <!-- Alert Compose -->
    <section class="compose">
      <h3>Broadcast Alert</h3>
      <div class="type-row">
        <button
          v-for="t in emergencyTypes"
          :key="t.value"
          :class="['type-btn', { active: emergencyType === t.value }]"
          @click="emergencyType = t.value"
        >{{ t.label }}</button>
      </div>
      <textarea
        v-model="alertMessage"
        placeholder="Describe your situation..."
        rows="3"
        class="compose-input"
        aria-label="Alert message"
      ></textarea>
      <div class="compose-foot">
        <span class="compose-loc">
          <span :class="['loc-dot', { active: locationTracking }]"></span>
          {{ locationStatus }}
        </span>
        <button
          @click="sendAlert"
          :disabled="!canSendAlert || isLoading"
          class="btn-danger"
        >{{ isLoading ? 'Sending...' : 'Send Alert' }}</button>
      </div>
      <p v-if="locationErrorMessage" class="err-msg">{{ locationErrorMessage }}</p>
      <p v-if="alertSent" class="ok-msg">{{ notificationMessage }}</p>
    </section>

    <!-- Map + Threads -->
    <div class="secondary">
      <section class="card">
        <h3 class="sec-title">Map</h3>
        <div class="map-wrap">
          <div id="map" ref="mapElement"></div>
        </div>
      </section>

      <section class="card" ref="alertsSection">
        <h3 class="sec-title">Alert Threads <span class="badge" v-if="nearbyAlerts.length">{{ nearbyAlerts.length }}</span></h3>
        <div v-if="nearbyAlerts.length === 0" class="empty-threads">No active alerts nearby.</div>
        <div v-else class="thread-list">
          <div v-for="a in nearbyAlerts" :key="a.id" :class="['thread', { 'thread-own': a.isOwnAlert }]">
            <div class="thread-top">
              <span class="thread-type">{{ a.emergencyType }}</span>
              <span class="thread-dist">{{ formatDistance(a.distance) }}</span>
            </div>
            <p class="thread-body">{{ a.message }}</p>
            <div class="thread-meta">
              <span>{{ a.userName }} · {{ formatTime(a.createdAt) }}</span>
              <span>{{ getRemainingTime(a.createdAt) }}</span>
            </div>
            <div v-if="a.responses && a.responses.length" class="thread-resps">
              <div v-for="r in a.responses" :key="r.responseId || r.userId" class="thread-resp">
                <strong>{{ r.userName }}:</strong> {{ r.message }}
                <span class="resp-time">{{ formatTime(r.timestamp) }}</span>
              </div>
            </div>
            <div v-if="replyingTo === a.id" class="reply-area">
              <textarea v-model="inlineReplyMessage" placeholder="Your response..." rows="2" class="reply-input"></textarea>
              <div class="reply-btns">
                <button @click="replyingTo = null" class="btn-ghost">Cancel</button>
                <button @click="submitInlineReply(a.id)" :disabled="!inlineReplyMessage.trim()" class="btn-primary-sm">Send</button>
              </div>
            </div>
            <button v-else @click="startInlineReply(a.id)" class="btn-ghost thread-reply-btn">
              {{ a.isOwnAlert ? 'Update' : 'Respond' }}
            </button>
          </div>
        </div>
      </section>
    </div>

    <!-- Privacy Modal -->
    <div v-if="showPrivacySettings" class="overlay" @click.self="showPrivacySettings = false">
      <div class="modal">
        <button @click="showPrivacySettings = false" class="modal-close" aria-label="Close">×</button>
        <PrivacySettings />
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, computed, onBeforeUnmount, nextTick, watch } from 'vue'
import { useRouter } from 'vue-router'
import { auth } from '../firebase'
import { signOut, onAuthStateChanged } from 'firebase/auth'
import {
  startLocationTracking, stopLocationTracking,
  getPrivacySettings, getNearestUsers, getCurrentLocation
} from '../services/locationService'
import {
  sendEmergencyAlert, getNearbyAlerts,
  respondToAlert as respondToAlertService, subscribeToNearbyAlerts
} from '../services/alertService'
import {
  initMap, centerMapOnUserLocation, showNearbyUsers, showAlerts, cleanupMap
} from '../services/mapService'
import { askGeminiStream, getChatHistory, analyzeEmotion } from '../services/geminiService'
import PrivacySettings from '../components/PrivacySettings.vue'

export default {
  name: 'HomePage',
  components: { PrivacySettings },
  setup() {
    const user = ref(null)
    const router = useRouter()
    const mapElement = ref(null)
    const mapAvailable = ref(false)
    const showPrivacySettings = ref(false)
    const chatMessagesContainer = ref(null)
    const alertsSection = ref(null)

    const alertMessage = ref('')
    const emergencyType = ref('general')
    const isLoading = ref(false)
    const alertSent = ref(false)
    const notificationMessage = ref('')

    const geminiQuestion = ref('')
    const geminiResponse = ref('')
    const geminiLoading = ref(false)
    const chatHistory = ref([])

    const locationTracking = ref(false)
    const locationStatus = ref('Location inactive')
    const locationErrorMessage = ref('')

    const nearbyUsers = ref([])
    const nearbyAlerts = ref([])

    const replyingTo = ref(null)
    const inlineReplyMessage = ref('')
    const numberCopied = ref(false)
    const emotionLevel = ref(3)
    const emotionAssessment = ref(null)

    const emergencyTypes = [
      { label: 'General', value: 'general' },
      { label: 'Medical', value: 'medical' },
      { label: 'Safety', value: 'safety' },
      { label: 'Harassment', value: 'harassment' }
    ]
    const quickPrompts = [
      'How to perform CPR?',
      'Someone is having a seizure',
      'I feel unsafe right now',
      'First aid for burns'
    ]

    const isListening = ref(false)
    const isSpeaking = ref(false)
    const speechRecognition = ref(null)
    const speechSynthesis = ref(window.speechSynthesis || null)
    const isSpeechRecognitionAvailable = ref(false)

    const canSendAlert = computed(() => alertMessage.value.trim().length > 0 && locationTracking.value)

    const emotionLabel = computed(() => {
      if (emotionAssessment.value?.emotionLabel) {
        return String(emotionAssessment.value.emotionLabel)
          .split(/[\s/_-]+/)
          .filter(Boolean)
          .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
          .join(' ')
      }
      const labels = ['Critical', 'Severe', 'Moderate', 'Stable', 'Good', 'Safe']
      return labels[Math.round(emotionLevel.value)] || 'Assessing'
    })

    const barGradient = computed(() => {
      const level = emotionLevel.value / 5
      if (level < 0.5) {
        return `linear-gradient(90deg, #ef4444 0%, #f87171 100%)`
      } else {
        return `linear-gradient(90deg, #22c55e 0%, #4ade80 100%)`
      }
    })

    const glowColor = computed(() => {
      return emotionLevel.value < 2.5 ? '#ef4444' : '#22c55e'
    })

    const scrollToBottom = () => {
      nextTick(() => {
        if (chatMessagesContainer.value) {
          chatMessagesContainer.value.scrollTop = chatMessagesContainer.value.scrollHeight
        }
      })
    }
    watch(chatHistory, scrollToBottom, { deep: true })

    const applyEmotionAssessment = (analysis) => {
      if (!analysis) return

      const nextLevel = Number(analysis.emotionScale)
      if (Number.isFinite(nextLevel)) {
        emotionLevel.value = Math.max(0, Math.min(5, nextLevel))
      }

      emotionAssessment.value = analysis
    }

    const copyEmergencyNumber = () => {
      navigator.clipboard.writeText('911').then(() => {
        numberCopied.value = true
        setTimeout(() => { numberCopied.value = false }, 2000)
      }).catch(() => {})
    }

    const shareLocation = async () => {
      try {
        const position = await getCurrentLocation()
        const { latitude, longitude } = position.coords
        const url = `https://maps.google.com/?q=${latitude},${longitude}`
        if (navigator.share) await navigator.share({ title: 'My Location — Gemini Alert', text: 'I need help at this location', url })
        else { await navigator.clipboard.writeText(url); alert('Location link copied') }
      } catch (e) { alert('Could not get location.') }
    }

    const scrollToAlerts = () => { if (alertsSection.value) alertsSection.value.scrollIntoView({ behavior: 'smooth' }) }
    const useQuickPrompt = (p) => { geminiQuestion.value = p; askGeminiAI() }
    const startInlineReply = (id) => { replyingTo.value = id; inlineReplyMessage.value = '' }
    const submitInlineReply = async (id) => {
      if (!inlineReplyMessage.value.trim()) return
      try { await respondToAlertService(id, inlineReplyMessage.value); await refreshNearbyAlerts(); replyingTo.value = null; inlineReplyMessage.value = '' } catch (e) { /* silent */ }
    }

    const initializeMap = async () => {
      try {
        await initMap('map'); mapAvailable.value = true
        try { await centerMapOnUserLocation(5); await refreshNearbyUsers(); await refreshNearbyAlerts() }
        catch (geoError) {
          if (geoError.code === 1) locationErrorMessage.value = 'Location permission denied.'
          else if (geoError.code === 2) locationErrorMessage.value = 'Unable to determine your location.'
          else if (geoError.code === 3) locationErrorMessage.value = 'Location request timed out.'
          else locationErrorMessage.value = 'Error getting location: ' + geoError.message
          locationStatus.value = 'Demo location'
        }
      } catch (mapError) {
        mapAvailable.value = false; locationStatus.value = 'Map unavailable'
        locationErrorMessage.value = `Maps could not load: ${mapError.message || 'Unknown error'}.`
        console.error('Map init failed:', mapError)
      }
    }

    const startTracking = async () => {
      try {
        const started = await startLocationTracking()
        locationTracking.value = started
        locationStatus.value = started ? 'Location active' : 'Location error'
        if (!started) { locationTracking.value = true; locationStatus.value = 'Demo location' }
        return locationTracking.value
      } catch (error) { locationTracking.value = true; locationStatus.value = 'Demo location'; return true }
    }

    const refreshNearbyUsers = async () => {
      try {
        const ps = getPrivacySettings(); if (!ps.shareWithNearbyUsers) { nearbyUsers.value = []; return }
        const position = await getCurrentLocation(); const { latitude, longitude } = position.coords
        const users = await getNearestUsers(latitude, longitude)
        nearbyUsers.value = users.map(u => ({ uid: u.userId, displayName: u.displayName, distance: u.distance_km, latitude: u.latitude, longitude: u.longitude }))
        if (mapAvailable.value) await showNearbyUsers(5)
      } catch (error) { nearbyUsers.value = [] }
    }

    const refreshNearbyAlerts = async () => {
      try { const alerts = await getNearbyAlerts(10); nearbyAlerts.value = alerts; if (mapAvailable.value) await showAlerts(alerts) }
      catch (error) { nearbyAlerts.value = [] }
    }

    const sendAlert = async () => {
      if (!canSendAlert.value) return; isLoading.value = true; alertSent.value = false
      try { await sendEmergencyAlert(alertMessage.value, emergencyType.value); alertSent.value = true; notificationMessage.value = 'Alert sent to nearby users.'; await refreshNearbyAlerts() }
      catch (error) { alertSent.value = true; notificationMessage.value = 'Error sending alert. Try again.' }
      finally { isLoading.value = false }
    }

    const askGeminiAI = async () => {
      if (!geminiQuestion.value.trim()) return
      const question = geminiQuestion.value
      const recentContext = chatHistory.value.slice(-4).map((message) => ({
        senderName: message.sender === 'user' ? 'User' : 'Dr Gemini',
        text: message.text
      }))

      chatHistory.value.push({ sender: 'user', text: question, timestamp: new Date() })
      geminiQuestion.value = ''; geminiLoading.value = true; geminiResponse.value = ''
      try {
        const analysis = await analyzeEmotion(question, {
          priorScale: emotionAssessment.value?.emotionScale ?? emotionLevel.value,
          contextMessages: recentContext
        })
        applyEmotionAssessment(analysis)

        let fullResponse = ''
        const handleChunk = (chunk) => {
          fullResponse += chunk; geminiResponse.value = fullResponse
          if (chatHistory.value.length > 0 && chatHistory.value[chatHistory.value.length - 1].sender === 'ai') chatHistory.value[chatHistory.value.length - 1].text = fullResponse
          else chatHistory.value.push({ sender: 'ai', text: fullResponse, timestamp: new Date() })
        }
        await askGeminiStream(question, handleChunk)
      } catch (error) {
        const errorMessage = 'Sorry, there was an error. Please try again.'
        geminiResponse.value = errorMessage
        chatHistory.value.push({ sender: 'ai', text: errorMessage, timestamp: new Date(), isError: true })
      } finally { geminiLoading.value = false }
    }

    const logout = async () => { try { stopLocationTracking(); cleanupMap(); await signOut(auth); router.push('/login') } catch (e) { /* silent */ } }

    const formatDistance = (d) => { if (typeof d !== 'number') return '...'; return d < 1 ? `${Math.round(d * 1000)}m` : `${d.toFixed(1)}km` }
    const formatTime = (dt) => new Date(dt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    const getRemainingTime = (createdAt) => {
      const remaining = 3 * 60 * 60 * 1000 - (Date.now() - (createdAt instanceof Date ? createdAt.getTime() : createdAt))
      if (remaining <= 0) return 'Expired'
      const h = Math.floor(remaining / 3600000); const m = Math.floor((remaining % 3600000) / 60000)
      return h > 0 ? `${h}h ${m}m` : `${m}m`
    }

    const formatMessageText = (text) => {
      if (!text) return ''
      let f = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      f = f.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      f = f.replace(/\*(.+?)\*/g, '<em>$1</em>')
      f = f.replace(/\n/g, '<br>')
      return f
    }

    const handleEnterKey = (e) => { if (!e.shiftKey && geminiQuestion.value.trim()) askGeminiAI() }
    const toggleVoiceInput = () => { if (!speechRecognition.value) return; if (isListening.value) speechRecognition.value.stop(); else { try { speechRecognition.value.start() } catch (e) { /* */ } } }
    const speakMessage = (text) => {
      if (!speechSynthesis.value) return
      if (isSpeaking.value) { speechSynthesis.value.cancel(); isSpeaking.value = false; return }
      const u = new SpeechSynthesisUtterance(text.replace(/<[^>]*>/g, '')); u.lang = 'en-US'
      u.onstart = () => { isSpeaking.value = true }; u.onend = () => { isSpeaking.value = false }; u.onerror = () => { isSpeaking.value = false }
      speechSynthesis.value.speak(u)
    }
    const copyMessage = (text) => { navigator.clipboard.writeText(text.replace(/<[^>]*>/g, '')).catch(() => {}) }

    const initSpeechRecognition = () => {
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition
      if (!SR) { isSpeechRecognitionAvailable.value = false; return }
      isSpeechRecognitionAvailable.value = true
      try {
        speechRecognition.value = new SR(); speechRecognition.value.continuous = false; speechRecognition.value.interimResults = true; speechRecognition.value.lang = 'en-US'
        speechRecognition.value.onstart = () => { isListening.value = true }; speechRecognition.value.onend = () => { isListening.value = false }
        speechRecognition.value.onresult = (e) => { geminiQuestion.value = e.results[0][0].transcript }; speechRecognition.value.onerror = () => { isListening.value = false }
      } catch (e) { isSpeechRecognitionAvailable.value = false }
    }

    let userInterval = null, privacyUpdateListener = null, authUnsubscribe = null, alertsUnsubscribe = null
    const clearScheduledUpdates = () => { if (userInterval) { clearInterval(userInterval); userInterval = null } }
    const detachPrivacyListener = () => { if (privacyUpdateListener) { window.removeEventListener('privacy-settings-updated', privacyUpdateListener); privacyUpdateListener = null } }

    onMounted(async () => {
      initSpeechRecognition()
      try { chatHistory.value = await getChatHistory() } catch (e) { console.error("Failed to load chat history:", e) }
      authUnsubscribe = onAuthStateChanged(auth, async (cu) => {
        clearScheduledUpdates(); detachPrivacyListener()
        if (alertsUnsubscribe) { alertsUnsubscribe(); alertsUnsubscribe = null }
        user.value = cu
        if (!cu) { stopLocationTracking(); cleanupMap(); router.push('/login'); return }
        await new Promise(r => setTimeout(r, 100)); startTracking()
        if (mapElement.value || document.getElementById('map')) initializeMap()
        else setTimeout(() => { if (document.getElementById('map')) initializeMap() }, 500)
        userInterval = setInterval(refreshNearbyUsers, 30000)
        alertsUnsubscribe = subscribeToNearbyAlerts(10, async (alerts) => {
          nearbyAlerts.value = alerts
          if (mapAvailable.value) { try { await showAlerts(alerts) } catch (e) { /* */ } }
        })
        const hpu = (event) => {
          const { detail } = event
          if (detail.locationSharing !== undefined) { if (detail.locationSharing) startTracking(); else { locationTracking.value = false; locationStatus.value = 'Location off' } }
        }
        window.addEventListener('privacy-settings-updated', hpu); privacyUpdateListener = hpu
      })
    })

    onBeforeUnmount(() => {
      clearScheduledUpdates(); detachPrivacyListener()
      if (alertsUnsubscribe) { alertsUnsubscribe(); alertsUnsubscribe = null }
      if (authUnsubscribe) { authUnsubscribe(); authUnsubscribe = null }
    })

    return {
      user, mapElement, chatMessagesContainer, alertsSection,
      alertMessage, emergencyType, emergencyTypes, isLoading, alertSent, notificationMessage,
      geminiQuestion, geminiResponse, geminiLoading, chatHistory, quickPrompts,
      locationTracking, locationStatus, locationErrorMessage,
      nearbyUsers, nearbyAlerts,
      replyingTo, inlineReplyMessage, numberCopied,
      emotionLevel, emotionLabel, barGradient, glowColor,
      canSendAlert, sendAlert, askGeminiAI, logout,
      formatDistance, formatTime, getRemainingTime, formatMessageText, handleEnterKey,
      isListening, isSpeaking, isSpeechRecognitionAvailable,
      toggleVoiceInput, speakMessage, copyMessage,
      showPrivacySettings,
      copyEmergencyNumber, shareLocation, scrollToAlerts,
      useQuickPrompt, startInlineReply, submitInlineReply
    }
  }
}
</script>

<style scoped>
/* ===== PAGE ===== */
.page { max-width: 640px; margin: 0 auto; padding: 0 var(--sp-md) var(--sp-xl); }

/* ===== HEADER ===== */
.hdr { display: flex; justify-content: space-between; align-items: center; padding: var(--sp-lg) 0; border-bottom: 1px solid var(--c-border); margin-bottom: var(--sp-md); }
.brand { font-size: var(--fs-lg); font-weight: 800; letter-spacing: -0.03em; }
.hdr-right { display: flex; align-items: center; gap: var(--sp-sm); }
.user-name { font-size: var(--fs-sm); color: var(--c-text-soft); }

/* ===== BUTTONS ===== */
.btn-ghost { background: transparent; border: 1px solid var(--c-border); color: var(--c-text-soft); padding: 0.35rem 0.85rem; border-radius: var(--radius-pill); font-size: var(--fs-sm); font-weight: 600; transition: border-color 0.15s, color 0.15s; }
.btn-ghost:hover { border-color: var(--c-text); color: var(--c-text); }
.btn-out:hover { border-color: var(--c-bad); color: var(--c-bad); }
.btn-danger { background: var(--c-bad); color: white; border: none; padding: 0.5rem 1.25rem; border-radius: var(--radius-pill); font-size: var(--fs-sm); font-weight: 700; transition: opacity 0.15s; }
.btn-danger:hover:not(:disabled) { opacity: 0.85; }
.btn-danger:disabled { opacity: 0.35; cursor: not-allowed; }
.btn-primary-sm { background: var(--c-text); color: var(--c-bg); border: none; padding: 0.35rem 0.85rem; border-radius: var(--radius-pill); font-size: var(--fs-sm); font-weight: 600; }
.btn-primary-sm:disabled { opacity: 0.35; cursor: not-allowed; }

/* ===== LIQUID EMOTION BAR ===== */
.emotion-bar-wrap { margin-bottom: var(--sp-lg); }
.emotion-bar-track { 
  position: relative; 
  height: 28px; 
  background: var(--c-surface); 
  border-radius: var(--radius-pill); 
  overflow: hidden;
  border: 1px solid var(--c-border);
}
.emotion-bar-fill { 
  height: 100%; 
  border-radius: var(--radius-pill); 
  position: relative; 
  transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1), background 0.6s ease;
  overflow: hidden;
}
.liquid-blobs {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: space-around;
}
.blob {
  width: 20px;
  height: 20px;
  background: rgba(255, 255, 255, 0.35);
  border-radius: 50%;
  animation: blob-float 2.5s ease-in-out infinite;
  filter: blur(2px);
}
.blob:nth-child(1) { animation-delay: 0s; width: 18px; height: 18px; }
.blob:nth-child(2) { animation-delay: 0.5s; width: 14px; height: 14px; }
.blob:nth-child(3) { animation-delay: 1s; width: 22px; height: 22px; }
@keyframes blob-float {
  0%, 100% { transform: translateY(0) scale(1); opacity: 0.6; }
  50% { transform: translateY(-4px) scale(1.15); opacity: 0.9; }
}
.emotion-bar-glow {
  position: absolute;
  inset: 0;
  border-radius: var(--radius-pill);
  filter: blur(12px);
  transition: background 0.6s ease, opacity 0.6s ease;
  pointer-events: none;
}
.emotion-meta { display: flex; justify-content: space-between; margin-top: var(--sp-xs); padding: 0 var(--sp-xs); }
.emotion-label { font-size: var(--fs-sm); font-weight: 700; color: var(--c-text); }
.emotion-level { font-size: var(--fs-sm); color: var(--c-text-soft); }

/* ===== ACTIONS ===== */
.actions { display: flex; gap: var(--sp-sm); overflow-x: auto; padding-bottom: var(--sp-xs); margin-bottom: var(--sp-md); }
.action-btn { padding: 0.45rem 0.9rem; border-radius: var(--radius-pill); border: 1px solid var(--c-border); background: var(--c-bg); color: var(--c-text); font-size: var(--fs-sm); font-weight: 600; white-space: nowrap; text-decoration: none; transition: border-color 0.15s; cursor: pointer; display: flex; align-items: center; gap: var(--sp-xs); }
.action-btn:hover { border-color: var(--c-text); }
.action-critical { border-color: var(--c-bad); color: var(--c-bad); }
.action-critical:hover { background: var(--c-bad); color: white; }
.badge { background: var(--c-text); color: var(--c-bg); font-size: var(--fs-xs); padding: 0.1rem 0.4rem; border-radius: var(--radius-pill); font-weight: 700; }

/* ===== DR GEMINI AVATAR ===== */
.dr-avatar { 
  width: 40px; 
  height: 40px; 
  border-radius: 50%; 
  background: var(--c-text); 
  color: var(--c-bg); 
  display: flex; 
  align-items: center; 
  justify-content: center; 
  font-size: var(--fs-sm); 
  font-weight: 800; 
  flex-shrink: 0;
}
.dr-avatar-lg { width: 64px; height: 64px; font-size: var(--fs-lg); margin-bottom: var(--sp-md); }

/* ===== CHAT ===== */
.chat { background: var(--c-surface); border-radius: var(--radius-round); display: flex; flex-direction: column; height: 520px; margin-bottom: var(--sp-md); overflow: hidden; }
@media (min-width: 640px) { .chat { height: 620px; } }
.chat-head { display: flex; align-items: center; gap: var(--sp-sm); padding: var(--sp-md); border-bottom: 1px solid var(--c-border); }
.chat-info { flex: 1; }
.chat-title { font-size: var(--fs-md); font-weight: 800; margin: 0; }
.chat-sub { font-size: var(--fs-xs); color: var(--c-text-soft); margin: 0; }
.loc-indicator { display: flex; align-items: center; gap: 0.3rem; font-size: var(--fs-xs); color: var(--c-text-soft); }
.loc-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--c-border); flex-shrink: 0; }
.loc-dot.active { background: var(--c-good); }

.chat-body { flex: 1; overflow: hidden; display: flex; flex-direction: column; }
.chat-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; padding: var(--sp-xl); text-align: center; }
.empty-title { font-size: var(--fs-md); font-weight: 700; margin: 0 0 var(--sp-xs); }
.empty-sub { font-size: var(--fs-sm); color: var(--c-text-soft); margin: 0 0 var(--sp-lg); max-width: 300px; }
.prompts { display: flex; flex-wrap: wrap; gap: var(--sp-sm); justify-content: center; }
.prompt-btn { padding: 0.4rem 0.75rem; border: 1px solid var(--c-border); border-radius: var(--radius-pill); background: var(--c-bg); color: var(--c-text-soft); font-size: var(--fs-sm); cursor: pointer; transition: border-color 0.15s, color 0.15s; }
.prompt-btn:hover { border-color: var(--c-text); color: var(--c-text); }

.msgs { flex: 1; overflow-y: auto; padding: var(--sp-md); display: flex; flex-direction: column; gap: var(--sp-sm); }
.msgs::-webkit-scrollbar { width: 0; }
.msg { display: flex; align-items: flex-end; gap: var(--sp-sm); animation: fadeUp 0.2s ease-out; }
@keyframes fadeUp { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
.msg-user { flex-direction: row-reverse; }

.msg-avatar { width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 700; flex-shrink: 0; }
.msg-avatar-user { background: var(--c-text); color: var(--c-bg); }
.msg-avatar-ai { background: var(--c-surface); border: 1px solid var(--c-border); color: var(--c-text); }

.msg-bubble { padding: 0.65rem 1rem; border-radius: 20px; max-width: 82%; word-break: break-word; }
.msg-user .msg-bubble { background: var(--c-text); color: var(--c-bg); border-bottom-right-radius: 6px; }
.msg-ai .msg-bubble { background: var(--c-bg); border: 1px solid var(--c-border); border-bottom-left-radius: 6px; }

.msg-text { font-size: var(--fs-base); line-height: 1.55; }
.msg-text strong { font-weight: 700; display: block; margin: 0.5rem 0 0.2rem; }
.msg-text strong:first-child { margin-top: 0; }
.msg-text em { font-style: italic; }
.msg-tools { display: flex; gap: var(--sp-xs); margin-top: var(--sp-xs); justify-content: flex-end; }
.tool-btn { background: none; border: none; cursor: pointer; font-size: var(--fs-sm); opacity: 0.4; padding: 0.15rem; border-radius: 50%; transition: opacity 0.15s; }
.tool-btn:hover { opacity: 1; }

.typing { display: flex; gap: 0.3rem; padding: 0.6rem 0.85rem; max-width: 60px; }
.dot { width: 7px; height: 7px; border-radius: 50%; background: var(--c-text-soft); animation: pulse 1.4s infinite ease-in-out both; }
.dot:nth-child(1) { animation-delay: -0.32s; }
.dot:nth-child(2) { animation-delay: -0.16s; }
@keyframes pulse { 0%, 80%, 100% { transform: scale(0.5); opacity: 0.3; } 40% { transform: scale(1); opacity: 1; } }

.chat-foot { display: flex; gap: var(--sp-sm); padding: var(--sp-sm) var(--sp-md); align-items: center; border-top: 1px solid var(--c-border); }
.chat-input { flex: 1; background: var(--c-bg); border: 1px solid var(--c-border); border-radius: var(--radius-pill); padding: 0.6rem 1rem; font-size: var(--fs-base); color: var(--c-text); resize: none; outline: none; min-height: 42px; max-height: 100px; transition: border-color 0.15s; }
.chat-input:focus { border-color: var(--c-text); }
.chat-input::placeholder { color: var(--c-text-soft); }

.circle-btn { width: 42px; height: 42px; border-radius: 50%; border: 1px solid var(--c-border); background: var(--c-bg); color: var(--c-text); display: flex; align-items: center; justify-content: center; font-size: 1.1rem; flex-shrink: 0; transition: all 0.15s; }
.circle-btn:hover:not(:disabled) { border-color: var(--c-text); }
.circle-btn:disabled { opacity: 0.3; cursor: not-allowed; }
.circle-btn.active { background: var(--c-text); color: var(--c-bg); border-color: var(--c-text); }
.circle-btn-send { background: var(--c-text); color: var(--c-bg); border-color: var(--c-text); font-weight: 800; font-size: 1.2rem; }
.circle-btn-send:hover:not(:disabled) { opacity: 0.8; }

/* ===== COMPOSE ===== */
.compose { background: var(--c-surface); border-radius: var(--radius-round); padding: var(--sp-lg); margin-bottom: var(--sp-md); }
.compose h3 { font-size: var(--fs-md); margin-bottom: var(--sp-sm); }
.type-row { display: flex; flex-wrap: wrap; gap: var(--sp-sm); margin-bottom: var(--sp-sm); }
.type-btn { padding: 0.35rem 0.75rem; border-radius: var(--radius-pill); border: 1px solid var(--c-border); background: transparent; color: var(--c-text-soft); font-size: var(--fs-sm); font-weight: 600; transition: all 0.15s; }
.type-btn:hover { border-color: var(--c-text); color: var(--c-text); }
.type-btn.active { background: var(--c-text); color: var(--c-bg); border-color: var(--c-text); }
.compose-input { width: 100%; background: var(--c-bg); border: 1px solid var(--c-border); border-radius: 20px; padding: 0.65rem 1rem; font-size: var(--fs-base); color: var(--c-text); resize: none; outline: none; margin-bottom: var(--sp-sm); transition: border-color 0.15s; }
.compose-input:focus { border-color: var(--c-text); }
.compose-input::placeholder { color: var(--c-text-soft); }
.compose-foot { display: flex; justify-content: space-between; align-items: center; }
.compose-loc { display: flex; align-items: center; gap: 0.35rem; font-size: var(--fs-sm); color: var(--c-text-soft); }
.err-msg { font-size: var(--fs-sm); color: var(--c-bad); padding: var(--sp-sm) var(--sp-md); border-radius: var(--radius-pill); margin-top: var(--sp-sm); border: 1px solid var(--c-bad); }
.ok-msg { font-size: var(--fs-sm); color: var(--c-good); padding: var(--sp-sm) var(--sp-md); border-radius: var(--radius-pill); margin-top: var(--sp-sm); border: 1px solid var(--c-good); }

/* ===== SECONDARY ===== */
.secondary { display: grid; grid-template-columns: 1fr 1fr; gap: var(--sp-md); }
@media (max-width: 640px) { .secondary { grid-template-columns: 1fr; } }
.card { background: var(--c-surface); border-radius: var(--radius-round); padding: var(--sp-md); }
.sec-title { font-size: var(--fs-sm); font-weight: 600; color: var(--c-text-soft); margin-bottom: var(--sp-sm); display: flex; align-items: center; gap: var(--sp-sm); }
.map-wrap { border-radius: 20px; overflow: hidden; }
#map { height: 240px; width: 100%; }
@media (max-width: 640px) { #map { height: 200px; } }

/* ===== THREADS ===== */
.empty-threads { text-align: center; padding: var(--sp-lg); color: var(--c-text-soft); font-size: var(--fs-sm); }
.thread-list { display: flex; flex-direction: column; gap: var(--sp-sm); max-height: 380px; overflow-y: auto; }
.thread { background: var(--c-bg); border-radius: 20px; padding: var(--sp-md); border: 1px solid var(--c-border); }
.thread-own { border-left: 3px solid var(--c-text); }
.thread-top { display: flex; justify-content: space-between; margin-bottom: var(--sp-xs); }
.thread-type { font-size: var(--fs-xs); font-weight: 700; color: var(--c-bad); text-transform: capitalize; }
.thread-dist { font-size: var(--fs-xs); color: var(--c-text-soft); }
.thread-body { font-size: var(--fs-sm); margin: var(--sp-xs) 0; line-height: 1.5; }
.thread-meta { display: flex; justify-content: space-between; font-size: var(--fs-xs); color: var(--c-text-soft); margin-bottom: var(--sp-sm); }
.thread-resps { padding-top: var(--sp-sm); border-top: 1px solid var(--c-border); }
.thread-resp { font-size: var(--fs-sm); color: var(--c-text-soft); margin-bottom: var(--sp-xs); padding-left: var(--sp-sm); border-left: 2px solid var(--c-text); }
.resp-time { font-size: var(--fs-xs); color: var(--c-text-soft); margin-left: var(--sp-xs); }
.reply-area { margin-top: var(--sp-sm); }
.reply-input { width: 100%; background: var(--c-surface); border: 1px solid var(--c-border); border-radius: 16px; padding: var(--sp-sm); color: var(--c-text); font-size: var(--fs-sm); resize: none; outline: none; margin-bottom: var(--sp-xs); }
.reply-input:focus { border-color: var(--c-text); }
.reply-input::placeholder { color: var(--c-text-soft); }
.reply-btns { display: flex; gap: var(--sp-sm); justify-content: flex-end; }
.thread-reply-btn { width: 100%; margin-top: var(--sp-xs); }

/* ===== MODAL ===== */
.overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4); display: flex; justify-content: center; align-items: center; z-index: 100; }
@media (prefers-color-scheme: dark) { .overlay { background: rgba(0,0,0,0.7); } }
.modal { background: var(--c-bg); border-radius: var(--radius-round); padding: var(--sp-lg); width: 90%; max-width: 440px; max-height: 90vh; overflow-y: auto; position: relative; }
.modal-close { position: absolute; top: var(--sp-md); right: var(--sp-md); width: 36px; height: 36px; border-radius: 50%; border: 1px solid var(--c-border); background: var(--c-surface); color: var(--c-text-soft); display: flex; align-items: center; justify-content: center; font-size: 1.25rem; cursor: pointer; }
.modal-close:hover { border-color: var(--c-bad); color: var(--c-bad); }
</style>
