import api from '../utils/api';
import { auth } from '../firebase';
// The Gemini API is accessed through the backend, no API key needed here
// Pre-defined conversation context matching the Python implementation
const CONVERSATION_CONTEXT = [
  {
    role: "user",
    parts: [{ text: "User sends a message indicating they are in distress or facing a potentially escalated situation. Gemini reads and analyzes the message, assessing keywords and tone for urgency, emotional state, and risk of escalation. Based on the analysis, Gemini identifies potential de-escalation strategies and, if needed, sends notifications to trusted or nearby users in the application to provide support or alert authorities." }]
  },
  {
    role: "model",
    parts: [{ text: "Here's a breakdown of the thinking process behind crafting the response about Gemini's potential role in de-escalation:\n\n1.  **Deconstruct the User Request:**\n    *   **Core Scenario:** User sends a distress message within an application.\n    *   **Gemini's Role:**\n        *   Read and analyze the message.\n        *   Assess keywords, tone for urgency, emotion, risk.\n        *   Identify potential de-escalation strategies.\n        *   (If needed) Send notifications to trusted contacts/nearby users/authorities.\n    *   **Goal:** Provide support, alert others, potentially de-escalate the situation.\n\n2.  **Identify Key Concepts & Challenges:**\n    *   **Natural Language Processing (NLP):** This is fundamental for reading, analyzing, and understanding the user's message (keywords, tone, sentiment, intent).\n    *   **Risk Assessment:** How does Gemini determine the *level* of distress, urgency, and risk? This is complex and requires sophisticated modeling. False positives (overreacting) and false negatives (underreacting) are serious concerns.\n    *   **De-escalation Strategies:** This requires a nuanced understanding of psychology, crisis intervention, and communication techniques. Gemini needs to generate helpful, empathetic, and safe responses.\n    *   **Notification System:** Who are \"trusted contacts\" or \"nearby users\"? How are they selected? What information is shared? Privacy is paramount.\n    *   **Authority Alerting:** When should authorities be contacted? What information is shared? This has serious ethical and legal implications.\n\n3.  **Brainstorm Gemini's Capabilities:**\n    *   **Analysis:**  NLP for sentiment, emotion, keyword extraction, intent classification.\n    *   **Context Understanding:**  Consider conversation history, user profile (if available), time of day, location (if shared).\n    *   **Response Generation:** Generate empathetic, supportive, and de-escalating messages.\n    *   **Resource Provision:** Suggest hotlines, mental health resources, or local support services.\n    *   **Notification Triggers:** Define thresholds for different levels of intervention.\n\n4.  **Consider Limitations & Ethical Concerns:**\n    *   **Accuracy:** Gemini is not a human therapist or crisis counselor. Its assessments can be wrong.\n    *   **Privacy:** Sharing user messages with others requires explicit consent and careful handling of sensitive data.\n    *   **Bias:** The model's training data might contain biases that could lead to unfair or discriminatory outcomes.\n    *   **Legal Liability:** Incorrect assessments or inappropriate notifications could have legal ramifications.\n    *   **Over-reliance:** Users might become overly dependent on the system instead of seeking professional help.\n\n5.  **Structure the Response:**\n    *   **Start with a clear affirmation of Gemini's potential role.**\n    *   **Detail the capabilities Gemini can offer.**\n    *   **Emphasize the importance of ethical considerations and limitations.**\n    *   **Suggest a phased approach or pilot program.**\n    *   **Conclude with a responsible and forward-looking statement.**\n\n6.  **Refine and Polish:**\n    *   Ensure the language is clear, empathetic, and avoids jargon.\n    *   Balance optimism about the technology with realistic expectations.\n    *   Highlight the need for human oversight and collaboration with mental health professionals.\n\nBy following this thought process, the response aims to be comprehensive, responsible, and helpful in outlining how Gemini could potentially contribute to de-escalation efforts while acknowledging the significant challenges and ethical considerations involved." }]
  }
];
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
    onChunkReceived(`Sorry, there was an error connecting to the Gemini API. Please try again later.`);
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