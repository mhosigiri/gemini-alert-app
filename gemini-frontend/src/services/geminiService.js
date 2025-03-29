import { auth } from '../firebase';

const API_BASE_URL = process.env.VUE_APP_API_BASE_URL || 'http://localhost:5001';
const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash';
const SECURE_API_KEY = 'AIzaSyD9t-pWBqbZoFBoGvROkD1YS5dxYBzZE40';

// Pre-defined conversation context matching the Python implementation
const CONVERSATION_CONTEXT = [
  {
    role: "user",
    parts: [{ text: "User sends a message indicating they are in distress or facing a potentially escalated situation. Gemini reads and analyzes the message, assessing keywords and tone for urgency, emotional state, and risk of escalation. Based on the analysis, Gemini identifies potential de-escalation strategies and, if needed, sends notifications to trusted or nearby users in the application to provide support or alert authorities." }]
  },
  {
    role: "model",
    parts: [{ text: "Here's a breakdown of the thinking process behind crafting the response about Gemini's potential role in de-escalation:\n\n1.  **Deconstruct the User Request:**\n    *   **Core Scenario:** User sends a distress message within an application.\n    *   **Gemini's Role:**\n        *   Read and analyze the message.\n        *   Assess keywords, tone for urgency, emotion, risk.\n        *   Identify potential de-escalation strategies.\n        *   (If needed) Send notifications to trusted contacts/nearby users/authorities.\n    *   **Goal:** Provide support, alert others, potentially de-escalate the situation.\n\n2.  **Identify Key Concepts & Challenges:**\n    *   **Natural Language Processing (NLP):** This is fundamental for reading, analyzing, and understanding the user's message (keywords, tone, sentiment, intent).\n    *   **Risk Assessment:** How does Gemini determine the *level* of distress, urgency, and risk? This is complex and requires sophisticated modeling. False positives (overreacting) and false negatives (underreacting) are serious concerns.\n    *   **De-escalation Strategies:** What *are* appropriate strategies? Can an AI *truly* de-escalate? More likely, it can *suggest* strategies or connect the user to human help. Direct AI intervention in a real-time crisis is risky.\n    *   **Notification System:** How does this work?\n        *   User pre-configuration (trusted contacts).\n        *   Location services (nearby users - privacy implications!).\n        *   Integration with emergency services (authorities - requires specific APIs, legal frameworks, high accuracy).\n    *   **Privacy & Security:** Handling sensitive distress messages, location data, contact lists requires robust privacy measures and user consent.\n    *   **Ethical Considerations:** AI making life-or-death decisions? Bias in risk assessment? Over-reliance on technology? Liability?\n    *   **Technical Feasibility:** While NLP is advanced, accurately gauging human distress and predicting escalation in real-time from text alone is extremely difficult. Context is crucial.\n    *   **User Experience (UX):** How is this feature presented? How does the user configure it? How are notifications handled? Is it intuitive during a crisis?\n\n3.  **Structure the Response:** Start with a clear statement acknowledging the concept and its potential benefits, then break down the components and challenges.\n\n    *   **Acknowledge the Concept:** Start positively. \"This is a compelling concept...\" or \"Designing a system like this...\"\n    *   **Break Down the Process (as described by the user):** Follow the user's flow logically.\n        *   Message Reception & Analysis (NLP, keywords, tone).\n        *   Risk Assessment (Urgency, Emotion, Escalation).\n        *   Strategy Identification (De-escalation - clarify AI's role here).\n        *   Notification/Alerting (Trusted contacts, nearby users, authorities).\n    *   **Elaborate on Each Step (Fleshing out details and challenges):**\n        *   *Analysis:* Mention NLP techniques (sentiment analysis, keyword extraction, intent recognition). Highlight the difficulty of nuance and context.\n        *   *Risk Assessment:* Emphasize complexity, need for training data, potential for errors.\n        *   *De-escalation:* Reframe this. AI is better at *suggesting* or *connecting* than directly de-escalating. Suggest examples like grounding techniques, crisis hotline info, connecting to a human helper.\n        *   *Notifications:* Discuss the different types (trusted contacts, nearby, authorities) and the technical/privacy requirements for each.\n    *   **Introduce Critical Considerations/Challenges:** Group the major hurdles.\n        *   Accuracy & Reliability (False positives/negatives).\n        *   Privacy & Consent (Data handling, location).\n        *   Ethical Concerns (AI decision-making, bias, liability).\n        *   Technical Feasibility (Real-time processing, context).\n        *   User Configuration & Trust (Setup, reliance).\n        *   Integration with Emergency Services (Complexity, legal).\n    *   **Define Gemini's *Current* Capabilities (Important Distinction):** Clarify that *I*, as a general AI model *now*, cannot perform these actions directly within a specific application. Explain my limitations (no access to real-time app data, user contacts, location, or emergency services).\n    *   **Concluding Statement:** Reiterate the potential value but emphasize the significant challenges and the need for careful, ethical development. Frame it as a future possibility requiring significant work.\n\n4.  **Refine Language:**\n    *   Use clear and precise terms (e.g., \"sentiment analysis,\" \"risk assessment model\").\n    *   Acknowledge complexity (\"highly complex,\" \"significant challenges\").\n    *   Be careful with definitive statements about what the AI *would* do; use conditional language (\"could,\" \"might,\" \"potential\").\n    *   Emphasize safety, ethics, and privacy.\n    *   Clearly separate the *concept* from *current capabilities*.\n\n5.  **Self-Correction/Review:**\n    *   Did I address all parts of the user's request? Yes.\n    *   Is the distinction between the *concept* and *current reality* clear? Yes.\n    *   Are the challenges presented realistically? Yes.\n    *   Is the tone balanced – acknowledging potential but also highlighting risks? Yes.\n    *   Could anything be misinterpreted? Perhaps clarify that \"nearby users\" raises significant privacy flags. Ensure the limitations are stark. Added emphasis on AI *suggesting* rather than *performing* de-escalation." }]
  },
  {
    role: "model",
    parts: [{ text: "Okay, let's break down this concept. Designing a system where an AI like Gemini assists in distress situations is a powerful idea, but it involves significant complexity and responsibility. Here's how it could theoretically work, along with the crucial considerations:\n\n**Conceptual Workflow:**\n\n1.  **Message Ingestion:**\n    *   The user sends a message within a specific application (e.g., a dedicated safety app, a messaging platform with this feature enabled).\n    *   The application flags the message for analysis by the integrated AI (Gemini in this concept).\n\n2.  **AI Analysis (Gemini's Role):**\n    *   **Natural Language Processing (NLP):** Gemini processes the text to understand its meaning.\n    *   **Keyword Extraction:** Identifies words and phrases strongly associated with distress, danger, fear, threats, or calls for help (e.g., \"help me,\" \"scared,\" \"trapped,\" \"attacked,\" \"follow,\" \"emergency,\" specific locations, names if relevant context exists).\n    *   **Sentiment & Tone Analysis:** Evaluates the emotional charge of the message. Is it panicked, angry, fearful, resigned? Is the tone escalating or de-escalating compared to previous messages (if available)?\n    *   **Urgency Assessment:** Determines the immediacy of the potential threat based on language (e.g., \"happening now\" vs. \"worried about later\") and emotional intensity.\n    *   **Risk of Escalation Assessment:** This is the most complex part. It involves pattern recognition, potentially comparing the language to known escalation patterns (e.g., increasing anger, threats, specific types of conflict language). It might also consider context like time of day, user's stated location (if shared), or previous interactions if available *within the app's defined privacy boundaries*.\n\n3.  **Strategy Identification & Response Generation:**\n    *   **Based on Low-to-Moderate Risk:** If the analysis suggests distress but not immediate, severe danger, Gemini could:\n        *   Offer supportive messages.\n        *   Suggest calming or grounding techniques.\n        *   Provide links to resources (mental health lines, conflict resolution guides).\n        *   Prompt the user for more information to clarify the situation.\n        *   Suggest contacting a pre-defined trusted contact.\n    *   **Based on High Risk / Escalation:** If the analysis indicates immediate danger, high distress, or clear escalation:\n        *   Prioritize initiating the notification sequence.\n        *   Potentially offer concise, actionable safety tips if appropriate (e.g., \"Try to move to a safe, public location if possible,\" \"Lock the door\"). *Crucially, AI should be extremely cautious here to avoid giving harmful advice.*\n\n4.  **Notification Protocol (If Triggered by High Risk):**\n    *   **Trusted Contacts:** The system accesses a user-predefined list of trusted contacts (friends, family) within the application and sends them an alert. The alert could include:\n        *   The user's distress signal (or a summary).\n        *   The user's last known location (if shared and permission granted).\n        *   A prompt to check in on the user.\n    *   **Nearby Users (Optional & High Privacy Concern):** If the application has this feature *and the user explicitly opted in*, it could potentially alert other nearby app users who have also opted into being \"helpers.\" This requires robust location services and anonymization/privacy controls.\n    *   **Authorities (Emergency Services):** This is the most critical and complex integration.\n        *   Requires direct API integration with emergency dispatch systems (e.g., 911, 112).\n        *   Needs extremely high accuracy in risk assessment to avoid false alarms.\n        *   Must transmit essential information clearly and concisely (user identity, location, nature of emergency as assessed by AI/reported by user).\n        *   Requires legal frameworks and agreements.\n\n**Critical Considerations and Challenges:**\n\n1.  **Accuracy & False Positives/Negatives:** The AI's assessment *must* be highly accurate.\n    *   *False Positives* (alerting when there's no real danger) can cause unnecessary panic and burden resources (especially emergency services).\n    *   *False Negatives* (failing to detect a real crisis) can have tragic consequences. Sarcasm, unique slang, typos, and lack of context can easily fool AI.\n2.  **Privacy:** This system handles extremely sensitive data (distress messages, location, contact lists). Robust encryption, clear user consent policies, and data minimization are paramount. Alerting \"nearby users\" is particularly fraught with privacy risks.\n3.  **Ethics & Bias:** AI models can inherit biases from their training data. Could the system be more or less likely to trigger alerts based on the user's language style, dialect, or perceived demographic? Who is liable if the AI makes a wrong assessment?\n4.  **User Control & Configuration:** Users must have granular control over who gets notified, when, and with what information. Opt-in must be explicit and easy to manage.\n5.  **Context Limitations:** AI often lacks real-world context. It doesn't know the history between individuals unless explicitly told within the app, can't see body language, or hear tone of voice directly.\n6.  **Technical Implementation:** Requires sophisticated AI models, reliable infrastructure, secure APIs for notifications and emergency services integration (which is often difficult).\n7.  **Over-Reliance:** Users might become overly reliant on the system, potentially delaying direct calls to emergency services when necessary.\n8.  **De-escalation Nuance:** True de-escalation often requires human empathy, active listening, and nuanced communication that AI currently struggles to replicate authentically, especially in high-stakes situations. AI is better positioned to *facilitate* help than to *be* the de-escalator itself.\n\n**Conclusion:**\n\nWhile the concept of using AI like Gemini to analyze distress messages, suggest strategies, and trigger alerts is technologically conceivable and potentially valuable, it represents a significant engineering, ethical, and safety challenge. It would require meticulous design, rigorous testing, transparent policies, user control, and likely function best as a tool to *augment* human support networks and emergency services, rather than replace them. The focus should be on quickly and reliably connecting the user in distress with the *right human help*." }]
  }
];

