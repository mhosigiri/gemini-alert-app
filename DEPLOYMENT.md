# Deployment Instructions

This application consists of two parts: a Vue.js frontend and a Flask backend, both deployed on Vercel.

## Prerequisites

1. Vercel account
2. Firebase project with credentials
3. Google Maps API key
4. Gemini API key (for AI features)

## Environment Variables

### Backend (Vercel)

The following environment variables MUST be set in your Vercel project settings for the backend:

```bash
# Gemini AI Configuration
GEMINI_API_KEY=your_gemini_api_key_here

# Flask Configuration
FLASK_ENV=production

# Firebase Admin SDK (base64 encoded)
FIREBASE_ADMIN_CREDENTIALS=base64_encoded_service_account_json
```

**Important**: In Vercel, environment variables are NOT automatically loaded from `.env` files in production. You must add them through the Vercel dashboard:

1. Go to your Vercel project settings
2. Navigate to "Environment Variables"
3. Add each variable with its value
4. Make sure to select "Production" environment

### Frontend (Vercel)

```bash
VUE_APP_API_BASE_URL=https://your-backend-url.com
VUE_APP_FIREBASE_CONFIG_API_KEY=your_firebase_api_key
VUE_APP_FIREBASE_CONFIG_AUTH_DOMAIN=your-project.firebaseapp.com
VUE_APP_FIREBASE_CONFIG_PROJECT_ID=your-project-id
VUE_APP_FIREBASE_CONFIG_STORAGE_BUCKET=your-project.appspot.com
VUE_APP_FIREBASE_CONFIG_MESSAGING_SENDER_ID=your_sender_id
VUE_APP_FIREBASE_CONFIG_APP_ID=your_app_id
VUE_APP_FIREBASE_CONFIG_MEASUREMENT_ID=your_measurement_id
VUE_APP_FIREBASE_CONFIG_DATABASE_URL=https://your-project.firebaseio.com
VUE_APP_FIREBASE_VAPID_KEY=your_vapid_key
```

## Firebase Security Rules

### Development/Testing Rules (Permissive)

The project includes permissive rules that allow all authenticated users to read and write data. These are suitable for development and testing:

#### Deploy Permissive Rules
```bash
# For Realtime Database
firebase deploy --only database

# For Firestore
firebase deploy --only firestore:rules
```

### Production Rules (Restrictive)

For production, you should use more restrictive rules. Examples are provided in:
- `firebase-rules-detailed.json` - Structured Realtime Database rules
- `firestore-rules-detailed.rules` - Structured Firestore rules

These files show how to implement more granular permissions while keeping the app functional.

## Important Security Note

The current rules (`firebase-rules.json` and `firestore.rules`) are very permissive and allow any authenticated user to read and write all data. This is intentional to ensure all features work during development and testing. 

**For production deployment, you should:**
1. Review and tighten the security rules based on your specific requirements
2. Implement proper data validation
3. Add rate limiting
4. Monitor for abuse

## Deployment Options

### Option 1: Vercel (Recommended)

#### Backend Deployment
1. Install Vercel CLI: `npm i -g vercel`
2. Navigate to `gemini-backend/`
3. Run `vercel`
4. Follow prompts to deploy
5. Set environment variables in Vercel dashboard

#### Frontend Deployment
1. Navigate to `gemini-frontend/`
2. Build the app: `npm run build`
3. Deploy: `vercel dist`
4. Set environment variables in Vercel dashboard

### Option 2: Heroku

#### Backend
1. Create `Procfile` in `gemini-backend/`:
   ```
   web: gunicorn app:app
   ```
2. Deploy using Heroku CLI:
   ```bash
   heroku create your-app-backend
   heroku config:set GEMINI_API_KEY=your_key
   git push heroku main
   ```

#### Frontend
1. Use Heroku buildpack for static sites
2. Create `static.json`:
   ```json
   {
     "root": "dist/",
     "clean_urls": true,
     "routes": {
       "/**": "index.html"
     }
   }
   ```

### Option 3: Google Cloud Platform

1. Create `app.yaml` for App Engine
2. Deploy using:
   ```bash
   gcloud app deploy
   ```

## Post-Deployment Checklist

- [ ] Test user registration and login
- [ ] Verify location tracking works
- [ ] Test sending emergency alerts
- [ ] Confirm nearby users are visible
- [ ] Test alert responses
- [ ] Verify Gemini AI responses
- [ ] Check map functionality
- [ ] Test on multiple devices/browsers
- [ ] Monitor Firebase usage and costs
- [ ] Set up error monitoring (e.g., Sentry)
- [ ] Configure SSL certificates
- [ ] Set up domain names
- [ ] Enable CORS for production domains

## Production Security

1. **API Keys**: Never commit API keys to version control
2. **HTTPS**: Always use HTTPS in production
3. **Rate Limiting**: Implement rate limiting on backend endpoints
4. **Authentication**: Ensure all sensitive endpoints require authentication
5. **Data Privacy**: Follow GDPR/privacy regulations for location data

## Monitoring

1. **Firebase Console**: Monitor database usage and performance
2. **Google Cloud Console**: Track API usage and costs
3. **Application Logs**: Set up proper logging for debugging
4. **User Analytics**: Use Firebase Analytics to track user behavior

## Backup and Recovery

1. Enable automatic Firestore backups
2. Export Realtime Database regularly
3. Keep copies of security rules
4. Document all environment variables 