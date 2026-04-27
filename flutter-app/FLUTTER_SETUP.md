# Flutter App Setup Guide

## Prerequisites
Install Flutter SDK: https://docs.flutter.dev/get-started/install

Verify installation:
```bash
flutter doctor
```

## Project Structure
```
flutter-app/
├── lib/
│   ├── main.dart                        # App entry point
│   ├── models/
│   │   ├── user_model.dart              # User data model
│   │   └── driver_model.dart            # Driver data model
│   ├── providers/
│   │   ├── auth_provider.dart           # Auth state management
│   │   ├── location_provider.dart       # GPS tracking
│   │   └── driver_provider.dart         # Nearby drivers state
│   ├── screens/
│   │   ├── splash_screen.dart           # Splash screen
│   │   ├── role_selection_screen.dart   # Driver / Passenger choice
│   │   ├── auth/
│   │   │   ├── login_screen.dart        # Login
│   │   │   └── signup_screen.dart       # Registration
│   │   ├── driver/
│   │   │   └── driver_dashboard.dart    # Driver home
│   │   └── passenger/
│   │       ├── passenger_map_screen.dart  # Map with drivers
│   │       └── nearby_drivers_screen.dart # Driver list
│   ├── services/
│   │   ├── api_service.dart             # HTTP API calls
│   │   └── socket_service.dart          # WebSocket
│   └── utils/
│       ├── app_theme.dart               # Colors & theme
│       └── constants.dart               # API URLs
├── android/app/src/main/AndroidManifest.xml
├── ios/Runner/Info.plist
└── pubspec.yaml
```

## Step 1: Start the Backend
```bash
cd simple-app
node server.js
```
Backend runs at http://localhost:5000

## Step 2: Configure API URL

Edit `lib/utils/constants.dart`:

```dart
// Android Emulator
static const String baseUrl = 'http://10.0.2.2:5000';

// iOS Simulator
static const String baseUrl = 'http://localhost:5000';

// Real Device (use your PC's IP)
static const String baseUrl = 'http://192.168.1.X:5000';
```

Find your IP: Run `ipconfig` on Windows

## Step 3: Install Dependencies
```bash
cd flutter-app
flutter pub get
```

## Step 4: Run the App
```bash
# Android emulator
flutter run

# Specific device
flutter devices
flutter run -d <device-id>

# Release build
flutter build apk --release
```

## Demo Credentials

The backend seeds 4 demo drivers automatically.
Check the server console for their Driver IDs.

### Register New Accounts
- Passenger: Name + Phone + Password
- Driver: Name + Phone + Vehicle Type + Vehicle Number + Password
  - After registration, note your Driver ID from the response

## Features

### Driver App
1. Login with Driver ID + Password
2. Tap "Go Available" to start sharing location
3. GPS updates sent every 5 seconds
4. Dashboard shows speed, location, status

### Passenger App
1. Login with Phone + Password
2. Map shows nearby drivers in real-time
3. Filter by Auto / Bus / Taxi
4. Tap driver marker to see details (distance, ETA, speed)
5. List view shows all nearby drivers

## Troubleshooting

**Connection refused**: Make sure backend is running on port 5000

**Location not working**: 
- Android: Grant location permission in app settings
- iOS: Allow location in Settings > Privacy > Location

**Map not loading**: Check internet connection (uses OpenStreetMap tiles)

**Emulator location**: 
- Android Studio: Extended Controls > Location > Set coordinates
- Use: Lat 30.7333, Lng 76.7794 (Chandigarh)
