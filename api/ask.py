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
    supports_credentials=True
)

# Initialize Firebase Admin SDK
try:
    from firebase_admin_init import initialize_firebase_admin
    db = initialize_firebase_admin()
    logger.info("Firebase Admin SDK initialized successfully")
except Exception as e:
    logger.error(f"Failed to initialize Firebase Admin SDK: {e}")
    db = None

# Initialize Gemini API
try:
    genai.configure(api_key=os.environ.get("GEMINI_API_KEY"))
    model = genai.GenerativeModel('gemini-2.0-flash-exp')
    logger.info("Gemini API initialized successfully")
except Exception as e:
    logger.error(f"Failed to initialize Gemini API: {e}")
    model = None

def require_auth(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({'error': 'Missing or invalid authorization header'}), 401

        token = auth_header.split(' ')[1]
        try:
            # Verify Firebase token
            from firebase_admin import auth
            decoded_token = auth.verify_id_token(token)
            request.user_id = decoded_token['uid']
            return f(*args, **kwargs)
        except Exception as e:
            logger.error(f"Token verification failed: {e}")
            return jsonify({'error': 'Invalid token'}), 401
    return decorated_function

@app.route('/ask', methods=['POST', 'OPTIONS'])
@require_auth
def ask():
    if request.method == 'OPTIONS':
        return jsonify({}), 200

    try:
        data = request.get_json()
        if not data or 'message' not in data:
            return jsonify({'error': 'Message is required'}), 400

        user_message = data['message']
        user_id = request.user_id

        if not model:
            return jsonify({'error': 'Gemini API not available'}), 503

        # Generate response
        response = model.generate_content(user_message)
        ai_response = response.text

        # Store conversation in Firestore
        if db:
            try:
                chat_ref = db.collection('chats').document(user_id).collection('messages')
                chat_ref.add({
                    'user_message': user_message,
                    'ai_response': ai_response,
                    'timestamp': time.time(),
                    'type': 'gemini'
                })
                logger.info(f"Stored chat for user {user_id}")
            except Exception as e:
                logger.error(f"Failed to store chat: {e}")

        return jsonify({
            'response': ai_response,
            'timestamp': time.time()
        })

    except Exception as e:
        logger.error(f"Error in /ask: {e}")
        return jsonify({'error': 'Internal server error'}), 500

# Vercel serverless function handler
def handler(request):
    with app.request_context(request.environ):
        return app.full_dispatch_request()

