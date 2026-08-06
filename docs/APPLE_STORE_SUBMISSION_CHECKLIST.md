# Apple App Store Submission Checklist — 1.2.0

## App identity

- [ ] Name: **21 Blaze**
- [ ] Version: **1.2.0**
- [ ] Bundle ID: `com.twentyoneblaze.app`
- [ ] Build via EAS profile: **`production`** (`autoIncrement` build number)
- [ ] ASC App ID: `6797273226`
- [ ] Apple Team ID: `9C5LBWL2HS`
- [ ] No `developmentClient` in store profile

## Binary requirements

- [ ] iOS deployment target 16.4+
- [ ] Encryption exemption accurate (`ITSAppUsesNonExemptEncryption: false`)
- [ ] Standalone build — no Metro required
- [ ] TestFlight QA complete (`FINAL_DEVICE_QA_RESULTS.md`)

## In-app purchase

- [ ] No IAP products active — purchases disabled
- [ ] No paywall or restore UI in release binary
- [ ] App Review notes state purchases disabled

## Ads

- [ ] TestFlight used test ads (`ADMOB_USE_TEST_ADS=true`)
- [ ] Production uses live AdMob app IDs from EAS env (not Google sample IDs in shipped binary)
- [ ] Ads not shown during active gameplay or countdown
- [ ] UMP / privacy options available when required

## Privacy

- [ ] App Privacy questionnaire completed from `STORE_PRIVACY_DATA_MAP.md`
- [ ] Privacy policy URL live
- [ ] ATT description matches behavior

## Review assets

- [ ] Screenshots per `STORE_ASSET_CHECKLIST.md`
- [ ] App Review notes (`APP_REVIEW_NOTES.md`)
- [ ] Demo account if login required (Solo works without account)

## Submit command (when ready — not run in packaging phase)

```bash
eas build --platform ios --profile production
eas submit --platform ios --profile production
```
