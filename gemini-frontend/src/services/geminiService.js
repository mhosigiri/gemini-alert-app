import { auth } from '../firebase'

// Base URL for API requests
const API_BASE_URL = 'http://localhost:5001'

/**
 * Asks the Gemini AI for help with a question
 * @param {string} question - The user's question for Gemini
 * @returns {Promise<string>} - The response from Gemini
 */
export const askGemini = async (question) => {
  try {
    // Get the current user's auth token
    const token = await auth.currentUser.getIdToken()
    
    const response = await fetch(`${API_BASE_URL}/ask`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ question })
    })
    
    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || 'Failed to get response from Gemini')
    }
    
    const data = await response.json()
    return data.response
  } catch (error) {
    console.error('Error asking Gemini:', error)
    throw error
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
    const token = await auth.currentUser.getIdToken()
    
    const response = await fetch(`${API_BASE_URL}/ask-stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ question })
    })
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || 'Failed to get response from Gemini')
    }
    
    // Set up event source for streaming
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
  } catch (error) {
    console.error('Error streaming from Gemini:', error)
    throw error
  }
} 