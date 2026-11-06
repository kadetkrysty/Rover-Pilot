# RoverOS app icon

The new rover artwork is rasterized from a single generated 1024px image for
consistent branding across the app:

- **Web/PWA:** `client/public/favicon.png`, `apple-touch-icon.png`, and three
  PNG icons in `client/public/icons/`. The PWA icons are precached for offline
  use; the maskable image keeps its artwork inside the launcher safe area.
- **Windows:** `desktop/assets/roveros.ico`, with 16, 32, 48, 64, 128 and 256px
  versions. Electron uses it for the app window; the installer uses it too.
- **Android:** density-specific legacy launcher icons and an adaptive launcher
  icon under `android/app/src/main/res`.

The artwork uses a dark-navy ground, cyan/turquoise lighting and rover details,
white metal and a small red accent to match RoverOS. Each platform points to its
own optimized resolution so launcher icons stay crisp and package size remains
reasonable.
