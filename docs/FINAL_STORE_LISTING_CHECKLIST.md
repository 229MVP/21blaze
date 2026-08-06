# Version 1.2.0 Store Listing Checklist

## App identity

- [ ] Name: 21 Blaze
- [ ] Version: 1.2.0
- [ ] Bundle ID: `com.twentyoneblaze.app` (iOS and Android)
- [ ] EAS project linked to owner `229mvp`

## Screenshots & description

- [ ] Screenshots show Solo Play, lanes, countdown, Results — not hidden/deferred features
- [ ] Description lists only shipping features (see `FINAL_RELEASE_FEATURE_MATRIX.md`)
- [ ] No mention of Daily Challenge, ranked, live duel, or IAP until shipped

## iOS App Store Connect

- [ ] buildNumber autoIncrement via EAS `testflight` / `production`
- [ ] Encryption: `ITSAppUsesNonExemptEncryption: false` in Info.plist
- [ ] Privacy nutrition labels match `FINAL_PRIVACY_DATA_MAP.md`
- [ ] TestFlight internal QA complete (`FINAL_IOS_QA_CHECKLIST.md`)

## Google Play

- [ ] versionCode autoIncrement via EAS
- [ ] Data safety form matches privacy map
- [ ] Internal testing track QA (`FINAL_ANDROID_QA_CHECKLIST.md`)

## Legal

- [ ] Privacy policy URL live
- [ ] Support / feedback route (`Feedback` screen) functional

## Pre-submit gates

- [ ] `EXPO_PUBLIC_ENABLE_STORE_PURCHASES=false` on production profile
- [ ] No secrets in repo
- [ ] TypeScript + exports + self-tests pass
