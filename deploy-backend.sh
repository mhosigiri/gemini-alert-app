#!/bin/bash
# Backend deployment script

# Define colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}Preparing backend for deployment...${NC}"

# Make sure we're in the right directory
cd "$(dirname "$0")"

# Create a deployment directory if it doesn't exist
DEPLOY_DIR="deploy-backend"
rm -rf $DEPLOY_DIR
mkdir -p $DEPLOY_DIR

# Copy backend files to deployment directory
echo -e "${BLUE}Copying backend files...${NC}"
cp -r gemini-backend/* $DEPLOY_DIR/
cp requirements.txt $DEPLOY_DIR/ 2>/dev/null || echo -e "${BLUE}Creating requirements.txt...${NC}"

# If requirements.txt doesn't exist, create it
if [ ! -f "$DEPLOY_DIR/requirements.txt" ]; then
  cat > $DEPLOY_DIR/requirements.txt << EOF
flask==3.0.0
flask-cors==4.0.0
firebase-admin==6.2.0
google-generativeai==0.3.1
gunicorn==21.2.0
EOF
fi

# Create a Procfile for platforms like Heroku
echo -e "${BLUE}Creating Procfile for deployment...${NC}"
cat > $DEPLOY_DIR/Procfile << EOF
web: gunicorn app:app
EOF

# Create a runtime.txt file for Python version
echo -e "${BLUE}Setting Python version...${NC}"
cat > $DEPLOY_DIR/runtime.txt << EOF
python-3.10.7
EOF

# Create an .env file example for the deployment
echo -e "${BLUE}Creating example .env file...${NC}"
cat > $DEPLOY_DIR/.env.example << EOF
FLASK_ENV=production
PORT=5001
GEMINI_API_KEY=your_gemini_api_key
FIREBASE_SERVICE_ACCOUNT=your_firebase_service_account_json_base64
EOF

echo -e "${GREEN}Deployment package prepared in $DEPLOY_DIR${NC}"
echo -e "${GREEN}Now you can deploy this directory to your hosting provider${NC}"
echo -e "${BLUE}For example with Heroku:${NC}"
echo -e "  cd $DEPLOY_DIR"
echo -e "  git init"
echo -e "  git add ."
echo -e "  git commit -m \"Deploy backend\""
echo -e "  heroku create"
echo -e "  heroku config:set FLASK_ENV=production"
echo -e "  heroku config:set GEMINI_API_KEY=your_gemini_api_key"
echo -e "  heroku config:set FIREBASE_SERVICE_ACCOUNT=your_firebase_service_account_json_base64"
echo -e "  git push heroku main"

chmod +x deploy-backend.sh 