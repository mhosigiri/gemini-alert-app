from flask import Flask, jsonify, request, Response, stream_with_context, current_app
from flask_cors import CORS
import os
from dotenv import load_dotenv
from functools import wraps
import google.generativeai as genai
import time
import logging
from firebase_admin import firestore as admin_firestore

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

allowed_origins = [
    origin.strip()
    for origin in os.environ.get(
        "ALLOWED_ORIGINS",
        "http://localhost:8080,http://127.0.0.1:8080"
    ).split(",")
    if origin.strip()
]

CORS(
    app,
    resources={r"/*": {"origins": allowed_origins}},
    supports_credentials=True,
    allow_headers=["*"],
    expose_headers=["*"],
    methods=["GET", "POST", "OPTIONS"]
)

# Configure Gemini API
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
GEMINI_MODEL = "gemini-2.5-flash-lite"  # Lightweight model to minimize quota usage
gemini_model = None
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
    if not GEMINI_API_KEY:
        raise ValueError("GEMINI_API_KEY environment variable is not set")
    genai.configure(api_key=GEMINI_API_KEY)
    gemini_model = genai.GenerativeModel(
        model_name=GEMINI_MODEL,
        generation_config={
            "temperature": 0.4,
            "top_p": 0.9,
            "top_k": 32,
            "max_output_tokens": 512,
        },
        safety_settings=[
            {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_NONE"},
            {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_NONE"},
            {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_NONE"},
            {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_NONE"},
        ]
    )
    GEMINI_AVAILABLE = True
    logger.info("Gemini API configured successfully in %s mode", ENV)
except Exception as e:
    logger.error(f"Failed to initialize Gemini client: {e}")
    GEMINI_AVAILABLE = False

def get_gemini_model():
    global gemini_model
    if not GEMINI_API_KEY:
        raise RuntimeError("Gemini API key is not configured.")
    if gemini_model is None:
        gemini_model = genai.GenerativeModel(
            model_name=GEMINI_MODEL,
            generation_config={
                "temperature": 0.4,
                "top_p": 0.9,
                "top_k": 32,
                "max_output_tokens": 512,
            },
            safety_settings=[
                {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_NONE"},
                {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_NONE"},
                {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_NONE"},
                {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_NONE"},
            ]
        )
    return gemini_model

def format_prompt(question: str) -> str:
    return f"{HEALTH_EXPERT_PROMPT.strip()}\n\nUser Question:\n{question.strip()}"

def persist_chat_entry(user_id: str, question: str, answer: str) -> None:
    if not answer:
        return
    if not rtdb:
        return
    try:
        chat_ref = rtdb.child('chats').child(user_id).push()
        chat_ref.set({
            'question': question,
            'response': answer,
            'timestamp': int(time.time())
        })
    except Exception as persist_error:
        logger.warning("Failed to store chat history for %s: %s", user_id, persist_error)

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
        if request.method == 'OPTIONS':
            response = current_app.make_default_options_response()
            return response
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

def generate_gemini_response(question: str) -> str:
    model = get_gemini_model()
    response = model.generate_content(
        format_prompt(question),
        generation_config={
            "temperature": 0.4,
            "top_p": 0.9,
            "top_k": 32,
            "max_output_tokens": 512,
        },
        safety_settings=[
            {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_NONE"},
            {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_NONE"},
            {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_NONE"},
            {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_NONE"},
        ]
    )

    texts = []
    if getattr(response, "text", None):
        texts.append(response.text)
    candidates = getattr(response, "candidates", None) or []
    for candidate in candidates:
        content = getattr(candidate, "content", None)
        parts = getattr(content, "parts", []) if content else []
        for part in parts:
            text = getattr(part, "text", None)
            if text:
                texts.append(text)

    return "\n".join(filter(None, (t.strip() for t in texts))).strip()


@app.route('/ask', methods=['POST', 'OPTIONS'])
@auth_required
def ask_gemini():
    if request.method == 'OPTIONS':
        return app.make_default_options_response()

    payload = request.get_json(silent=True) or {}
    question = (payload.get("question") or "").strip()
    if not question:
        return jsonify({"error": "No question provided"}), 400

    if not GEMINI_AVAILABLE:
        return jsonify({"error": "Gemini API is not available. Please check your API key configuration."}), 503

    try:
        answer = generate_gemini_response(question)
        persist_chat_entry(request.user['uid'], question, answer)
        return jsonify({"response": answer or "I'm here and listening, but I couldn't generate a response right now."})
    except Exception as exc:
        logger.error("Gemini API error: %s", exc, exc_info=True)
        message = str(exc)
        if "API key" in message.lower():
            return jsonify({"response": "Invalid or expired Gemini API key. Please verify the server configuration."}), 200
        return jsonify({"response": "I ran into an issue generating a reply. Please try again in a moment."}), 200

@app.route('/ask-stream', methods=['POST', 'OPTIONS'])
@auth_required
def ask_gemini_stream():
    # Handle preflight OPTIONS request
    if request.method == 'OPTIONS':
        response = app.make_default_options_response()
        return response
        
    payload = request.get_json(silent=True) or {}
    question = (payload.get("question") or "").strip()

    if not question:
        return jsonify({"error": "No question provided"}), 400

    if not GEMINI_AVAILABLE:
        def unavailable():
            yield "data: Gemini API is not available. Please check your Gemini API key.\n\n"
        return Response(stream_with_context(unavailable()), mimetype='text/event-stream')

    user_id = request.user['uid']

    def extract_text(chunk):
        texts = []
        if getattr(chunk, "text", None):
            texts.append(chunk.text)
        candidates = getattr(chunk, "candidates", None) or []
        for candidate in candidates:
            content = getattr(candidate, "content", None)
            parts = getattr(content, "parts", []) if content else []
            for part in parts:
                text = getattr(part, "text", None)
                if text:
                    texts.append(text)
        return texts

    def stream_response():
        collected_chunks = []
        try:
            model = get_gemini_model()
            response_stream = model.generate_content(
                format_prompt(question),
                generation_config={
                    "temperature": 0.4,
                    "top_p": 0.9,
                    "top_k": 32,
                    "max_output_tokens": 512,
                },
                safety_settings=[
                    {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_NONE"},
                    {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_NONE"},
                    {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_NONE"},
                    {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_NONE"},
                ],
                stream=True
            )
            for chunk in response_stream:
                pieces = extract_text(chunk)
                if not pieces:
                    continue
                collected_chunks.extend(pieces)
                yield from (
                    f"data: {piece}\n\n"
                    for piece in pieces if piece.strip()
                )
        except Exception as stream_exc:
            logger.error("Gemini streaming error: %s", stream_exc, exc_info=True)
            message = str(stream_exc)
            if "API key" in message.lower():
                yield "data: Invalid or expired Gemini API key. Please verify the server configuration.\n\n"
            else:
                safe_message = message.replace("\n", " ").strip()
                yield f"data: Streaming error: {safe_message or 'Unknown error occurred.'}\n\n"
        finally:
            full_response = "".join(collected_chunks).strip()
            if full_response:
                persist_chat_entry(user_id, question, full_response)

    return Response(stream_with_context(stream_response()), mimetype='text/event-stream')

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

@app.route('/api/users/sync', methods=['POST', 'OPTIONS'])
@auth_required
def sync_user_profile():
    if request.method == 'OPTIONS':
        return current_app.make_default_options_response()

    if firebase_admin_init is None or db is None:
        logger.warning("Firebase Admin SDK not initialised – skipping user sync")
        return jsonify({"error": "Firebase not configured"}), 503

    payload = request.json or {}
    user_id = request.user['uid']
    email = payload.get('email') or request.user.get('email')
    display_name = payload.get('displayName') or request.user.get('name') or (email.split('@')[0] if email else 'User')
    photo_url = payload.get('photoURL') or request.user.get('picture')
    phone_number = payload.get('phoneNumber') or request.user.get('phone_number')
    address = payload.get('address')
    latitude = payload.get('latitude')
    longitude = payload.get('longitude')

    user_doc = {
        'uid': user_id,
        'email': email,
        'displayName': display_name,
        'photoURL': photo_url,
        'phoneNumber': phone_number,
        'address': address,
        'lastLoginAt': admin_firestore.SERVER_TIMESTAMP,
        'updatedAt': admin_firestore.SERVER_TIMESTAMP
    }

    if latitude is not None and longitude is not None:
        try:
            user_doc['location'] = admin_firestore.GeoPoint(float(latitude), float(longitude))
            user_doc['locationAccuracy'] = payload.get('accuracy')
            user_doc['lastLocationUpdate'] = admin_firestore.SERVER_TIMESTAMP
        except Exception as geo_error:
            logger.warning(f"Failed to set GeoPoint for user {user_id}: {geo_error}")

    firestore_success = False
    try:
        db.collection('users').document(user_id).set(
            {k: v for k, v in user_doc.items() if v is not None},
            merge=True
        )
        firestore_success = True
    except Exception as firestore_error:
        logger.error(f"Failed to write user {user_id} to Firestore: {firestore_error}")

    rtdb_success = False
    if rtdb:
        try:
            rtdb.child('users').child(user_id).update({
                'displayName': display_name,
                'email': email,
                'photoURL': photo_url,
                'address': address,
                'lastActive': int(time.time() * 1000)
            })
            rtdb_success = True
        except Exception as rtdb_error:
            logger.warning(f"Failed to sync user {user_id} to RTDB: {rtdb_error}")

    return jsonify({
        "status": "synced",
        "firestore": firestore_success,
        "realtime": rtdb_success
    })

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
    try:
        lat_val = float(latitude)
        lon_val = float(longitude)
    except (TypeError, ValueError):
        return jsonify({"error": "Invalid latitude/longitude"}), 400

    accuracy = data.get('accuracy')
    address = data.get('address')
    timestamp = data.get('timestamp') or int(time.time() * 1000)
    display_name = data.get('displayName') or request.user.get('name') or 'User'
    email = request.user.get('email')

    if DEBUG:
        logger.debug(f"User {user_id} location payload: lat={lat_val}, lng={lon_val}, accuracy={accuracy}")

    if firebase_admin_init is None or db is None:
        logger.warning("Firebase Admin not initialised – skipping persistent location write")
        return jsonify({"status": "accepted"}), 200

    location_doc = {
        'location': admin_firestore.GeoPoint(lat_val, lon_val),
        'locationAccuracy': accuracy,
        'address': address,
        'lastLocationUpdate': admin_firestore.SERVER_TIMESTAMP,
        'updatedAt': admin_firestore.SERVER_TIMESTAMP
    }

    firestore_success = False
    try:
        db.collection('users').document(user_id).set(location_doc, merge=True)
        firestore_success = True
    except Exception as firestore_error:
        logger.error(f"Failed to persist location for {user_id}: {firestore_error}")

    rtdb_success = False
    if rtdb:
        try:
            rtdb.child('locations').child(user_id).update({
                'latitude': lat_val,
                'longitude': lon_val,
                'accuracy': accuracy,
                'timestamp': timestamp,
                'displayName': display_name,
                'email': email,
                'address': address
            })
            rtdb_success = True
        except Exception as rtdb_error:
            logger.warning(f"Failed to mirror location for {user_id} to RTDB: {rtdb_error}")

    return jsonify({
        "status": "success",
        "firestore": firestore_success,
        "realtime": rtdb_success
    }), 200

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

@app.route('/chats', methods=['GET'])
@auth_required
def get_chats():
    if not rtdb:
        return jsonify({"error": "Firebase Realtime Database not configured"}), 500

    user_id = request.user['uid']
    
    try:
        chats_ref = rtdb.child('chats').child(user_id)
        chats = chats_ref.get()
        
        if not chats:
            return jsonify({"history": []})

        # Format the chat history
        history = []
        for chat_id, chat_data in chats.items():
            history.append({
                'sender': 'user',
                'text': chat_data.get('question')
            })
            history.append({
                'sender': 'ai',
                'text': chat_data.get('response')
            })
            
        # Sort by timestamp
        history.sort(key=lambda x: x.get('timestamp', 0))

        return jsonify({"history": history})
    except Exception as e:
        logger.error(f"Error fetching chat history: {e}")
        return jsonify({"error": "An error occurred while fetching chat history"}), 500

@app.route('/api/cleanup-chats', methods=['POST'])
def cleanup_chats():
    if not rtdb:
        return jsonify({"error": "Firebase Realtime Database not configured"}), 500

    try:
        thirty_minutes_ago = int(time.time()) - (30 * 60)
        chats_ref = rtdb.child('chats')
        all_user_chats = chats_ref.get()

        if not all_user_chats:
            return jsonify({"status": "no chats to cleanup"}), 200

        for user_id, chats in all_user_chats.items():
            for chat_id, chat_data in chats.items():
                if chat_data.get('timestamp', 0) < thirty_minutes_ago:
                    rtdb.child('chats').child(user_id).child(chat_id).delete()
        
        return jsonify({"status": "cleanup successful"}), 200
    except Exception as e:
        logger.error(f"Error during chat cleanup: {e}")
        return jsonify({"error": "An error occurred during cleanup"}), 500

def run_chat_cleanup_scheduler():
    while True:
        time.sleep(30 * 60) # Sleep for 30 minutes
        try:
            with app.app_context():
                cleanup_chats()
            logger.info("Chat cleanup task completed.")
        except Exception as e:
            logger.error(f"Error in chat cleanup scheduler: {e}")

@app.after_request
def add_cors_headers(response):
    return response

if __name__ == '__main__':
    # Start the chat cleanup scheduler in a background thread
    cleanup_thread = threading.Thread(target=run_chat_cleanup_scheduler, daemon=True)
    cleanup_thread.start()
    app.run(debug=DEBUG, host='0.0.0.0', port=PORT)
