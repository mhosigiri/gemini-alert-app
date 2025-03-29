from flask import Flask, jsonify, request, Response, stream_with_context
from flask_cors import CORS
import os
import json
from functools import wraps
import firebase_admin_init

app = Flask(__name__)
# Enable CORS with more options to fix cross-origin issues
CORS(app, resources={r"/*": {"origins": "*", "supports_credentials": True}})

# Placeholder response for development
MOCK_GEMINI_RESPONSE = """
I'm a simulated Gemini response for development purposes.

Here are some general emergency tips:
1. Stay calm and assess the situation.
2. Call emergency services if needed (911 in the US).
3. Follow safety protocols appropriate for your emergency.
4. If safe to do so, help others around you.
5. Listen to official instructions from authorities.
"""

# ALWAYS use mock data for development
GEMINI_AVAILABLE = False
print("Using mock Gemini responses for development")

# Authentication middleware
def auth_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # For development, always disable authentication requirement
        # Add mock user to request
        request.user = {"uid": "mock-user-id"}
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

    # Always use mock response for development
    return jsonify({"response": MOCK_GEMINI_RESPONSE})

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

    # Always use mock response for development
    def generate_mock():
        # Split the mock response by lines and send each line as a chunk
        for line in MOCK_GEMINI_RESPONSE.split('\n'):
            yield f"data: {line}\n\n"
            
    return Response(stream_with_context(generate_mock()), 
                   content_type='text/event-stream')

@app.route('/user/profile', methods=['GET'])
@auth_required
def get_user_profile():
    user_id = request.user['uid']
    
    # Mock user data for development
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
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
    response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
    return response

if __name__ == '__main__':
    app.run(debug=True, port=5001)
