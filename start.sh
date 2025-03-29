#!/bin/bash
# Start script for Gemini Alert application

# Define colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to kill processes on specific ports with better error handling
kill_process_on_port() {
  local port=$1
  echo -e "Checking if port ${port} is in use..."
  
  # First check if the port is actually in use
  if ! nc -z localhost $port &>/dev/null; then
    echo -e "Port ${port} is available."
    return 0
  fi
  
  echo -e "Port ${port} is in use. Attempting to kill process..."
  
  # Try to get PID using lsof
  local pid=$(lsof -ti:${port})
  
  if [ -z "$pid" ]; then
    # If lsof didn't work, try netstat
    pid=$(netstat -anv | grep LISTEN | grep -w "${port}" | awk '{print $9}')
  fi
  
  if [ -z "$pid" ]; then
    echo -e "${RED}Cannot identify process using port ${port}${NC}"
    echo -e "Please manually terminate the process and try again."
    return 1
  fi
  
  echo -e "Killing process ${pid} using port ${port}..."
  kill -9 $pid 2>/dev/null
  sleep 2
  
  # Verify the port is now available
  if nc -z localhost $port &>/dev/null; then
    echo -e "${RED}Failed to free port ${port}${NC}"
    return 1
  else
    echo -e "${GREEN}Successfully freed port ${port}${NC}"
    return 0
  fi
}

# Make sure ports are free before starting
ensure_ports_available() {
  # Kill any existing processes on required ports
  kill_process_on_port 5001 || return 1
  kill_process_on_port 8080 || return 1
  return 0
}

echo -e "${GREEN}Starting Gemini Alert Application...${NC}"

# Make sure all necessary ports are available
if ! ensure_ports_available; then
  echo -e "${RED}Failed to free all required ports. Please resolve port conflicts manually.${NC}"
  exit 1
fi

# Ensure we're in the virtual environment
if [ -d "venv" ]; then
  source venv/bin/activate
fi

# Check if dependencies are installed
if [ ! -d "venv" ] || [ ! -d "gemini-frontend/node_modules" ]; then
  echo -e "${RED}Dependencies not found. Running setup...${NC}"
  ./setup.sh
fi

# Start backend
echo -e "${GREEN}Starting Backend...${NC}"
cd gemini-backend
# Force debug mode and port 5001
FLASK_DEBUG=1 python app.py > ../backend.log 2>&1 &
BACKEND_PID=$!
cd ..

# Check if backend started successfully
sleep 3
if ! ps -p $BACKEND_PID > /dev/null; then
  echo -e "${RED}Backend failed to start. See backend.log for details.${NC}"
  cat backend.log
  exit 1
fi

# Start frontend
echo -e "${GREEN}Starting Frontend...${NC}"
cd gemini-frontend
NODE_OPTIONS="--openssl-legacy-provider" npm run serve > ../frontend.log 2>&1 &
FRONTEND_PID=$!
cd ..

# Check if frontend started successfully
sleep 5
if ! ps -p $FRONTEND_PID > /dev/null; then
  echo -e "${RED}Frontend failed to start. See frontend.log for details.${NC}"
  cat frontend.log
  kill $BACKEND_PID 2>/dev/null
  exit 1
fi

# Set up signal handling to kill both processes on exit
trap 'echo -e "${RED}Shutting down...${NC}"; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit' INT TERM

echo -e "${GREEN}================================================${NC}"
echo -e "${GREEN}Gemini Alert is running!${NC}"
echo -e "${BLUE}Backend:${NC} http://localhost:5001"
echo -e "${BLUE}Frontend:${NC} http://localhost:8080"
echo -e "${GREEN}================================================${NC}"
echo -e "Press ${RED}Ctrl+C${NC} to stop the application"

# Wait for processes to finish or be interrupted
wait 