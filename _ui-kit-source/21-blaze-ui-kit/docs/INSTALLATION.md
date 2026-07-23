
# Installation

## 1. Copy folders
Copy `assets/` and the required `src/` folders into your existing Expo project. Do not replace your game engine, navigation, stores, or backend code.

## 2. Install Expo-compatible dependencies

```bash
npx expo install expo-linear-gradient react-native-svg react-native-reanimated react-native-safe-area-context expo-haptics expo-av expo-font
npm install @expo-google-fonts/anton @expo-google-fonts/roboto-condensed
```

The included fire-ring uses a frame-sequence fallback, so Lottie is optional.

## 3. Load fonts
Use `useFonts` from the installed Google-font packages. Keep a loading/splash fallback and the system font names from `src/theme/typography.ts`.

## 4. Reanimated
Follow the requirements of your installed Expo SDK. Current Expo-managed projects usually configure Reanimated automatically; inspect your existing Babel/Metro configuration before changing it.

## 5. SVG
The runtime components use inline `react-native-svg`, so no SVG transformer is required. The standalone `.svg` files are editable source assets for design tools and optional custom pipelines.

## 6. Asset preloading
Preload the logo, active backgrounds, and current arena before navigating into gameplay. Lazy-load the stopwatch and countdown sequence.

## 7. Preview screen
Temporarily register `BlazeUIKitPreviewScreen` in development/preview navigation only. Never expose it in production.

## 8. Audio
The included WAV files are original synthesized placeholders. Replace them through the paths defined in `soundManifest.ts` while preserving file names or updating the manifest.

## 9. Platform notes
- iOS/Android: haptics work through `expo-haptics`.
- Web: haptics fail silently; shadows use web-compatible `boxShadow` through tokens.
- Large frame-sequence animation: lazy-load and stop intervals on unmount.
