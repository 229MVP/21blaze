# Version 1.5 Native Config Reconciliation

Compared against `origin/release/1.2.0-final` and `origin/hotfix/1.2-ios-black-screen` without wholesale merge.

## Applied

| Item | Before | After |
|------|--------|-------|
| App version | 1.4.0 | **1.5.0** |
| `package.json` version | 1.4.0 | **1.5.0** |
| iOS `buildNumber` | 904 (dup SKAdNetwork) | **909**, deduped |
| Android `versionCode` | 901 | **902** |
| `extra.rcVersion` | 0.9.0 | **1.5.0** |
| Kotlin plugin | missing | `./plugins/withAndroidKotlinGradle.js` |
| `kotlinVersion` | missing | **2.3.0** in expo-build-properties |
| Android permissions | duplicated | deduped |
| Expo Updates URL | preserved | unchanged |
| `runtimeVersion` policy | `appVersion` | preserved |
| `testflight-rescue` profile | missing | restored |
| Submit metadata (`ascAppId`, `appleTeamId`) | missing | restored |
| `live-pvp-qa` profile | missing | added |

## Build number lineage

| Release line | iOS build | Notes |
|--------------|-----------|-------|
| 1.2.0-final | 908 | Kotlin 2.3.0 baseline |
| 1.5 phase branch | 904 (regression) | reconciled to 909 |
| 1.5 release freeze | **909** | minimum for RC |

## Not merged wholesale

- 1.2 feature-flag values for rewards/visuals on testflight (v1.5 keeps flags off until product sign-off).
- `src/startup/v1_2StartupHotfixSelfTest.ts` not present on v1.5 tree; startup safeguards in App remain; rescue profile restored.
