# Gemini Alert

A emergency alert application that helps users send alerts to nearby people in emergency situations. Includes a Gemini AI-powered assistant for providing guidance and safety information.

## Features

- **Emergency Alerts**: Send emergency alerts to nearby users
- **Location Tracking**: Track user locations and find nearby helpers
- **Gemini AI Assistant**: Get safety advice and guidance from AI
- **Voice Interface**: Ask questions and get responses with voice input/output
- **Real-time Map**: View nearby users and alerts on an interactive map
- **Firebase Integration**: Authentication, Firestore database, and Realtime Database

## Tech Stack

- **Frontend**: Vue.js 3, Firebase SDK, Google Maps API
- **Backend**: Flask, Firebase Admin SDK, Google Generative AI (Gemini API)
- **Database**: Firebase Firestore and Realtime Database
- **Authentication**: Firebase Authentication
- **Deployment**: Firebase Hosting, Heroku/Google Cloud (backend)

## Setup for Development

1. **Clone the repository**:

   ```
   git clone https://github.com/yourusername/gemini-alert.git
   cd gemini-alert
   ```

2. **Install dependencies**:

   ```
   # Backend
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   pip install -r requirements.txt

   # Frontend
   cd gemini-frontend
   npm install
   ```

3. **Environment Setup**:

   - Create a `.env.development` file in the `gemini-frontend` directory with your Firebase and Gemini API keys
   - Set the `GEMINI_API_KEY` environment variable for the backend

4. **Run the application**:
   ```
   ./start.sh
   ```

## Deployment

### Frontend Deployment (Firebase Hosting)

1. **Build the frontend**:

   ```
   cd gemini-frontend
   npm run build:prod
   ```

2. **Deploy to Firebase Hosting**:
   ```
   npm run deploy
   ```

### Backend Deployment

1. **Prepare the backend**:

   ```
   ./deploy-backend.sh
   ```

2. **Deploy to your preferred hosting platform**:
   - Heroku, Google Cloud Run, AWS, etc.
   - Set the necessary environment variables (see `.env.example`)

## API Documentation

### Backend API Endpoints

- `POST /ask`: Ask a question to the Gemini AI
- `POST /ask-stream`: Ask a question with streaming response
- `GET /user/profile`: Get the user's profile information

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.
