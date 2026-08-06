# Store Release Environment Checklist

Audit EAS **production** environment variables before `production` (iOS) and
`android-production` (Google Play) builds. **Do not print secret values** in
logs or this document — mark presence only.

## How to verify

```bash
eas env:list --environment production
```

Or Expo dashboard → Project → Environment variables → **production**.

Record **SET** / **MISSING** / **NOT REQUIRED** for each item below.

---

## Required gates (must be SET or safely optional)

| Variable | production build | Notes |
|----------|------------------|-------|
| `EXPO_PUBLIC_APP_ENV` | SET (`production`) | In `eas.json` profile env |
| `EXPO_PUBLIC_ENABLE_STORE_PURCHASES` | SET (`false`) | Purchases disabled |
| `EXPO_PUBLIC_ENABLE_MONETIZATION_BETA` | SET (`true`) | Ads + Blaze economy UX |
| `EXPO_PUBLIC_ADMOB_USE_TEST_ADS` | SET (`false`) | Public store — live units when configured |
| `EXPO_PUBLIC_ENABLE_REWARDED_CURRENCY` | SET (`false`) | No client-only coin grants |
| `EXPO_PUBLIC_ENABLE_PURCHASE_DIAGNOSTICS` | SET (`false`) | |
| `EXPO_PUBLIC_ENABLE_THEME_PREVIEW_DEV` | SET (`false`) | |
| `EXPO_PUBLIC_ENABLE_LIVE_DUEL` | SET (`false`) | |
| `EXPO_PUBLIC_ENABLE_QUICK_MATCH` | SET (`false`) | |
| `EXPO_PUBLIC_ENABLE_RANKED_BETA` | SET (`false`) | |
| `EXPO_PUBLIC_ENABLE_V1_1_LOCKER` | SET (`true`) | |
| `EXPO_PUBLIC_ENABLE_V1_1_REWARDS` | SET (`true`) | |
| `EXPO_PUBLIC_ENABLE_V1_2_VISUAL_SYSTEM` | SET (`true`) | |

## Must NOT be present (or must be empty)

| Variable | Requirement |
|----------|-------------|
| `SUPABASE_SERVICE_ROLE_KEY` | **Must not** be in client env |
| `REVENUECAT_WEBHOOK_AUTHORIZATION` | Server-only |
| `EXPO_PUBLIC_REVENUECAT_API_KEY` (`test_…`) | **Must not** be Test Store key in production |
| Localhost URLs in `EXPO_PUBLIC_SUPABASE_URL` | **BLOCKER** if present |

## Purchases / RevenueCat (disabled)

| Check | Expected |
|-------|----------|
| `EXPO_PUBLIC_ENABLE_STORE_PURCHASES` | `false` |
| RevenueCat platform keys | NOT REQUIRED — SDK does not initialize |
| Paywall routes | Hidden by flag |

## Supabase (online features)

| Variable | When required | If missing |
|----------|---------------|------------|
| `EXPO_PUBLIC_SUPABASE_URL` | Global scores, locker sync, rewards | Local mode; Solo still works |
| `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Same | Same |

## AdMob (production ads enabled)

| Variable | When required | If missing |
|----------|---------------|------------|
| `EXPO_PUBLIC_ADMOB_IOS_APP_ID` | iOS production with ads | Falls back to Google **test** app ID in binary — **BLOCKER for public release** |
| `EXPO_PUBLIC_ADMOB_ANDROID_APP_ID` | Android production with ads | Same |
| `EXPO_PUBLIC_ADMOB_INTERSTITIAL_IOS_ID` | iOS interstitials | Test unit fallback when test mode forced only |
| `EXPO_PUBLIC_ADMOB_INTERSTITIAL_ANDROID_ID` | Android interstitials | Same |

`app.config.js` injects production AdMob **app** IDs into the native plugin when env vars are set at build time.

## Internal / TestFlight only

| Profile | `EXPO_PUBLIC_ADMOB_USE_TEST_ADS` |
|---------|----------------------------------|
| `testflight` | `true` |
| `preview` | `true` |
| `production` | `false` |
| `android-production` | `false` |

## Build profile sanity

| Profile | `developmentClient` | `distribution` | Android `buildType` |
|---------|---------------------|----------------|---------------------|
| `development` | true | internal | apk |
| `preview` | unset (false) | internal | **apk** (preserve) |
| `testflight` | unset | store | — |
| `production` | unset | store | — (iOS only) |
| `android-production` | unset | store | **app-bundle** |

## EAS project identity

| Field | Expected |
|-------|----------|
| Owner | `229mvp` |
| Project ID | `0c5db163-a4c0-4a17-9a8a-e12eed3bf511` |
| App version (local) | `1.2.0` |
| iOS bundle ID | `com.twentyoneblaze.app` |
| Android package | `com.twentyoneblaze.app` |
| iOS `autoIncrement` | `true` on store profiles |
| Android `autoIncrement` | `true` on `android-production` |

## Safe failure behavior

- Missing Supabase → local auth, Solo playable
- Missing RevenueCat keys → no error (purchases disabled)
- Missing AdMob units with test mode off → ad load fails; Solo not blocked
- Missing optional env → no startup black screen (verified by startup self-tests)

## Sign-off

| Check | Status |
|-------|--------|
| Production env reviewed | |
| No service-role key in client | |
| No Test Store RevenueCat key | |
| Production AdMob app IDs SET | |
| Store purchases false | |
| Reviewer sign-off | |
