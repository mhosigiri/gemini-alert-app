import { auth } from '../firebase';

const API_BASE_URL = process.env.VUE_APP_API_BASE_URL || 'http://localhost:5001';
const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash';
const SECURE_API_KEY = 'AIzaSyD9t-pWBqbZoFBoGvROkD1YS5dxYBzZE40';

/**
 * Asks the Gemini AI for help with a question
 * @param {string} question - The user's question for Gemini
 * @returns {Promise<string>} - The response from Gemini
 */
export const askGemini = async (question) => {
  try {
    console.log('Making request to Gemini 2.0 Flash API');
    // Make direct request to Gemini API
    const response = await fetch(`${GEMINI_BASE_URL}:generateContent?key=${SECURE_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: question }],
          }
        ],
        generationConfig: {
          temperature: 0.7,
          topK: 20,
          topP: 0.9,
          maxOutputTokens: 800,
        }
      }),
      signal: AbortSignal.timeout(10000) // 10 second timeout
    });

    if (!response.ok) {
      console.error('Gemini API response not OK:', response.status);
      const errorText = await response.text().catch(() => 'Unknown error');
      console.error('Error text:', errorText);
      
      // Try to parse error as JSON
      let errorDetail = 'Unknown error';
      try {
        const errorJson = JSON.parse(errorText);
        errorDetail = errorJson.error?.message || errorJson.error || errorText;
      } catch (e) {
        errorDetail = errorText;
      }
      
      throw new Error(`API Error (${response.status}): ${errorDetail}`);
    }

    const data = await response.json();
    console.log('Gemini API response:', data);
    const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    return responseText || 'No response from Gemini.';
  } catch (error) {
    console.error('Error asking Gemini:', error);
    return `Sorry, there was an error connecting to Gemini. Please try again later.`;
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
    // For now, use the non-streaming API and simulate chunking
    // since direct streaming from browser to Gemini API may have CORS issues
    onChunkReceived("Connecting to Gemini...");
    console.log('Making streaming request to Gemini 2.0 Flash API');
    
    const response = await fetch(`${GEMINI_BASE_URL}:generateContent?key=${SECURE_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: question }],
          }
        ],
        generationConfig: {
          temperature: 0.7,
          topK: 20,
          topP: 0.9,
          maxOutputTokens: 800,
        }
      }),
      signal: AbortSignal.timeout(10000) // 10 second timeout
    });

    if (!response.ok) {
      console.error('Gemini API response not OK:', response.status);
      const errorText = await response.text().catch(() => 'Unknown error');
      console.error('Error text:', errorText);
      
      // Try to parse error as JSON
      let errorDetail = 'Unknown error';
      try {
        const errorJson = JSON.parse(errorText);
        errorDetail = errorJson.error?.message || errorJson.error || errorText;
        console.error('Parsed error:', errorDetail);
      } catch (e) {
        errorDetail = errorText;
        console.error('Failed to parse error:', e);
      }
      
      throw new Error(`API Error (${response.status}): ${errorDetail}`);
    }

    const data = await response.json();
    console.log('Gemini API response:', data);
    const fullText = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response from Gemini.';
    
    // Clear the "Connecting" message
    onChunkReceived(" ");
    
    // Simulate streaming by sending it in chunks
    const words = fullText.split(' ');
    const chunks = [];
    let currentChunk = '';
    
    // Group words into reasonable chunks
    for (const word of words) {
      if (currentChunk.length + word.length > 20) {  // Send ~20 chars at a time
        chunks.push(currentChunk);
        currentChunk = word + ' ';
      } else {
        currentChunk += word + ' ';
      }
    }
    
    if (currentChunk) {
      chunks.push(currentChunk);
    }
    
    // Send chunks with small delays to simulate streaming
    for (const chunk of chunks) {
      onChunkReceived(chunk);
      await new Promise(resolve => setTimeout(resolve, 50)); // 50ms delay between chunks
    }
  } catch (error) {
    console.error('Error streaming from Gemini:', error);
    onChunkReceived(`Sorry, there was an error connecting to the Gemini API. Please try again later.`);
  }
}