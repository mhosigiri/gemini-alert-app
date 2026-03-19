import api from '../utils/api';
import { auth } from '../firebase';
// The Gemini API is accessed through the backend, no API key needed here
/**
 * Asks the Gemini AI for help with a question
 * @param {string} question - The user's question for Gemini
 * @returns {Promise<string>} - The response from Gemini
 */
export const askGemini = async (question) => {
  try {
    // Use the backend endpoint directly
    const response = await api.post('/ask', { question });
    
    return response.data.response || 'No response from Gemini.';
  } catch (error) {
    console.error('Gemini API error:', error);
    return `Sorry, there was an error connecting to Dr Gemini. Please try again later.`;
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
    // Get the auth token
    let authToken = '';
    if (api.defaults.headers.Authorization) {
      authToken = api.defaults.headers.Authorization;
    } else if (auth && auth.currentUser) {
      const token = await auth.currentUser.getIdToken();
      authToken = `Bearer ${token}`;
    }

    const response = await fetch(`${api.defaults.baseURL}/ask-stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authToken
      },
      body: JSON.stringify({ question })
    });

    if (!response.ok) {
      throw new Error(`API Error (${response.status})`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { done, value } = await reader.read();
      
      if (done) break;
      
      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data.trim()) {
            onChunkReceived(data);
          }
        }
      }
    }
  } catch (error) {
    console.error('Gemini streaming error:', error);
    onChunkReceived(`Sorry, there was an error connecting to Dr Gemini. Please try again later.`);
  }
}

export const getChatHistory = async () => {
  try {
    const response = await api.get('/chats');
    return response.data.history;
  } catch (error) {
    throw error;
  }
};

export const analyzeEmotion = async (text, options = {}) => {
  const payload = {
    text,
    priorScale: options.priorScale,
    contextMessages: options.contextMessages || []
  };

  try {
    const response = await api.post('/api/emotion/analyze', payload);
    return response.data.analysis || null;
  } catch (error) {
    console.error('Emotion analysis error:', error);
    return null;
  }
};
