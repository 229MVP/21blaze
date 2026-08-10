# Version 1.5 Native Permission Audit

## Audio / microphone

**Finding:** The app plays short sound effects via `expo-audio` (`blazeAudio.ts`) with `allowsRecording: false`. No recording APIs are used.

**Previous state:** `app.json` listed `RECORD_AUDIO`, foreground service, and media playback permissions; `expo-audio` defaults requested microphone and background playback.

**Resolution:**

- `expo-audio` plugin configured in `app.config.js`:
  - `microphonePermission: false`
  - `recordAudioAndroid: false`
  - `enableBackgroundPlayback: false`
  - `enableBackgroundRecording: false`
- Removed explicit `android.permissions` from `app.json` (plugin adds `MODIFY_AUDIO_SETTINGS` only).

**Resolved Android permissions (public config):** `android.permission.MODIFY_AUDIO_SETTINGS` only.

## Foreground services

Not required — gameplay audio does not run in background (`shouldPlayInBackground: false`).

## EAS project binding

| Field | Value |
|-------|--------|
| `owner` | `229mvp` |
| `projectId` | `0c5db163-a4c0-4a17-9a8a-e12eed3bf511` |
| Updates URL | `https://u.expo.dev/0c5db163-a4c0-4a17-9a8a-e12eed3bf511` |

`eas project:info` could not be run in the RC agent environment (no EAS login). Verify interactively before store upload.

## Bundle identifiers

- iOS: `com.twentyoneblaze.app`
- Android: `com.twentyoneblaze.app`

## Build lineage

| Platform | Value |
|----------|-------|
| Marketing version | 1.5.0 |
| iOS buildNumber | 909 |
| Android versionCode | 902 |
| Kotlin | 2.3.0 (`withAndroidKotlinGradle.js`) |

## Store submission metadata

Present in `eas.json` submit block: `ascAppId` 6797273226, `appleTeamId` 9C5LBWL2HS.

## Status

- [x] Microphone permission removed
- [x] Foreground service permissions removed
- [ ] EAS project verified via authenticated `eas project:info`
