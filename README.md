# Gemini Alert

Gemini Alert is a real-time emergency assistance platform. Users can broadcast distress alerts, see nearby helpers on a live map, and receive guidance from a Gemini-powered assistant. The project is split into a Vue 3 web client and a Flask backend that proxies Gemini API calls and persists data in Firebase services.

---

## Architecture Overview

| Layer     | Technology                                             | Responsibilities |
|-----------|---------------------------------------------------------|------------------|
| Frontend  | Vue 3, Firebase Web SDK, Google Maps JavaScript API     | Authentication, live map, SOS dashboard, Gemini chat |
| Backend   | Flask, Firebase Admin SDK, Google Generative AI SDK     | REST/SSE endpoints, Gemini proxy, Firebase writes |
| Data      | Firebase Authentication, Firestore, Realtime Database   | User identity, alert storage, location streaming |

---

## Requirements

- Python 3.14 (or >= 3.10 compatible with `google-generativeai`)
- Node.js 18+ (tested with Node 20/24)
- Firebase project with Authentication, Firestore, and Realtime Database enabled
- Google Maps JavaScript API key (with proper HTTP referrer restrictions)
- Gemini API key with access to `models/gemini-2.5-flash`

---

## Environment Configuration

Templates are provided in `config/backend.env.example` and `config/frontend.env.example`.

```bash
# Backend
cp config/backend.env.example gemini-backend/.env

# Frontend
cp config/frontend.env.example gemini-frontend/.env.local
```

**Backend highlights**

- `GEMINI_API_KEY` – required for Gemini features
- `FIREBASE_SERVICE_ACCOUNT_KEY_PATH` **or** `FIREBASE_SERVICE_ACCOUNT_KEY` – Admin SDK credentials
- `FIREBASE_DATABASE_URL` – required for realtime location + alerts

**Frontend highlights**

- `VUE_APP_API_BASE_URL` – Backend origin (`http://localhost:5001` for dev)
- `VUE_APP_GOOGLE_MAPS_API_KEY` (+ optional `VUE_APP_GOOGLE_MAPS_MAP_ID`)
- `VUE_APP_FIREBASE_*` – values from Firebase project settings

> ⚠️ **Secrets**: Never commit `.env*` files or `serviceAccountKey.json`. Load secrets from environment variables in production.

---

## Local Development

### 1. Install dependencies

```bash
# Backend
cd gemini-backend
python -m venv ../.venv-backend
source ../.venv-backend/bin/activate   # Windows: ..\.venv-backend\Scripts\activate
pip install --upgrade pip
pip install -r requirements.txt

# Frontend
cd ../gemini-frontend
npm install
```

### 2. Run the backend

```bash
cd ../gemini-backend
source ../.venv-backend/bin/activate
python app.py
# Flask serves on http://localhost:5001
```

### 3. Run the frontend

```bash
cd ../gemini-frontend
npm run dev
# Vue dev server runs on http://localhost:8080
```

> The frontend proxies Gemini calls to the backend (`VUE_APP_API_BASE_URL`). Ensure both services are running for full functionality.

---

## Production Build & Deployment

### Backend (Flask)

- Recommended command: `gunicorn app:app --bind 0.0.0.0:5001 --workers 2`
- Set environment variables in your hosting provider (`GEMINI_API_KEY`, `FIREBASE_DATABASE_URL`, `FIREBASE_SERVICE_ACCOUNT_KEY*`, etc.)
- Sample Vercel configuration is located at `gemini-backend/vercel.json`

### Frontend (Vue)

```bash
cd gemini-frontend
npm run build:prod
# Output emitted to gemini-frontend/dist/
```

- Deploy `dist/` to static hosting (Vercel, Firebase Hosting, Netlify, S3, etc.)
- Configure the same environment variables in your hosting dashboard (prefixed with `VUE_APP_`)
- Ensure the Google Maps API key allows the deployed domain(s)

### Required Production Secrets

| Variable | Description |
|----------|-------------|
| `GEMINI_API_KEY` | Google Generative AI API key |
| `FIREBASE_SERVICE_ACCOUNT_KEY*` | Admin SDK credentials for backend |
| `FIREBASE_DATABASE_URL` | Realtime Database root URL |
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
- [ ] Review Gemini API quota and enable billing if needed

---

## Key Backend Endpoints

- `POST /ask` – Gemini completion via REST
- `POST /ask-stream` – Gemini streaming responses (Server-Sent Events)
- `GET /chats` – Fetch authenticated user chat history
- `POST /api/nearest-users` – Find nearby users from Realtime Database
- `POST /api/send-sos` – Broadcast SOS alert to nearby helpers

---

## Contributing

Bug reports, feature requests, and pull requests are welcome. Please open an issue first to discuss major changes.

---

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
