<template>
  <div class="home-container">
    <div class="header">
      <h1>Gemini De-escalation Assistant</h1>
      <button @click="logout" class="logout-btn">Logout</button>
    </div>

    <div class="welcome-section" v-if="user">
      <h2>Welcome, {{ user.displayName || 'User' }}!</h2>
      <p>Use this tool to help de-escalate situations through guided assistance.</p>
    </div>

    <div class="de-escalation-container">
      <div class="situation-form">
        <h3>Describe the Situation</h3>
        <div class="form-group">
          <label for="situation">What's happening?</label>
          <textarea 
            id="situation" 
            v-model="situationInput" 
            placeholder="Describe the situation you're facing... (e.g., 'I'm feeling overwhelmed because...')"
            rows="4"
          ></textarea>
        </div>

        <div class="template-buttons">
          <h4>Or use a template:</h4>
          <button @click="useTemplate('anxiety')" class="template-btn">Anxiety</button>
          <button @click="useTemplate('conflict')" class="template-btn">Conflict</button>
          <button @click="useTemplate('anger')" class="template-btn">Anger</button>
          <button @click="useTemplate('panic')" class="template-btn">Panic</button>
        </div>

        <button 
          @click="getDeEscalationGuidance" 
          :disabled="isLoading || !situationInput" 
          class="submit-btn"
        >
          {{ isLoading ? 'Getting guidance...' : 'Get De-escalation Guidance' }}
        </button>
      </div>

      <div class="response-section" v-if="response">
        <h3>De-escalation Guidance</h3>
        <div class="gemini-response" v-html="formattedResponse"></div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { auth } from '../firebase'
import { signOut, onAuthStateChanged } from 'firebase/auth'
import { askGemini } from '../utils/api'

export default {
  name: 'HomePage',
  
  setup() {
    const user = ref(null)
    const situationInput = ref('')
    const response = ref('')
    const isLoading = ref(false)
    const router = useRouter()
    
    // Templates for common situations
    const templates = {
      anxiety: "I'm feeling extremely anxious right now. My heart is racing, I'm having trouble breathing, and I can't stop thinking about everything that could go wrong. I need help calming down.",
      conflict: "I'm in a heated argument with someone I care about. We're both raising our voices and saying things we might regret. I want to de-escalate this situation before it gets worse.",
      anger: "I'm feeling incredibly angry and I'm worried I might lose control. I need strategies to manage this intense emotion right now.",
      panic: "I think I'm having a panic attack. I feel dizzy, my chest hurts, and I'm terrified. I need immediate help to get through this."
    }
    
    const formattedResponse = computed(() => {
      if (!response.value) return ''
      
      // Convert line breaks to <br> tags and make bullet points stand out
      return response.value
        .replace(/\n/g, '<br>')
        .replace(/• (.*?)(?=<br>|$)/g, '<span class="bullet">• $1</span>')
    })
    
    onMounted(() => {
      onAuthStateChanged(auth, (currentUser) => {
        user.value = currentUser
        if (!currentUser) {
          router.push('/login')
        }
      })
    })
    
    const useTemplate = (templateName) => {
      situationInput.value = templates[templateName]
    }
    
    const getDeEscalationGuidance = async () => {
      if (!situationInput.value) return
      
      isLoading.value = true
      response.value = ''
      
      try {
        // Using the authenticated API utility
        const promptText = `I need help de-escalating this situation: "${situationInput.value}". 
                     Please provide clear, step-by-step guidance for calming down and managing this situation.
                     Include specific techniques, deep breathing exercises, and grounding methods that I can use right now.
                     Format your response with bullet points for the most actionable advice. 
                     Be compassionate but direct in your guidance.`
        
        const geminiResponse = await askGemini(promptText)
        response.value = geminiResponse
        
      } catch (err) {
        console.error('Error getting response from Gemini:', err)
        if (err.response && err.response.status === 401) {
          response.value = 'Authentication error. Please log in again.'
          setTimeout(() => {
            logout()
          }, 2000)
        } else {
          response.value = 'Sorry, there was an error getting guidance. Please try again.'
        }
      } finally {
        isLoading.value = false
      }
    }
    
    const logout = async () => {
      try {
        await signOut(auth)
        router.push('/login')
      } catch (err) {
        console.error('Failed to logout:', err)
      }
    }
    
    return {
      user,
      situationInput,
      response,
      isLoading,
      formattedResponse,
      useTemplate,
      getDeEscalationGuidance,
      logout
    }
  }
}
</script>

<style scoped>
.home-container {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30px;
  border-bottom: 1px solid #ddd;
  padding-bottom: 15px;
}

.logout-btn {
  background-color: #f5f5f5;
  color: #333;
}

.welcome-section {
  margin-bottom: 30px;
  text-align: left;
}

.de-escalation-container {
  display: grid;
  grid-template-columns: 1fr;
  gap: 30px;
}

@media (min-width: 768px) {
  .de-escalation-container {
    grid-template-columns: 1fr 1fr;
  }
}

.situation-form, .response-section {
  background: white;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  text-align: left;
}

textarea {
  width: 100%;
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  resize: vertical;
  font-family: inherit;
  font-size: 1rem;
}

.template-buttons {
  margin: 15px 0;
}

h4 {
  margin-bottom: 10px;
  font-size: 1rem;
}

.template-btn {
  background-color: #e0f2f1;
  color: #00796b;
  margin-right: 8px;
  margin-bottom: 8px;
}

.submit-btn {
  background-color: #00796b;
  width: 100%;
  padding: 12px;
  margin-top: 15px;
}

.submit-btn:disabled {
  background-color: #b2dfdb;
  cursor: not-allowed;
}

.gemini-response {
  line-height: 1.6;
  white-space: pre-wrap;
}

.bullet {
  display: block;
  margin: 10px 0;
  padding-left: 10px;
  border-left: 3px solid #4CAF50;
}
</style> 