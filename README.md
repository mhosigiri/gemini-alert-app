# Gemini Alert

Gemini Alert is a real-time emergency assistance platform. Users can broadcast distress alerts, see nearby helpers on a live map, and receive guidance from a Groq-hosted AI assistant. The project is split into a Vue 3 web client and a Flask backend that proxies Groq API calls and persists data in Firebase services.

---

## Architecture Overview

| Layer     | Technology                                             | Responsibilities |
|-----------|---------------------------------------------------------|------------------|
| Frontend  | Vue 3, Firebase Web SDK, Google Maps JavaScript API     | Authentication, live map, SOS dashboard, AI chat UI |
| Backend   | Flask, Firebase Admin SDK, Groq SDK                    | REST/SSE endpoints, Groq proxy, Firebase writes |
| Data      | Firebase Authentication & Firestore                     | User identity, alerts, chat, and location history |

---

## Requirements

- Python 3.14 (or >= 3.10 compatible with `groq`)
- Node.js 18+ (tested with Node 20/24)
- Firebase project with Authentication and Firestore enabled
- Google Maps JavaScript API key (with proper HTTP referrer restrictions)
- Groq API key

---

## Environment Configuration

Copy the example files first, then fill in real values:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
```

Backend values:

```bash
FLASK_ENV=development
PORT=5001
GROQ_API_KEY=your-groq-key
GROQ_MODEL=gemma2-9b-it
GROQ_TEMPERATURE=0.4
GROQ_TOP_P=0.9
GROQ_MAX_TOKENS=1024
GROQ_EMOTION_MODEL=gemma2-9b-it
GROQ_EMOTION_TEMPERATURE=0
GROQ_EMOTION_TOP_P=0.1
GROQ_EMOTION_MAX_TOKENS=256
MAX_DIRECT_MESSAGE_LENGTH=4000
FIREBASE_SERVICE_ACCOUNT_KEY_PATH=/absolute/path/to/firebase-admin.json
FIREBASE_SERVICE_ACCOUNT_KEY=
ALLOWED_ORIGINS=https://gemini-alert-app.vercel.app/
```

Frontend values:

```bash
VUE_APP_API_BASE_URL=http://localhost:5001
VUE_APP_FIREBASE_API_KEY=your-firebase-web-api-key
VUE_APP_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VUE_APP_FIREBASE_PROJECT_ID=your-project-id
VUE_APP_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VUE_APP_FIREBASE_MESSAGING_SENDER_ID=1234567890
VUE_APP_FIREBASE_APP_ID=1:1234567890:web:abcdef123456
VUE_APP_FIREBASE_MEASUREMENT_ID=
VUE_APP_GOOGLE_MAPS_API_KEY=your-google-maps-api-key
VUE_APP_GOOGLE_MAPS_MAP_ID=
```

`FIREBASE_SERVICE_ACCOUNT_KEY_PATH` should point to a JSON file stored outside the repo or in another untracked location. In Cloud Run, prefer `FIREBASE_SERVICE_ACCOUNT_KEY` via Secret Manager rather than shipping a credential file with the code. `ALLOWED_ORIGINS` accepts a comma-separated list of origins and trims trailing slashes; if you leave it empty, the backend will not allow cross-origin browser requests. Do not commit Firebase Admin credentials, `.env` files, or any Firebase messaging service worker with inline config.

---

## Local Development

### 1. Install dependencies

```bash
# Backend
cd backend
python -m venv ../venv
source ../venv/bin/activate   # Windows: ..\venv\Scripts\activate
pip install --upgrade pip
pip install -r requirements.txt

# Frontend
cd ../frontend
npm install
```

### 2. Run the application

```bash
# Terminal 1 - Backend
cd backend
source ../venv/bin/activate
python app.py
# Flask serves on http://localhost:5001

