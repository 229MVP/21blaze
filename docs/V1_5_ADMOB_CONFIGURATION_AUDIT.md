# Version 1.5 AdMob Configuration Audit

## Problem (release-freeze)

`app.json` embedded Google **sample** AdMob application IDs while the production EAS profile set `EXPO_PUBLIC_ADMOB_USE_TEST_ADS=false` and enabled rewarded/interstitial ads — an invalid combination for store release.

## Resolution

`app.config.js` + `src/config/expoAdMobNativeConfig.js` resolve native and JS ad configuration at build time.

| Build context | Native app IDs | JS rewarded/interstitial |
|---------------|----------------|--------------------------|
| development / preview / testflight / live-pvp-qa | Google test IDs | Enabled with `EXPO_PUBLIC_ADMOB_USE_TEST_ADS=true` |
| production + verified `EXPO_PUBLIC_ADMOB_*_APP_ID` env | Real IDs from EAS | Enabled only if IDs valid |
| production without verified IDs | Test IDs (SDK init) | **Disabled** at build (`productionMonetizationAdsDisabled`) |

Production EAS profile sets `EXPO_PUBLIC_ENABLE_REWARDED_ADS=false` and `EXPO_PUBLIC_ENABLE_INTERSTITIAL_ADS=false` until real AdMob app IDs are supplied via EAS environment variables.

## EAS variables (production)

Set on the production environment (not committed):

- `EXPO_PUBLIC_ADMOB_IOS_APP_ID`
- `EXPO_PUBLIC_ADMOB_ANDROID_APP_ID`
- `EXPO_PUBLIC_ADMOB_REWARDED_IOS_ID` / `EXPO_PUBLIC_ADMOB_REWARDED_ANDROID_ID`
- `EXPO_PUBLIC_ADMOB_INTERSTITIAL_IOS_ID` / `EXPO_PUBLIC_ADMOB_INTERSTITIAL_ANDROID_ID`

Then re-enable rewarded/interstitial flags in `eas.json` production profile after human review.

## Automated guard

`npm run test:admob-config` — fails if production profile would combine sample native IDs with live-ad JS mode.

## Status

- [x] Environment-specific native config implemented
- [x] Production sample+live combination blocked
- [ ] Verified production AdMob IDs configured in EAS (human / release manager)
