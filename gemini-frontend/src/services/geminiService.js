import { auth } from '../firebase'

// Base URL for API requests - always use the environment variable or fallback to localhost
const API_BASE_URL = process.env.VUE_APP_API_BASE_URL || 'http://localhost:5001';

// Flag to determine if we should fall back to client-side responses if API is unreachable
const useClientFallback = true;

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

// Mock responses for different types of emergencies
const EMERGENCY_RESPONSES = {
  medical: `
For medical emergencies:

1. Call emergency services (911 in the US) for life-threatening conditions
2. For minor injuries, apply basic first aid:
   - For cuts: Clean with water, apply pressure to stop bleeding, cover with clean bandage
   - For burns: Run cool (not cold) water over the area, cover with clean dry cloth
   - For sprains: RICE - Rest, Ice, Compression, Elevation
3. Keep the person calm and still
4. Monitor vital signs (breathing, pulse) until help arrives
5. If someone is unconscious but breathing, place them in the recovery position
6. If they're not breathing, begin CPR if you're trained
7. For choking, perform the Heimlich maneuver

Remember: This advice is general - always seek professional medical help in emergencies.
  `,
  safety: `
For personal safety emergencies:

1. If you feel threatened in public, move to a well-lit area with other people
2. Call emergency services if you feel in immediate danger
3. Share your live location with trusted friends or family
4. If being followed, enter a public business or ask for help
5. Trust your instincts - if something feels wrong, take action
6. In case of active threats, remember: Run, Hide, Fight (in that order)
7. Keep emergency contacts easily accessible on your phone
8. Consider using safety apps that can quickly alert contacts with your location
9. Stay aware of your surroundings and avoid distractions like headphones in isolated areas

Stay safe and remember that your well-being is the priority.
  `,
  harassment: `
For harassment situations:

1. Clearly state that the behavior is unwelcome and inappropriate
2. Remove yourself from the situation if possible
3. Document incidents with dates, times, descriptions, and witnesses
4. Report the harassment to appropriate authorities (campus security, HR, police)
5. Seek support from trusted friends, family, or counselors
6. Know your rights - harassment based on protected characteristics is illegal
7. Consider using a personal safety app that records and alerts contacts
8. If online harassment occurs, block the person and report to the platform
9. Keep evidence of all communications and incidents
10. Contact local victim support services for additional resources

Remember you have the right to feel safe, and you're not alone.
  `,
  general: `
For general emergency situations:

1. First assess: Is anyone in immediate danger?
2. Call emergency services if necessary (911 in US)
3. Stay calm and speak clearly when requesting help
4. Follow instructions from emergency personnel
5. If evacuation is needed, leave immediately - don't gather belongings
6. Help others if it's safe to do so
7. Have a communication plan with family/friends - designate meeting points
8. Keep emergency contacts and important documents accessible
9. Have basic emergency supplies ready (water, first aid, flashlight)
10. Stay informed through emergency broadcasts or official alert systems

Being prepared and remaining calm are your best tools in any emergency.
  `
};

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
    } catch (fetchError) {
      console.warn('Backend fetch failed:', fetchError);
      
      // Only use client-side fallback if the flag is enabled
      if (useClientFallback) {
        console.log('Using client-side fallback response generator');
        return generateMockResponse(question);
      } else {
        throw fetchError; // Re-throw if we don't want to use fallbacks
      }
    }
  } catch (error) {
    console.error('Error asking Gemini:', error);
    
    if (useClientFallback) {
      return generateMockResponse(question);
    } else {
      return `Sorry, there was an error connecting to Gemini: ${error.message}. Please try again later.`;
    }
  }
}

/**
 * Analyze question to determine the most appropriate response type
 * @param {string} question - The user's question
 * @returns {string} The response category
 */
