import { auth } from '../firebase';

const API_BASE_URL = process.env.VUE_APP_API_BASE_URL || 'http://localhost:5001';
const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro';
const SECURE_API_KEY = 'AIzaSyD9t-pWBqbZoFBoGvROkD1YS5dxYBzZE40';

/**
 * Asks the Gemini AI for help with a question
 * @param {string} question - The user's question for Gemini
 * @returns {Promise<string>} - The response from Gemini
 */
export const askGemini = async (question) => {
  try {
    // Make direct request to Gemini API
    const response = await fetch(`${GEMINI_BASE_URL}:generateContent?key=${SECURE_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: question }],
        }],
      }),
      signal: AbortSignal.timeout(10000) // 10 second timeout
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Gemini API error:', errorData);
      throw new Error(errorData.error || `Failed to get response from Gemini API: ${response.status}`);
    }

    const data = await response.json();
    const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    return responseText || 'No response from Gemini.';
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
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    const response = await fetch(`${GEMINI_BASE_URL}:streamGenerateContent?key=${SECURE_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: question }],
        }],
      }),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Gemini API streaming error:', errorData);
      throw new Error(errorData.error || `Failed to get streaming response from Gemini: ${response.status}`);
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder('utf-8');

    if (!reader) {
      console.error('Could not get reader for streaming response.');
      return;
    }

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      const chunk = decoder.decode(value);
      try {
        // The streaming response is a series of JSON objects
        const jsonChunks = chunk.split('\n').filter(line => line.trim() !== '');
        for (const jsonChunk of jsonChunks) {
          const parsed = JSON.parse(jsonChunk);
          const textChunk = parsed?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (textChunk) {
            onChunkReceived(textChunk);
          }
        }
      } catch (e) {
        console.error('Error parsing streaming chunk:', e, chunk);
      }
    }
  } catch (error) {
    console.error('Error streaming from Gemini:', error);
    onChunkReceived(`Sorry, there was an error connecting to the Gemini API: ${error.message}. Please try again later.`);
  }
}