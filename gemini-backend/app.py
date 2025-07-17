from flask import Flask, jsonify, request, Response, stream_with_context
from flask_cors import CORS
import os
from dotenv import load_dotenv
import json
import base64
from functools import wraps
import google.generativeai as genai
from google.generativeai import types
import time
import logging

# Helper function for distance calculation
def haversine(lat1, lon1, lat2, lon2):
    from math import radians, cos, sin, asin, sqrt
    # Earth radius in km
    R = 6371.0
    dlat = radians(lat2 - lat1)
    dlon = radians(lon2 - lon1)
    a = sin(dlat/2)**2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon/2)**2
    c = 2 * asin(sqrt(a))
    return R * c

# Load environment variables from .env file
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO if os.environ.get("FLASK_ENV") == "production" else logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Determine environment
ENV = os.environ.get("FLASK_ENV", "development")
DEBUG = ENV == "development"
PORT = int(os.environ.get("PORT", 5001))

app = Flask(__name__)
# Configure CORS (allow all origins for API routes)
CORS(
    app,
    resources={r"/api/*": {"origins": "*"}},
    supports_credentials=True,
    allow_headers="*",
    expose_headers="*",
    methods=["GET", "POST", "OPTIONS"]
)

# Configure Gemini API
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
GEMINI_MODEL = "gemini-2.5-pro-exp-03-25"
GEMINI_AVAILABLE = False

# Log API key status (without exposing the key)
if GEMINI_API_KEY:
    logger.info(f"Gemini API key loaded (length: {len(GEMINI_API_KEY)})")
else:
    logger.warning("No Gemini API key found in environment variables")

# Health expert system prompt
HEALTH_EXPERT_PROMPT = """
You are a highly skilled health and emergency response expert. Your primary goal is to provide clear, accurate, and actionable advice for medical and safety emergencies.

When asked about your identity or capabilities, respond with: "I am a health expert AI, here to provide guidance in emergency situations."

For any emergency-related query, you must:
1.  Provide critical and helpful information to ensure the user's safety.
2.  Offer step-by-step instructions when appropriate.
3.  Always include a disclaimer to contact professional emergency services (e.g., "call 911" or your local equivalent) as your advice is not a substitute for professional medical help.
"""

try:
    # Initialize the Gemini client
    genai.configure(api_key=GEMINI_API_KEY)
    GEMINI_AVAILABLE = True
    logger.info(f"Gemini API configured successfully in {ENV} mode")
except Exception as e:
    logger.error(f"Failed to initialize Gemini client: {e}")
    GEMINI_AVAILABLE = False

# Skip Firebase in development mode
firebase_admin_init = None
db = None
rtdb = None
try:
    import firebase_admin_init
    db = firebase_admin_init.db
    rtdb = firebase_admin_init.rtdb
    logger.info("Firebase Admin SDK initialized successfully.")
except Exception as e:
    logger.error(f"Error importing firebase_admin_init: {e}")
    logger.warning("Running without Firebase integration.")

# Authentication middleware
def auth_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # If Firebase Admin is not available, proceed with a mock user for demo purposes.
        if firebase_admin_init is None:
            logger.warning("Firebase Admin SDK not initialized. Using mock user for request.")
            request.user = {"uid": "mock-user-for-deployment"}
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
    
    # Prepend the health expert prompt to the user's question
    full_prompt = f"{HEALTH_EXPERT_PROMPT}\n\nUser Question: {user_input}"

    if not user_input:
        return jsonify({"error": "No question provided"}), 400

    # Only check if Gemini is available
    if not GEMINI_AVAILABLE:
        return jsonify({"error": "Gemini API is not available. Please check your API key configuration."}), 503
    
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
            full_prompt,
            generation_config=generation_config,
            safety_settings=safety_settings
        )
        
        return jsonify({"response": response.text})
    except Exception as e:
        # Log the error and provide a fallback response
        error_details = str(e)
        logger.error(f"Gemini API error: {error_details}")
        
        # Check if this is an API key error
        if "API key" in error_details.lower():
            return jsonify({"response": f"Invalid or expired API key. Please check your Gemini API key."}), 200
        else:
            return jsonify({"response": f"I encountered an error when processing your question: {error_details}"}), 200

@app.route('/ask-stream', methods=['POST', 'OPTIONS'])
@auth_required
def ask_gemini_stream():
    # Handle preflight OPTIONS request
    if request.method == 'OPTIONS':
        response = app.make_default_options_response()
        return response
        
    data = request.json
    user_input = data.get("question", "")

    # Prepend the health expert prompt to the user's question
    full_prompt = f"{HEALTH_EXPERT_PROMPT}\n\nUser Question: {user_input}"

    if not user_input:
        return jsonify({"error": "No question provided"}), 400

    # Only check if Gemini is available
    if not GEMINI_AVAILABLE:
        def generate_mock():
            # Return error message instead of mock response
            yield f"data: Gemini API is not available. Please check your API key configuration.\n\n"
                
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
                full_prompt,
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
        logger.error(f"Gemini API error in streaming: {error_details}")
        
        def generate_error():
            if "API key" in error_details.lower():
                yield f"data: Invalid or expired API key. Please check your Gemini API key.\n\n"
            else:
                yield f"data: I encountered an error when processing your question: {error_details}\n\n"
                
        return Response(stream_with_context(generate_error()), 
                       content_type='text/event-stream')