# Terminal 2 - Frontend
cd frontend
npm run dev
# Vue dev server runs on http://localhost:8080
```

The backend reads `backend/.env` and the frontend reads `frontend/.env.local`. If you copy the example files above and fill them in, the app should bootstrap without any committed secrets.

The frontend proxies AI chat calls to the backend (`VUE_APP_API_BASE_URL`). Ensure both services are running for full functionality.

---

## Production Build & Deployment

### Backend (Flask)

- Recommended command: `gunicorn app:app --bind 0.0.0.0:5001 --workers 2`
- Deploy the `backend/` directory to Google Cloud Run using the included [backend/Dockerfile](/Users/arniskc/Desktop/gemini-alert-app/backend/Dockerfile)
- Set environment variables in your hosting provider (`GROQ_API_KEY`, `FIREBASE_SERVICE_ACCOUNT_KEY*`, `ALLOWED_ORIGINS`, `PORT`, etc.)
- For Cloud Run, inject `FIREBASE_SERVICE_ACCOUNT_KEY` from Secret Manager instead of relying on a JSON file in the repository or container image
- Point `ALLOWED_ORIGINS` at your deployed frontend origins, for example `https://your-app.vercel.app,https://your-domain.com`

### Frontend (Vue)

```bash
cd frontend
npm run build:prod
# Output emitted to frontend/dist/
```

- Deploy `dist/` to static hosting (Vercel, Firebase Hosting, Netlify, S3, etc.)
- The checked-in [vercel.json](/Users/arniskc/Desktop/gemini-alert-app/vercel.json) is now frontend-only. Set the Vercel project to this repo root and provide the `VUE_APP_*` environment variables in Vercel.
- Configure the same environment variables in your hosting dashboard (prefixed with `VUE_APP_`)
- Set `VUE_APP_API_BASE_URL` to your deployed Google Cloud backend URL
- Ensure the Google Maps API key allows the deployed domain(s)

### Required Production Secrets

| Variable | Description |
|----------|-------------|
| `GROQ_API_KEY` | Groq API key |
| `FIREBASE_SERVICE_ACCOUNT_KEY*` | Admin SDK credentials for backend |
| `VUE_APP_FIREBASE_*` | Web SDK config |
| `VUE_APP_GOOGLE_MAPS_API_KEY` | Must include production domains in HTTP referrers |
| `VUE_APP_API_BASE_URL` | HTTPS endpoint of the backend |
| `GROQ_EMOTION_MODEL` | Optional override for message emotion analysis |
| `GROQ_EMOTION_TEMPERATURE` | Defaults to `0` for deterministic emotion scoring |
| `GROQ_EMOTION_TOP_P` | Defaults to `0.1` for deterministic emotion scoring |
| `GROQ_EMOTION_MAX_TOKENS` | Caps the emotion-analysis response size |
| `MAX_DIRECT_MESSAGE_LENGTH` | Maximum characters accepted per direct message |

---

## Pre-Deployment Checklist

- [ ] Remove local virtual environments (`rm -rf venv .venv-backend`) before committing
- [ ] Ensure `serviceAccountKey.json` and any Firebase Admin JSON are excluded from version control
- [ ] Ensure no Firebase messaging service worker with inline config is committed
- [ ] Copy `backend/.env.example` to `backend/.env`
- [ ] Copy `frontend/.env.example` to `frontend/.env.local`
- [ ] Confirm the copied `.env` values exist in your hosting provider
- [ ] Set `VUE_APP_API_BASE_URL` in Vercel to the deployed backend HTTPS URL
- [ ] Set `ALLOWED_ORIGINS` in Google Cloud to the Vercel frontend origin(s)
- [ ] Update Google Maps API key restrictions for localhost + production domains
- [ ] Verify Firebase security rules meet production requirements
- [ ] Verify Groq API quotas/billing

---

## Key Backend Endpoints

- `POST /ask` – Groq completion via REST
- `POST /ask-stream` – Groq streaming responses (Server-Sent Events)
- `GET /chats` – Fetch authenticated user chat history
- `POST /api/nearest-users` – Find nearby users using Firestore location snapshots
- `POST /api/send-sos` – Broadcast SOS alert to nearby helpers
- `POST /api/alerts/nearby` – Retrieve active alerts near the user
- `POST /api/alerts/<alertId>/respond` – Record assistance responses
- `POST /api/devices/register` – Register a push token for a user device
- `DELETE /api/devices/<token>` – Remove a push token
- `POST /api/conversations` – Create or fetch a direct conversation
- `GET /api/conversations` – List the authenticated user's conversations
- `GET /api/conversations/<conversationId>` – Fetch conversation metadata
- `GET /api/conversations/<conversationId>/messages` – Fetch conversation messages
- `POST /api/conversations/<conversationId>/messages` – Send a direct message
- `POST /api/emotion/analyze` – Return deterministic emotion analysis for a message

---

## Contributing

Bug reports, feature requests, and pull requests are welcome. Please open an issue first to discuss major changes.

---

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
