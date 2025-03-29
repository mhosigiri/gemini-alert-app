from flask import Flask, jsonify, request, Response, stream_with_context
from flask_cors import CORS
import os
import json
import base64
from functools import wraps
import google.generativeai as genai
from google.generativeai import types

# Determine environment
ENV = os.environ.get("FLASK_ENV", "development")
DEBUG = ENV == "development"
PORT = int(os.environ.get("PORT", 5001))

app = Flask(__name__)
# Configure CORS based on environment
if DEBUG:
    # In development, allow all origins
    CORS(app, resources={r"/*": {"origins": "*", "supports_credentials": True}})
else:
    # In production, restrict origins (update with your production domain)
    CORS(app, resources={r"/*": {"origins": ["https://your-domain.com"], "supports_credentials": True}})

# Configure Gemini API
GEMINI_API_KEY = "AIzaSyD9t-pWBqbZoFBoGvROkD1YS5dxYBzZE40"
GEMINI_MODEL = "gemini-2.5-pro-exp-03-25"
GEMINI_AVAILABLE = True

# More realistic emergency response when API isn't available
MOCK_GEMINI_RESPONSE = """
Based on your emergency situation, here are the recommended actions:

1. Remain calm and assess your surroundings for immediate dangers.
2. For life-threatening emergencies, call 911 (or your local emergency number) immediately.
3. If you're experiencing a medical emergency, apply basic first aid if safe to do so.
4. For evacuation scenarios, follow official guidance and use designated routes.
5. Stay informed through local emergency broadcasts or official alert systems.
6. If safe, help others who may need assistance.

Remember: This is an automated emergency response system. No internet connection is 
currently available to provide location-specific guidance.
"""

try:
    # Initialize the Gemini client
    genai.configure(api_key=GEMINI_API_KEY)
    GEMINI_AVAILABLE = True
    print(f"Gemini API configured successfully in {ENV} mode")
except Exception as e:
    print(f"Failed to initialize Gemini client: {e}")
    GEMINI_AVAILABLE = False
    print("Using mock responses")

# Skip Firebase in development mode
firebase_admin_init = None
if not DEBUG:
    try:
        import firebase_admin_init
    except Exception as e:
        print(f"Error importing firebase_admin_init: {e}")
        print("Running without Firebase authentication")

# Authentication middleware
def auth_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # For development, disable authentication requirement
        if DEBUG:
            # Add mock user to request
            request.user = {"uid": "mock-user-id"}
            return f(*args, **kwargs)
            
        if firebase_admin_init is None:
            # If Firebase is not available, use mock authentication
            request.user = {"uid": "mock-user-id"}
            return f(*args, **kwargs)
            
        auth_header = request.headers.get('Authorization')
        
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({"error": "No valid authentication token provided"}), 401
        
        token = auth_header.split('Bearer ')[1]
        user = firebase_admin_init.verify_id_token(token)
        
        if not user:
            return jsonify({"error": "Invalid authentication token"}), 401
        
        # Add user to request
        request.user = user
        return f(*args, **kwargs)
    
    return decorated_function

@app.route('/ask', methods=['POST', 'OPTIONS'])
@auth_required
def ask_gemini():
    # Handle preflight OPTIONS request
    if request.method == 'OPTIONS':
        response = app.make_default_options_response()
        return response
        
    data = request.json
    user_input = data.get("question", "")

    if not user_input:
        return jsonify({"error": "No question provided"}), 400

    # Only check if Gemini is available, not if we're in debug mode
    if not GEMINI_AVAILABLE:
        return jsonify({"response": MOCK_GEMINI_RESPONSE})
    
    try:
        # Configure the model
        model = genai.GenerativeModel(GEMINI_MODEL)

        # Configure safety settings
        safety_settings = [
            {
                "category": "HARM_CATEGORY_HARASSMENT",
                "threshold": "BLOCK_NONE",
            },
            {
                "category": "HARM_CATEGORY_HATE_SPEECH",
                "threshold": "BLOCK_NONE",
            },
            {
                "category": "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                "threshold": "BLOCK_NONE",
            },
            {
                "category": "HARM_CATEGORY_DANGEROUS_CONTENT",
                "threshold": "BLOCK_NONE",
            },
        ]

        # Set generation config
        generation_config = {
            "temperature": 0.7,
            "top_p": 0.95,
            "top_k": 40,
            "max_output_tokens": 2048,
        }
        
        # Generate content
        response = model.generate_content(
            user_input,
            generation_config=generation_config,
            safety_settings=safety_settings
        )
        
        return jsonify({"response": response.text})
    except Exception as e:
        # Log the error and provide a fallback response
        error_details = str(e)
        print(f"Gemini API error: {error_details}")
        
        # Check if this is an API key error
        if "API key" in error_details.lower():
            return jsonify({"response": f"Invalid or expired API key. Please check your Gemini API key.\n\n{MOCK_GEMINI_RESPONSE}"}), 200
        else:
            return jsonify({"response": f"I encountered an error when processing your question: {error_details}\n\n{MOCK_GEMINI_RESPONSE}"}), 200

