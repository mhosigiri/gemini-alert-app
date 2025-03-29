from flask import Flask, jsonify, request, Response, stream_with_context
from flask_cors import CORS
import os
import google.generativeai as genai
from functools import wraps
import firebase_admin_init

app = Flask(__name__)
CORS(app)  # Allow frontend to communicate with backend

# Configure Gemini API
genai.configure(api_key=os.environ.get("GEMINI_API_KEY", "AlzaSyAnqUVoRXrE-hWTavT7TP32YByahRFVoE"))

# Authentication middleware
def auth_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
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

@app.route('/ask', methods=['POST'])
@auth_required
def ask_gemini():
    data = request.json
    user_input = data.get("question", "")

    if not user_input:
        return jsonify({"error": "No question provided"}), 400

    # Use the older, more compatible API
    model = genai.GenerativeModel('gemini-pro')
    response = model.generate_content(user_input)
    
    return jsonify({"response": response.text})

@app.route('/ask-stream', methods=['POST'])
@auth_required
def ask_gemini_stream():
    data = request.json
    user_input = data.get("question", "")

    if not user_input:
        return jsonify({"error": "No question provided"}), 400

    model = genai.GenerativeModel('gemini-pro')
    
    def generate():
        response = model.generate_content(
            user_input,
            stream=True
        )
        
        for chunk in response:
            if chunk.text:
                yield f"data: {chunk.text}\n\n"

    return Response(stream_with_context(generate()), content_type='text/event-stream')

@app.route('/user/profile', methods=['GET'])
@auth_required
def get_user_profile():
    user_id = request.user['uid']
    user_data = firebase_admin_init.get_user_data(user_id)
    
    if not user_data:
        return jsonify({"error": "User profile not found"}), 404
    
    return jsonify({"profile": user_data})

if __name__ == '__main__':
    app.run(debug=True)
