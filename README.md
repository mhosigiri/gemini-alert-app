# Gemini Alert

A crisis de-escalation web application that uses Google's Gemini AI to provide real-time guidance for managing stressful situations, anxiety, conflict, and other escalating scenarios.

## Features

- **User Authentication**: Secure login and registration system using Firebase
- **De-escalation Templates**: Pre-defined templates for common crisis situations
- **AI-Powered Guidance**: Integration with Google's Gemini AI for personalized de-escalation strategies
- **Real-time Assistance**: Immediate, step-by-step guidance for managing escalating situations

## Project Structure

- **Backend**: Flask API that integrates with Gemini AI
- **Frontend**: Vue.js application with a responsive UI

## Setup Instructions

### Prerequisites

- Node.js and npm
- Python 3.6+
- Firebase account
- Google Gemini API key

### Backend Setup

1. Navigate to the backend directory:

   ```
   cd gemini-backend
   ```

2. Create and activate a virtual environment:

   ```
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. Install dependencies:

   ```
   pip install flask flask-cors google-generativeai
   ```

4. Set the API key:

   ```
   export GEMINI_API_KEY="your-api-key"
   ```

5. Run the backend:
   ```
   python app.py
   ```

### Frontend Setup

1. Navigate to the frontend directory:

   ```
   cd gemini-frontend
   ```

2. Install dependencies:

   ```
   npm install
   ```

3. Run the development server:
   ```
   npm run serve
   ```

## Usage

1. Register a new account or log in with existing credentials
2. Select a template or describe your situation in the input field
3. Click "Get De-escalation Guidance" to receive AI-powered assistance
4. Follow the step-by-step guidance provided

## Contribution

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.
