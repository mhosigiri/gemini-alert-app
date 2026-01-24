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

Create `.env` files manually before running the project:

```bash
# Backend (.env)
FLASK_ENV=development
PORT=5001
GROQ_API_KEY=your-groq-key
# Optional overrides
# GROQ_MODEL=gemma2-9b-it
# GROQ_TEMPERATURE=0.4
# GROQ_TOP_P=0.9
# GROQ_MAX_TOKENS=1024
FIREBASE_SERVICE_ACCOUNT_KEY_PATH=/absolute/path/to/serviceAccountKey.json
# Optional: inline JSON alternative
# FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}
# Optional: comma-separated origins for CORS
# ALLOWED_ORIGINS=http://localhost:8080,https://your-domain.com

# Frontend (.env.local)
VUE_APP_API_BASE_URL=http://localhost:5001
VUE_APP_FIREBASE_API_KEY=...
VUE_APP_FIREBASE_AUTH_DOMAIN=...
VUE_APP_FIREBASE_PROJECT_ID=...
VUE_APP_FIREBASE_STORAGE_BUCKET=...
VUE_APP_FIREBASE_MESSAGING_SENDER_ID=...
VUE_APP_FIREBASE_APP_ID=...
VUE_APP_FIREBASE_MEASUREMENT_ID=...
VUE_APP_GOOGLE_MAPS_API_KEY=...
VUE_APP_GOOGLE_MAPS_MAP_ID=
```

> ⚠️ **Secrets**: Never commit `.env*` files or `serviceAccountKey.json`. Load secrets from environment variables in production.

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

> The frontend proxies AI chat calls to the backend (`VUE_APP_API_BASE_URL`). Ensure both services are running for full functionality.

---

## Production Build & Deployment

### Backend (Flask)

- Recommended command: `gunicorn app:app --bind 0.0.0.0:5001 --workers 2`
- Set environment variables in your hosting provider (`GROQ_API_KEY`, `FIREBASE_SERVICE_ACCOUNT_KEY*`, `ALLOWED_ORIGINS`, etc.)
- Sample Vercel configuration is located at `vercel.json` in the project root

### Frontend (Vue)

```bash
cd frontend
npm run build:prod
# Output emitted to frontend/dist/
```

- Deploy `dist/` to static hosting (Vercel, Firebase Hosting, Netlify, S3, etc.)
- Configure the same environment variables in your hosting dashboard (prefixed with `VUE_APP_`)
- Ensure the Google Maps API key allows the deployed domain(s)

### Required Production Secrets

| Variable | Description |
|----------|-------------|
| `GROQ_API_KEY` | Groq API key |
| `FIREBASE_SERVICE_ACCOUNT_KEY*` | Admin SDK credentials for backend |
| `VUE_APP_FIREBASE_*` | Web SDK config |
| `VUE_APP_GOOGLE_MAPS_API_KEY` | Must include production domains in HTTP referrers |
| `VUE_APP_API_BASE_URL` | HTTPS endpoint of the backend |

---

## Pre-Deployment Checklist

- [ ] Remove local virtual environments (`rm -rf venv .venv-backend`) before committing
- [ ] Ensure `serviceAccountKey.json` is excluded from version control
- [ ] Confirm `.env` values exist in your hosting provider
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

---

## Contributing

Bug reports, feature requests, and pull requests are welcome. Please open an issue first to discuss major changes.

---

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