/**
 * Asks the Gemini AI for help with a question
 * @param {string} question - The user's question for Gemini
 * @returns {Promise<string>} - The response from Gemini
 */
export const askGemini = async (question) => {
  try {
    console.log('Making request to Gemini 2.0 Flash API');
    
    // Create a copy of the conversation context and add the user's question
    const contents = [...CONVERSATION_CONTEXT];
    contents.push({
      role: "user",
      parts: [{ text: question }]
    });
    
    // Make direct request to Gemini API
    const response = await fetch(`${GEMINI_BASE_URL}:generateContent?key=${SECURE_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: contents,
        generationConfig: {
          temperature: 0.7,
          topK: 20,
          topP: 0.9,
          maxOutputTokens: 800,
        },
        safetySettings: [
          {
            category: "HARM_CATEGORY_CIVIC_INTEGRITY",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          }
        ]
      }),
      signal: AbortSignal.timeout(15000) // 15 second timeout (increased for larger context)
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
    
    // Create a copy of the conversation context and add the user's question
    const contents = [...CONVERSATION_CONTEXT];
    contents.push({
      role: "user",
      parts: [{ text: question }]
    });
    
    const response = await fetch(`${GEMINI_BASE_URL}:generateContent?key=${SECURE_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: contents,
        generationConfig: {
          temperature: 0.7,
          topK: 20,
          topP: 0.9,
          maxOutputTokens: 800,
        },
        safetySettings: [
          {
            category: "HARM_CATEGORY_CIVIC_INTEGRITY",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          }
        ]
      }),
      signal: AbortSignal.timeout(15000) // 15 second timeout (increased for larger context)
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