@app.route('/user/profile', methods=['GET'])
@auth_required
def get_user_profile():
    user_id = request.user['uid']
    
    # Get user data from Firebase
    if firebase_admin_init is None:
        return jsonify({"error": "Firebase not initialized"}), 503
        
    user_data = firebase_admin_init.get_user_data(user_id)
    
    if not user_data:
        return jsonify({"error": "User profile not found"}), 404
    
    return jsonify({"profile": user_data})

@app.route('/api/location', methods=['POST', 'OPTIONS'])
@auth_required
def update_location():
    # Handle preflight OPTIONS request
    if request.method == 'OPTIONS':
        response = app.make_default_options_response()
        return response
    
    data = request.json
    user_id = request.user['uid']
    latitude = data.get('latitude')
    longitude = data.get('longitude')
    
    if latitude is None or longitude is None:
        return jsonify({"error": "Latitude and longitude are required"}), 400
    
    # In production, this would update the user's location in Firebase
    if DEBUG:
        logger.info(f"User {user_id} location updated: lat={latitude}, lng={longitude}")

    if firebase_admin_init is None:
        logger.warning("Firebase Admin not initialised – skipping location write")
        return jsonify({"status": "accepted"}), 200

    # TODO: implement actual write if needed.
    return jsonify({"status": "success"}), 200

@app.route('/api/nearest-users', methods=['POST', 'OPTIONS'])
@auth_required
def get_nearest_users():
    # Handle preflight OPTIONS request
    if request.method == 'OPTIONS':
        response = app.make_default_options_response()
        return response
    
    data = request.json
    user_id = request.user['uid']
    latitude = data.get('latitude')
    longitude = data.get('longitude')
    
    if latitude is None or longitude is None:
        return jsonify({"error": "Latitude and longitude are required"}), 400
    
    # Get all user locations from Firebase Realtime Database
    if not rtdb:
        return jsonify({"error": "Firebase Realtime Database not configured"}), 500

    all_locations = rtdb.child('locations').get()
    if not all_locations:
        return jsonify({"nearest_users": []})

    # Calculate distances and sort
    users_with_distance = []
    for uid, data in all_locations.items():
        if uid == user_id:  # Exclude the requesting user
            continue
        
        user_lat = data.get('latitude')
        user_lng = data.get('longitude')
        
        if user_lat is None or user_lng is None:
            continue
            
        distance = haversine(latitude, longitude, user_lat, user_lng)
        users_with_distance.append({
            'userId': uid,
            'displayName': data.get('displayName', 'User'),
            'latitude': user_lat,
            'longitude': user_lng,
            'distance_km': round(distance, 2)
        })
    
    # Sort by distance and return top 4
    users_with_distance.sort(key=lambda x: x['distance_km'])
    nearest_users = users_with_distance[:4]
    
    return jsonify({"nearest_users": nearest_users})

@app.route('/api/send-sos', methods=['POST', 'OPTIONS'])
@auth_required
def send_sos():
    # Handle preflight OPTIONS request
    if request.method == 'OPTIONS':
        response = app.make_default_options_response()
        return response
    
    data = request.json
    user_id = request.user['uid']
    latitude = data.get('latitude')
    longitude = data.get('longitude')
    message = data.get('message', '')
    emergency_type = data.get('emergencyType', 'general')
    
    if latitude is None or longitude is None:
        return jsonify({"error": "Latitude and longitude are required"}), 400
    
    if not message:
        return jsonify({"error": "Message is required"}), 400
    
    # Get nearest users (reuse logic from above)
    # Get all user locations from Firebase Realtime Database
    if not rtdb:
        return jsonify({"error": "Firebase Realtime Database not configured"}), 500
    
    all_locations = rtdb.child('locations').get()
    if not all_locations:
        # In a real scenario, you might still send an alert even if there are no users to notify
        return jsonify({"status": "sos_sent", "recipients": [], "message": "SOS sent, but no nearby users found."})
    
    # Calculate distances and get nearest 4 users
    users_with_distance = []
    for uid, data in all_locations.items():
        if uid == user_id: continue # Exclude self
        
        user_lat = data.get('latitude')
        user_lng = data.get('longitude')
        if not user_lat or not user_lng: continue

        distance = haversine(latitude, longitude, user_lat, user_lng)
        users_with_distance.append({ 'userId': uid, 'distance_km': distance })

    users_with_distance.sort(key=lambda x: x['distance_km'])
    recipients = [u['userId'] for u in users_with_distance[:4]]
    
    # In production, this would:
    # 1. Store the SOS alert in Firebase
    # 2. Send push notifications to nearby users
    # 3. Update real-time database for live tracking
    
    # Log the SOS alert for debugging
    logger.info(f"SOS Alert sent - User: {user_id}, Location: ({latitude}, {longitude}), Type: {emergency_type}, Recipients: {len(recipients)}")
    
    return jsonify({
        "status": "sos_sent",
        "recipients": recipients,
        "alertId": f"alert_{user_id}_{int(time.time())}",
        "message": "SOS alert sent to nearby users"
    })

@app.after_request
def add_cors_headers(response):
    return response

if __name__ == '__main__':
    app.run(debug=DEBUG, host='0.0.0.0', port=PORT)
