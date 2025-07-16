# Gemini Alert App - Final Deployment Checklist

## ⚠️ Security Issues to Address

### Exposed API Keys
The following API keys need to be moved to environment variables before public deployment:

1. **Google Maps API Key** (in `mapService.js`) - Now using `VUE_APP_GOOGLE_MAPS_API_KEY`
2. **Firebase Config in messaging worker** (`public/firebase-messaging-sw.js`) - Needs environment injection
3. **Google Maps in index.html** - Should use dynamic injection

**Action Required:**
- Regenerate all exposed API keys in Google Cloud Console
- Set proper domain restrictions on API keys
- Use environment variables for all sensitive data

## 🔒 Database Security

### Current Rules Status
- **Firestore**: Currently allows read/write for all authenticated users
- **Realtime Database**: Currently allows read/write for all authenticated users

These permissive rules are good for development but **NOT SUITABLE FOR PRODUCTION**.

### For Production:
1. Implement proper user-specific write permissions
2. Add data validation rules
3. Implement rate limiting
4. Monitor for abuse

## ✅ Pre-Deployment Checklist

### Backend
- [ ] Set `FLASK_ENV=production` in `.env`
- [ ] Set `FLASK_DEBUG=0` in `.env`
- [ ] Ensure `GEMINI_API_KEY` is set
- [ ] Ensure `FIREBASE_DATABASE_URL` is set
- [ ] Place `serviceAccountKey.json` securely (never commit to git)

### Frontend
- [ ] Set `VUE_APP_API_BASE_URL` to production backend URL
- [ ] Set all Firebase config variables
- [ ] Set `VUE_APP_GOOGLE_MAPS_API_KEY`
- [ ] Build for production: `npm run build`

### Firebase
- [ ] Deploy security rules: `npx firebase deploy --only database,firestore:rules`
- [ ] Enable only required authentication methods
- [ ] Set up budget alerts in Google Cloud Console
- [ ] Configure Firebase App Check for additional security

## 🚀 Deployment Steps

### Option 1: Vercel (Recommended)

#### Deploy Backend
```bash
cd gemini-backend
vercel --prod
```

#### Deploy Frontend
```bash
cd gemini-frontend
vercel dist --prod
```

### Option 2: Firebase Hosting (Frontend Only)
```bash
cd gemini-frontend
npm run build
npx firebase deploy --only hosting
```

## 🧪 Post-Deployment Testing

1. **Authentication Flow**
   - [ ] User registration works
   - [ ] User login works
   - [ ] Logout works properly

2. **Core Features**
   - [ ] Location tracking activates
   - [ ] Users appear on map
   - [ ] Emergency alerts can be sent
   - [ ] Alerts appear for nearby users
   - [ ] Response system works
   - [ ] Gemini AI responds appropriately

3. **Cross-Browser Testing**
   - [ ] Chrome
   - [ ] Firefox
   - [ ] Safari
   - [ ] Mobile browsers

## 📊 Monitoring

- Set up Google Analytics
- Configure Firebase Performance Monitoring
- Set up error tracking (e.g., Sentry)
- Monitor API usage and costs

## 🔄 Updates After Deployment

1. **Regenerate API Keys**: Since some keys were exposed in the code
2. **Update CORS**: Set proper domain restrictions in backend
3. **SSL Certificates**: Ensure HTTPS is enforced
4. **Domain Setup**: Configure custom domains if needed

## 📝 Final Notes

The app is now ready for deployment with:
- ✅ All mock data removed
- ✅ Proper environment variable setup
- ✅ Clean production build
- ✅ Security rules configured (though permissive)
- ✅ "People Who Can Help" section removed
- ✅ "Active Alerts Nearby" section enhanced

Remember to tighten security rules based on your specific requirements before going fully public. 