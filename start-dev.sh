#!/bin/bash
# Modified start script for development with .env file

# Load environment variables from .env file
if [ -f .env ]; then
  export $(cat .env | grep -v '^#' | xargs)
  echo "Loaded environment variables from .env file"
  echo "GEMINI_API_KEY: ${GEMINI_API_KEY}"
fi

# Kill any existing processes on port 5001
echo "Killing existing processes on port 5001..."
lsof -ti:5001 | xargs kill -9 2>/dev/null || true
echo "Killing existing processes on port 8080..."
lsof -ti:8080 | xargs kill -9 2>/dev/null || true

# Start backend
echo "Starting Backend..."
cd gemini-backend
FLASK_DEBUG=1 python app.py > ../backend.log 2>&1 &
BACKEND_PID=$!
cd ..

# Wait for backend to start
sleep 3

# Start frontend
echo "Starting Frontend..."
cd gemini-frontend
NODE_OPTIONS=--openssl-legacy-provider npm run serve > ../frontend.log 2>&1 &
FRONTEND_PID=$!
cd ..

# Set up signal handling to kill both processes on exit
trap 'echo "Shutting down..."; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit' INT TERM

echo "================================================"
echo "Gemini Alert is running!"
echo "Backend: http://localhost:5001"
echo "Frontend: http://localhost:8080"
if [ -z "$GEMINI_API_KEY" ] || [ "$GEMINI_API_KEY" == "YOUR_API_KEY_HERE" ]; then
  echo "Warning: Using mock Gemini responses"
else
  echo "Using real Gemini API responses with key: ${GEMINI_API_KEY:0:5}..."
fi
echo "================================================"
echo "Press Ctrl+C to stop the application"

# Wait for processes to finish or be interrupted
wait 