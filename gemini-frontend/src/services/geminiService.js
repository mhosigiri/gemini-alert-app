import { auth } from '../firebase'

// Base URL for API requests - use environment variable or fallback to localhost
const API_BASE_URL = process.env.VUE_APP_API_BASE_URL || 'http://localhost:5001'

// Fallback response when the backend is unavailable
const FALLBACK_RESPONSE = `
I'm sorry, but I can't access the Gemini AI service right now. Here are some general emergency guidelines:

1. For immediate life-threatening emergencies, call 911 (or your local emergency number)
2. Stay calm and assess your situation
3. If you're in physical danger, move to a safe location if possible
4. For medical emergencies, apply basic first aid until help arrives
5. Stay on well-lit, populated pathways when traveling alone
6. Share your location with trusted contacts if you feel unsafe
7. Use emergency services apps that allow quick access to help

[This is a fallback response because the Gemini AI service is currently unavailable]
`;

/**
 * Asks the Gemini AI for help with a question
 * @param {string} question - The user's question for Gemini
 * @returns {Promise<string>} - The response from Gemini
 */
export const askGemini = async (question) => {
  try {
    // Get the current user's auth token
    const token = await auth.currentUser.getIdToken()
    
    // Try to fetch from backend
    try {
      const response = await fetch(`${API_BASE_URL}/ask`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ question }),
        // Add timeout
        signal: AbortSignal.timeout(10000) // 10 second timeout
      })
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to get response from Gemini')
      }
      
      const data = await response.json()
      return data.response
    } catch (fetchError) {
      console.warn('Backend fetch failed, using fallback response:', fetchError)
      return FALLBACK_RESPONSE + `\n\nOriginal question: "${question}"\n\nError: ${fetchError.message}`
    }
  } catch (error) {
    console.error('Error asking Gemini:', error)
    return FALLBACK_RESPONSE
  }
}

/**
 * Asks the Gemini AI with streaming response
 * @param {string} question - The user's question
 * @param {function} onChunkReceived - Callback for each chunk of the response
 * @returns {Promise<void>}
 */
export const askGeminiStream = async (question, onChunkReceived) => {
  try {
    // Get the current user's auth token
    let token
    try {
      token = await auth.currentUser.getIdToken()
    } catch (authError) {
      console.error('Auth error:', authError)
      // Send fallback response in chunks
      simulateFallbackResponse(onChunkReceived, question)
      return
    }
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      const response = await fetch(`${API_BASE_URL}/ask-stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ question }),
        signal: controller.signal
      })
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        // Try to parse error response
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `Failed to get response from Gemini: ${response.status}`)
      }
      
      // Set up reader for streaming
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      
      let streamActive = true
      while (streamActive) {
        const { done, value } = await reader.read()
        if (done) {
          streamActive = false
          break
        }
        
        const text = decoder.decode(value)
        const lines = text.split('\n\n')
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const chunk = line.substring(6)
            onChunkReceived(chunk)
          }
        }
      }
    } catch (fetchError) {
      console.warn('Streaming fetch failed, using fallback:', fetchError)
      simulateFallbackResponse(onChunkReceived, question, fetchError.message)
    }
  } catch (error) {
    console.error('Error streaming from Gemini:', error)
    simulateFallbackResponse(onChunkReceived, question, error.message)
  }
}

/**
 * Simulates a streaming response with fallback content
 * @param {function} onChunkReceived - Callback for each chunk
 * @param {string} question - The original question
 * @param {string} errorMsg - Optional error message
 */
function simulateFallbackResponse(onChunkReceived, question, errorMsg = 'Backend unavailable') {
  const fallbackLines = FALLBACK_RESPONSE.trim().split('\n');
  let currentIndex = 0;
  
  // Send an initial error message
  onChunkReceived(`I'm sorry, but I couldn't connect to the Gemini AI service (${errorMsg}). `);
  
  // Use a timer to simulate streaming the fallback response
  const interval = setInterval(() => {
    if (currentIndex < fallbackLines.length) {
      const line = fallbackLines[currentIndex].trim();
      if (line) {
        onChunkReceived(line + ' ');
      }
      currentIndex++;
    } else {
      clearInterval(interval);
      // Add the question as context at the end
      onChunkReceived(`\n\nOriginal question: "${question}"`);
    }
  }, 150); // Send a new chunk every 150ms
}