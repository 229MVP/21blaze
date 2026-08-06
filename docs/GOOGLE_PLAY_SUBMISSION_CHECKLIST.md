# Google Play Submission Checklist — 1.2.0

## App identity

- [ ] Name: **21 Blaze**
- [ ] Version: **1.2.0**
- [ ] Package: `com.twentyoneblaze.app`
- [ ] Build via EAS profile: **`android-production`** (`app-bundle`, not APK)
- [ ] `autoIncrement` versionCode enabled
- [ ] No `developmentClient` in store profile

## Binary requirements

- [ ] **AAB** artifact — do not upload `preview` APK
- [ ] Kotlin 2.3 / AdMob SDK compatibility verified
- [ ] Standalone build — no Metro required
- [ ] Device QA complete (`FINAL_DEVICE_QA_RESULTS.md`)

## In-app products

- [ ] No billing products — purchases disabled
- [ ] No Play Billing / RevenueCat initialization in release config

## Ads

- [ ] Production AdMob app ID in EAS production environment
- [ ] `ADMOB_USE_TEST_ADS=false` on `android-production`
- [ ] Families / ads declaration matches interstitial-only, non-gameplay placement
- [ ] UMP consent flow tested on Android

## Data safety

- [ ] Form completed from `STORE_PRIVACY_DATA_MAP.md`
- [ ] Privacy policy URL live

## Store listing

- [ ] Copy from `STORE_LISTING_COPY.md` — no deferred features claimed
- [ ] Feature graphic + phone screenshots (`STORE_ASSET_CHECKLIST.md`)

## Submit command (when ready — not run in packaging phase)

```bash
eas build --platform android --profile android-production
eas submit --platform android --profile android-production
```
