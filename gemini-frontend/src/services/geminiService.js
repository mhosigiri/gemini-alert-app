import { auth } from '../firebase'

// Base URL for API requests - always use the environment variable or fallback to localhost
const API_BASE_URL = process.env.VUE_APP_API_BASE_URL || 'http://localhost:5001';

/**
 * Asks the Gemini AI for help with a question
 * @param {string} question - The user's question for Gemini
 * @returns {Promise<string>} - The response from Gemini
 */
export const askGemini = async (question) => {
  try {
    // Get the current user's auth token
    const token = await auth.currentUser.getIdToken()
    
    // Log the API URL we're using
    console.log(`Making API request to: ${API_BASE_URL}/ask`);
    
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
      console.warn(`API response not OK: ${response.status}`);
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || `Failed to get response from Gemini API: ${response.status}`)
    }
    
    const data = await response.json()
    return data.response
  } catch (error) {
    console.error('Error asking Gemini:', error);
    return `Sorry, there was an error connecting to Gemini: ${error.message}. Please try again later.`;
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
      onChunkReceived("Error getting authentication token. Please try again.");
      return
    }
    
    // Log the API URL we're using for streaming
    console.log(`Making streaming API request to: ${API_BASE_URL}/ask-stream`);
    
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
      console.warn(`Streaming API response not OK: ${response.status}`);
      // Try to parse error response
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || `Failed to get streaming response: ${response.status}`)
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
  } catch (error) {
    console.error('Error streaming from Gemini:', error)
    onChunkReceived(`Sorry, there was an error connecting to the Gemini API: ${error.message}. Please try again later.`);
  }
}