@app.route('/ask-stream', methods=['POST', 'OPTIONS'])
@auth_required
def ask_gemini_stream():
    # Handle preflight OPTIONS request
    if request.method == 'OPTIONS':
        response = app.make_default_options_response()
        return response
        
    data = request.json
    user_input = data.get("question", "")

    if not user_input:
        return jsonify({"error": "No question provided"}), 400

    # Only check if Gemini is available, not if we're in debug mode
    if not GEMINI_AVAILABLE:
        def generate_mock():
            # Split the mock response by lines and send each line as a chunk
            for line in MOCK_GEMINI_RESPONSE.split('\n'):
                yield f"data: {line}\n\n"
                
        return Response(stream_with_context(generate_mock()), 
                       content_type='text/event-stream')

    try:
        # Configure the model
        model = genai.GenerativeModel(GEMINI_MODEL)

        # Configure safety settings
        safety_settings = [
            {
                "category": "HARM_CATEGORY_HARASSMENT",
                "threshold": "BLOCK_NONE",
            },
            {
                "category": "HARM_CATEGORY_HATE_SPEECH",
                "threshold": "BLOCK_NONE",
            },
            {
                "category": "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                "threshold": "BLOCK_NONE",
            },
            {
                "category": "HARM_CATEGORY_DANGEROUS_CONTENT",
                "threshold": "BLOCK_NONE",
            },
        ]

        # Set generation config
        generation_config = {
            "temperature": 0.7,
            "top_p": 0.95,
            "top_k": 40,
            "max_output_tokens": 2048,
        }
        
        def generate():
            response = model.generate_content(
                user_input,
                generation_config=generation_config,
                safety_settings=safety_settings,
                stream=True
            )
            
            for chunk in response:
                if chunk.text:
                    yield f"data: {chunk.text}\n\n"

        return Response(stream_with_context(generate()), 
                       content_type='text/event-stream')
    except Exception as e:
        # Log the error and provide a fallback response
        error_details = str(e)
        print(f"Gemini API error in streaming: {error_details}")
        
        def generate_error():
            if "API key" in error_details.lower():
                yield f"data: Invalid or expired API key. Please check your Gemini API key.\n\n"
            else:
                yield f"data: I encountered an error when processing your question: {error_details}\n\n"
            
            for line in MOCK_GEMINI_RESPONSE.split('\n'):
                yield f"data: {line}\n\n"
                
        return Response(stream_with_context(generate_error()), 
                       content_type='text/event-stream')

@app.route('/user/profile', methods=['GET'])
@auth_required
def get_user_profile():
    user_id = request.user['uid']
    
    # Get user data from Firebase
    if DEBUG or firebase_admin_init is None:
        # Use mock data in development mode
        user_data = {
            "displayName": "Demo User",
            "email": "demo@example.com",
            "location": {"latitude": 37.7749, "longitude": -122.4194},
            "createdAt": "2024-03-29T00:00:00Z"
        }
    else:
        user_data = firebase_admin_init.get_user_data(user_id)
        
        if not user_data:
            # Fall back to mock data
            user_data = {
                "displayName": "Demo User",
                "email": "demo@example.com",
                "location": {"latitude": 37.7749, "longitude": -122.4194},
                "createdAt": "2024-03-29T00:00:00Z"
            }
    
    return jsonify({"profile": user_data})

@app.after_request
def add_cors_headers(response):
    """Add CORS headers to all responses"""
    if DEBUG:
        response.headers.add('Access-Control-Allow-Origin', '*')
    else:
        response.headers.add('Access-Control-Allow-Origin', 'https://your-domain.com')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
    response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
    return response

if __name__ == '__main__':
    app.run(debug=DEBUG, host='0.0.0.0', port=PORT)