function determineResponseType(question) {
  // Convert question to lowercase for easier matching
  const q = question.toLowerCase();
  
  // Check for medical keywords
  if (
    q.includes('injured') || 
    q.includes('hurt') || 
    q.includes('bleeding') || 
    q.includes('pain') || 
    q.includes('hospital') || 
    q.includes('medical') || 
    q.includes('doctor') || 
    q.includes('ambulance') ||
    q.includes('first aid') ||
    q.includes('wound') ||
    q.includes('accident')
  ) {
    return 'medical';
  }
  
  // Check for safety keywords
  if (
    q.includes('safe') || 
    q.includes('danger') || 
    q.includes('threat') || 
    q.includes('attack') || 
    q.includes('weapon') || 
    q.includes('hide') || 
    q.includes('protect') ||
    q.includes('stalking') ||
    q.includes('following')
  ) {
    return 'safety';
  }
  
  // Check for harassment keywords
  if (
    q.includes('harass') || 
    q.includes('unwanted') || 
    q.includes('uncomfortable') || 
    q.includes('inappropriate') || 
    q.includes('touch') || 
    q.includes('report') || 
    q.includes('bully') ||
    q.includes('stalker')
  ) {
    return 'harassment';
  }
  
  // Default to general emergencies
  return 'general';
}

/**
 * Generate a mock response based on the user's question
 * @param {string} question - The user's question
 * @returns {string} - The generated mock response
 */
function generateMockResponse(question) {
  // Determine which type of response to use
  const responseType = determineResponseType(question);
  
  // Get the appropriate response template
  const responseTemplate = EMERGENCY_RESPONSES[responseType];
  
  // Add personalization to make it seem more like a real response
  return `In response to your question: "${question}"\n\n${responseTemplate}\n\nI hope this helps with your situation. Stay safe!`;
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
      if (useClientFallback) {
        // Send fallback response in chunks
        simulateStreamingResponse(question, onChunkReceived);
      } else {
        onChunkReceived("Error getting authentication token. Please try again.");
      }
      return
    }
    
    try {
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
    } catch (fetchError) {
      console.warn('Streaming fetch failed:', fetchError)
      
      if (useClientFallback) {
        console.log('Using client-side fallback streaming response');
        simulateStreamingResponse(question, onChunkReceived);
      } else {
        onChunkReceived(`Sorry, there was an error connecting to the Gemini API: ${fetchError.message}. Please try again later.`);
      }
    }
  } catch (error) {
    console.error('Error streaming from Gemini:', error)
    
    if (useClientFallback) {
      simulateStreamingResponse(question, onChunkReceived);
    } else {
      onChunkReceived(`Error: ${error.message}. Please try again.`);
    }
  }
}

/**
 * Simulates a streaming response with content based on user question
 * @param {string} question - The original question
 * @param {function} onChunkReceived - Callback for each chunk
 */
function simulateStreamingResponse(question, onChunkReceived) {
  // Determine response type based on question
  const responseType = determineResponseType(question);
  const responseTemplate = EMERGENCY_RESPONSES[responseType];
  
  // Create an introduction
  const intro = `In response to your question: "${question}"\n\n`;
  
  // Split into an array of all sentences
  const allLines = [
    ...intro.split('\n'),
    ...responseTemplate.trim().split('\n')
  ];
  
  // Add a conclusion
  allLines.push('');
  allLines.push('I hope this helps with your situation. Stay safe!');
  
  let currentIndex = 0;
  
  // Use a timer to simulate streaming
  const interval = setInterval(() => {
    if (currentIndex < allLines.length) {
      const line = allLines[currentIndex].trim();
      if (line) {
        // Send each line followed by a space or newline
        onChunkReceived(line + (line.startsWith('1.') || line.endsWith(':') ? '\n' : ' '));
      } else {
        // Empty line means newline
        onChunkReceived('\n');
      }
      currentIndex++;
    } else {
      clearInterval(interval);
    }
  }, 100); // Faster pace for better user experience
}