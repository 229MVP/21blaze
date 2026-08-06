# Environment Variables — 21 Blaze RC 0.9.0

Reference for client (Expo) and server (Supabase) configuration.  
**Never put secrets in `EXPO_PUBLIC_*` variables or commit `.env.local`.**

Source of truth for client templates: `.env.example` (updated for RC 0.9.0 defaults OFF).

---

## Client (Expo / EAS)

### Supabase (public)

| Variable | Required | Secret? | Description |
|----------|----------|---------|-------------|
| `EXPO_PUBLIC_SUPABASE_URL` | Yes for online | No (project URL) | Supabase project URL |
| `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Yes for online | No (publishable/anon) | Client publishable key — **not** service role |

If either is missing, auth falls to **local mode**. Home exposes **Retry Online** without blocking Solo.

### App env

| Variable | Values | Description |
|----------|--------|-------------|
| `EXPO_PUBLIC_APP_ENV` | `development` \| `preview` \| `production` | Set by EAS profiles; gates purchase diagnostics and profile intent |

### Feature flags (code defaults OFF when unset)

| Variable | Default | Description |
|----------|---------|-------------|
| `EXPO_PUBLIC_ENABLE_LIVE_DUEL` | `false` | Live Duel UX |
| `EXPO_PUBLIC_ENABLE_QUICK_MATCH` | `false` | Quick Match UX |
| `EXPO_PUBLIC_ENABLE_RANKED_BETA` | `false` | Ranked UX |
| `EXPO_PUBLIC_ENABLE_MONETIZATION_BETA` | `false` | Monetization master UX (coin chip, Blaze Store/Rewards route, coin panels) |
| `EXPO_PUBLIC_ENABLE_REWARDED_ADS` | `false` | Rewarded ad SDK/infra (requires monetization) — does **not** by itself grant currency |
| `EXPO_PUBLIC_ENABLE_REWARDED_CURRENCY` | `false` | Coin grants from rewarded ads — **OFF everywhere until AdMob SSV is complete** (see Ads-first release notes) |
| `EXPO_PUBLIC_ENABLE_INTERSTITIAL_ADS` | `false` | Interstitials (requires monetization) |
| `EXPO_PUBLIC_ENABLE_STORE_PURCHASES` | `false` | IAP UX (requires monetization). **`false` for TestFlight and the public App Store release (v1.0, ads-first).** RevenueCat products/paywall remain configured for a future release. |
| `EXPO_PUBLIC_ENABLE_PROGRESSION_BETA` | `false` | Progression master UX |
| `EXPO_PUBLIC_ENABLE_DAILY_REWARDS` | `false` | Daily rewards (requires progression) |
| `EXPO_PUBLIC_ENABLE_DAILY_MISSIONS` | `false` | Daily missions (requires progression) |
| `EXPO_PUBLIC_ENABLE_PURCHASE_DIAGNOSTICS` | `false` | PurchaseDiagnosticsScreen entry — also refused in production **and whenever store purchases are disabled** |
| `EXPO_PUBLIC_ENABLE_V1_1_LOCKER` | `false` | Version 1.1B Blaze Locker — earnable, code-driven cosmetic unlocks spent with Blaze Coins only. Independent of `EXPO_PUBLIC_ENABLE_STORE_PURCHASES`; never enables paid products or RevenueCat. |
| `EXPO_PUBLIC_ENABLE_DAILY_CHALLENGE` | `false` | Version 1.3A Daily Challenge master switch |
| `EXPO_PUBLIC_ENABLE_DAILY_CHALLENGE_RANKED` | `false` | Ranked Daily Challenge attempts (requires master + online auth) |
| `EXPO_PUBLIC_ENABLE_DAILY_CHALLENGE_PRACTICE` | `false` | Practice Daily Challenge attempts |
| `EXPO_PUBLIC_ENABLE_DAILY_LEADERBOARD` | `false` | Daily Challenge leaderboard screen |
| `EXPO_PUBLIC_ENABLE_WEEKLY_LEADERBOARD` | `false` | Weekly Challenge Points leaderboard |
| `EXPO_PUBLIC_ENABLE_LEADERBOARD_NEARBY` | `false` | Nearby rank sections |
| `EXPO_PUBLIC_ENABLE_PUBLIC_PLAYER_PROFILES` | `false` | Public profile drill-down (future) |
| `EXPO_PUBLIC_ENABLE_FRIENDS_LEADERBOARD` | `false` | Friends tab on High Scores — keep false until friends backend exists |

Flags are **client UX only**, not authorization. Solo Play is never gated.

When `EXPO_PUBLIC_ENABLE_STORE_PURCHASES=false`:
- `configureRevenueCat` (the single choke point for `Purchases.configure`) returns immediately without configuring the SDK.
- `usePurchaseStore`'s `purchaseProduct`, `restorePurchases`, `presentProPaywall`, `openCustomerCenter`, `refreshCustomerInfo` all no-op (`'unavailable'` / no-op) without setting a visible error.
- `BlazeStoreScreen` renders as **BLAZE REWARDS**: Pro / Founders / Remove Ads / store-sourced card themes & arenas are hidden; only the coin-earnable cosmetics section and Restore/Diagnostics-free footer remain.
- `SettingsScreen`'s **ACCOUNT AND PURCHASES** section collapses to a **PRIVACY** section (Privacy Options only).

See [`ADS_FIRST_RELEASE_NOTES.md`](./ADS_FIRST_RELEASE_NOTES.md) for the full v1.0 ads-first plan.

### AdMob test mode override

| Variable | Default | Description |
|----------|---------|-------------|
| `EXPO_PUBLIC_ADMOB_USE_TEST_ADS` | `false` | When `true`, always use Google's sample test ad units regardless of configured production IDs. Set `true` for development/preview/TestFlight; `false` for the public App Store release. |

### RevenueCat (public SDK keys)

| Variable | Required | Secret? | Description |
|----------|----------|---------|-------------|
| `EXPO_PUBLIC_REVENUECAT_API_KEY` | Recommended | No (SDK/public) | Shared / Test Store `test_` key — **preferred for development / preview** |
| `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY` | iOS prod | No | iOS public SDK key (`appl_…`) — **required for production iOS** |
| `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY` | Android prod | No | Android public SDK key (`goog_…`) — **required for production Android** |

Key selection (`getRevenueCatApiKey`):
- **development / preview:** prefer `EXPO_PUBLIC_REVENUECAT_API_KEY` (Test Store), then platform key.
- **production:** prefer platform key; never configure a `test_…` Test Store key.

Set these via EAS Environment / secrets for builds — do **not** commit key values. Local `.env.local` is gitignored.

Client catalog (code): products `blaze_ad_free`, `blaze_inferno_pack`, `blaze_neon_pack`, `blaze_founders_pack`; packages `ad_free` / `inferno` / `neon` / `founders`; offering `default`. **Dashboard must match.**

Do **not** put RevenueCat secret API keys in the app.

### AdMob

| Variable | Required for store | Notes |
|----------|-------------------|-------|
| `EXPO_PUBLIC_ADMOB_ANDROID_APP_ID` | Yes | Must be **production** app ID for store |
| `EXPO_PUBLIC_ADMOB_IOS_APP_ID` | Yes | Must be **production** app ID for store |
| `EXPO_PUBLIC_ADMOB_REWARDED_ANDROID_ID` | Yes | Production rewarded unit |
| `EXPO_PUBLIC_ADMOB_REWARDED_IOS_ID` | Yes | Production rewarded unit |
| `EXPO_PUBLIC_ADMOB_INTERSTITIAL_ANDROID_ID` | Yes | Production interstitial unit |
| `EXPO_PUBLIC_ADMOB_INTERSTITIAL_IOS_ID` | Yes | Production interstitial unit |

**P1 open:** When empty, code falls back to Google **TEST** IDs. `app.json` still embeds Google test app IDs.

---

## EAS build env (from `eas.json`)

| Profile | Intent |
|---------|--------|
| **development** | Physical-device `developmentClient` (`ios.simulator: false`). Monetization + store purchases ON for RevenueCat Test Store QA. Ads ON with forced test ad units. Multiplayer/progression OFF. Purchase diagnostics ON. |
| **preview** | Internal distribution APK / device build. Same flags as development — used for internal QA of purchases and ads together. |
| **testflight** | `distribution: store`, `autoIncrement: true`, **not** `developmentClient`. Ads-first: monetization + ads ON with forced test ad units, **store purchases OFF**, purchase diagnostics OFF. No RevenueCat Test Store key is required or used. |
| **production** | Store distribution. Ads-first: monetization + ads ON, **store purchases OFF**, real (non-test) ad units expected via secrets, purchase diagnostics OFF. Never uses a Test Store key. |

Build TestFlight with `eas build --platform ios --profile testflight`.

### iOS physical development build checklist

1. Replace placeholder `extra.eas.projectId` via `eas init` (requires Expo login / `EXPO_TOKEN`).
2. Register Apple team + device for internal distribution.
3. Set EAS **development** environment: `EXPO_PUBLIC_REVENUECAT_API_KEY` = Test Store public key.
4. Production EAS environment: set `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY` to the real iOS public SDK key (never `test_…`).
5. Build: `eas build --platform ios --profile development`

**Blocked:** `extra.eas.projectId` is placeholder UUID — real EAS project must be linked before native builds are meaningful (**P1-1**).

---

## Server-only (Supabase secrets)

Set in Supabase project secrets / function env. **Never** in Expo client.

| Variable | Used by | Description |
|----------|---------|-------------|
| `SUPABASE_SERVICE_ROLE_KEY` | Edge functions (admin client) | Full DB access — server only |
| `REVENUECAT_WEBHOOK_AUTHORIZATION` | `revenuecat-webhook` | Shared secret to validate webhook calls |
| Supabase URL / anon as provided by platform | Edge runtime | Usually injected as `SUPABASE_URL`, `SUPABASE_ANON_KEY` |

Optional / platform-managed:

| Variable | Notes |
|----------|-------|
| `SUPABASE_DB_URL` | Migrations / CLI only |
| Store / RevenueCat dashboard config | Product IDs, entitlements — not env in app |

---

## Local development

1. Copy `.env.example` → `.env.local`
2. Fill Supabase publishable URL/key for online features
3. Explicitly enable flags needed for local QA (defaults OFF)
4. Leave AdMob empty only for deliberate test-ID local runs
5. Confirm `.env.local` is gitignored

---

## Production readiness checklist (env)

- [ ] Real `EXPO_PUBLIC_SUPABASE_*` for target project
- [ ] Production RevenueCat public SDK keys (platform-specific)
- [ ] Production AdMob app + unit IDs in **both** env and `app.json` plugin/Info.plist
- [ ] EAS projectId not placeholder
- [ ] Edge secrets set: service role, RevenueCat webhook authorization
- [ ] No service-role or webhook secret in client bundle
- [ ] Rewarded currency remains OFF until SSV verified
