# RoverOS APK Build Guide

## Prerequisites
- Node.js 18+ and npm
- Android Studio or Android SDK (API 31+)
- Java Development Kit (JDK) 11+
- Capacitor CLI

## Build Steps

### 1. Install Dependencies
```bash
npm install
npm install --save-dev @capacitor/cli @capacitor/android
```

### 2. Build Web Assets
```bash
npm run build
```

### 3. Initialize Capacitor (first time only)
```bash
npx cap init "RoverOS" "com.roverostech.rover"
```

### 4. Add Android Platform
```bash
npx cap add android
```

### 5. Sync Project
```bash
npx cap sync
```

### 6. Build APK
```bash
cd android
./gradlew assembleRelease
```

### 7. Signed APK (for production)
- Generate signing key:
  ```bash
  keytool -genkey -v -keystore rover-release.jks -keyalg RSA -keysize 2048 -validity 10000 -alias rover
  ```

- Update `android/app/build.gradle` with signing config
- Build signed APK:
  ```bash
  ./gradlew assembleRelease
  ```

## Output
APK file: `android/app/build/outputs/apk/release/app-release.apk`

## Permissions Included
- ✓ Internet access
- ✓ GPS/Location (fine & coarse)
- ✓ Camera access
- ✓ Bluetooth (PS4 controller)
- ✓ Storage (logs & recordings)
- ✓ Audio recording

## Device Requirements
- Android 12+ (API 31+)
- 2GB RAM minimum
- Bluetooth 4.2+ for PS4 controller
- GPS module (optional)

## Troubleshooting

### Gradle Build Issues
```bash
cd android
./gradlew clean
./gradlew build --stacktrace
```

### Permission Issues
- Run app, go to Settings → Permissions
- Grant Camera, Location, Bluetooth permissions

### Capacitor Sync Issues
```bash
npx cap sync
npx cap open android  # Opens Android Studio
```

## Environment Variables
Set before building:
```bash
export GOOGLE_MAPS_API_KEY="your-api-key"
export ROVER_API_URL="http://your-rover-ip:8080"
```

## Next Steps
1. Test on Android device/emulator
2. Verify all sensors respond
3. Test PS4 controller pairing
4. Validate GPS + camera functionality
5. Publish to Google Play Store (requires signing)

See `firmware/README.md` for hardware setup instructions.
