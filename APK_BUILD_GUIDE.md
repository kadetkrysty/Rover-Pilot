# RoverOS APK Build Guide

## Prerequisites
- Node.js 22+ and npm
- Android SDK Platform 36 and Build Tools 36.0.0
- Java Development Kit (JDK) 21
- Capacitor CLI

## Build Steps

### 1. Install Dependencies
```bash
npm ci
```

### 2. Build Web Assets
```bash
npm run build
```

### 3. Sync Android
```bash
npx cap sync android
```

### 4. Build a debug APK
```bash
cd android && ./gradlew assembleDebug
```

### 5. Signed APK (for production)
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
APK file: `android/app/build/outputs/apk/debug/app-debug.apk`

GitHub Actions runs the same build on pushes, pull requests, or manual dispatch.
Download the `roveros-android-debug` artifact from the completed workflow run.

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
