# Gemini Alert App - Implementation Guide

## Overview
This guide documents the implementation of location sharing, nearest user querying, SOS alerting, map integration, and privacy/security features in the Gemini Alert App.

## Implemented Features

### 1. User Location Sharing

#### Frontend Implementation
- **Location Service** (`locationService.js`):
  - `startLocationTracking()`: Initiates GPS tracking with privacy checks
  - `updateUserLocation()`: Sends location updates to backend and Firebase
  - `getCurrentLocation()`: Gets one-time location with fallback to default
  - Respects privacy settings for location sharing intervals

#### Backend Implementation
- **Location Endpoint** (`/api/location`):
  - Accepts POST requests with latitude/longitude
  - Validates user authentication
  - Returns success with timestamp

#### Key Features:
- Automatic location updates based on user-defined intervals
- Fallback to default location (San Francisco) when GPS unavailable
- Privacy-aware tracking that stops when disabled

### 2. Nearest User Querying

#### Frontend Implementation
- **Location Service**:
  - `getNearestUsers()`: Fetches nearest users from backend API
  - `findNearbyUsers()`: Legacy Firebase implementation (fallback)
  - Haversine formula for distance calculations

#### Backend Implementation
- **Nearest Users Endpoint** (`/api/nearest-users`):
  - Calculates distances using Haversine formula
  - Returns top 4 nearest users with distances
  - Mock data for development/testing

#### Key Features:
- Real-time distance calculations
- Configurable search radius
- Privacy-aware (only shows users who opt-in)

### 3. SOS Emergency Alerting

#### Frontend Implementation
- **Alert Service** (`alertService.js`):
  - `sendEmergencyAlert()`: Sends SOS with location and message
  - Backend-first approach with Firebase fallback
  - Support for different emergency types

#### Backend Implementation
- **SOS Endpoint** (`/api/send-sos`):
  - Validates location and message
  - Identifies nearest users
  - Returns alert ID and recipient count

#### Key Features:
- Multiple emergency types (General, Medical, Safety, Harassment)
- Automatic location inclusion
- Real-time notification to nearby users

### 4. Google Maps Integration

#### Map Service (`mapService.js`):
- **Map Initialization**:
  - Uses Google Maps JavaScript API
  - Advanced marker support with fallback
  - Responsive map controls

- **User Display**:
  - Shows current user with blue marker
  - Displays nearby users with green markers
  - Emergency alerts shown with red markers

- **Features**:
  - Search radius visualization
  - Click-to-view user/alert details
  - Real-time position updates

### 5. Privacy & Security

#### Privacy Settings Component (`PrivacySettings.vue`):
- **Location Controls**:
  - Enable/disable location sharing
  - Visibility to nearby users toggle
  - Emergency override option

- **Update Frequency**:
  - Configurable intervals (10s to 5min)
  - Reduces battery usage

- **Permission Management**:
  - Browser permission status display
  - One-click permission request

#### Security Features:
- User consent required for location access
- Opt-in/opt-out at any time
- Local storage for privacy preferences
- No permanent location history storage
- Encrypted data transmission

## API Endpoints

### Backend Endpoints:
1. `POST /api/location` - Update user location
2. `POST /api/nearest-users` - Get nearest users
3. `POST /api/send-sos` - Send emergency alert

### Request/Response Examples:

#### Update Location:
```json
// Request
POST /api/location
{
  "userId": "user123",
  "latitude": 37.7749,
  "longitude": -122.4194
}

// Response
{
  "status": "success",
  "userId": "user123",
  "location": {
    "latitude": 37.7749,
    "longitude": -122.4194
  },
  "timestamp": 1703001234567
}
```

#### Get Nearest Users:
```json
// Request
POST /api/nearest-users
{
  "userId": "user123",
  "latitude": 37.7749,
  "longitude": -122.4194
}

// Response
{
  "nearest_users": [
    {
      "userId": "user456",
      "displayName": "John Doe",
      "latitude": 37.7849,
      "longitude": -122.4094,
      "distance_km": 1.2
    }
  ]
}
```

## Privacy Settings Storage

Privacy preferences are stored in localStorage:
- `locationSharingEnabled`: Boolean
- `shareWithNearbyUsers`: Boolean
- `allowEmergencyTracking`: Boolean
- `locationUpdateInterval`: Number (milliseconds)

## Development vs Production

### Development Mode:
- Mock data available when location services fail
- Demo mode for testing without real GPS
- Simplified authentication

### Production Mode:
- Full Firebase integration
- Real-time location updates
- Push notifications for alerts

## Security Considerations

1. **Data Protection**:
   - HTTPS required for geolocation API
   - Bearer token authentication
   - CORS properly configured

2. **User Privacy**:
   - Explicit consent for location sharing
   - Granular privacy controls
   - No tracking without permission

3. **Emergency Override**:
   - Location shared during SOS even if normally disabled
   - User informed of this behavior
   - Can be disabled in settings

## Future Enhancements

1. **Push Notifications**:
   - Firebase Cloud Messaging integration
   - Background alert notifications
   - Alert sound customization

2. **Advanced Features**:
   - Geofencing for automatic alerts
   - Location history (opt-in)
   - Group safety features

3. **Performance**:
   - Location caching
   - Batch location updates
   - Offline mode support 