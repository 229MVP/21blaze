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
| `EXPO_PUBLIC_ENABLE_MONETIZATION_BETA` | `false` | Monetization master UX |
| `EXPO_PUBLIC_ENABLE_REWARDED_ADS` | `false` | Rewarded ads (requires monetization) |
| `EXPO_PUBLIC_ENABLE_REWARDED_CURRENCY` | `false` | Coin grants from rewarded ads — **OFF everywhere until SSV complete** |
| `EXPO_PUBLIC_ENABLE_INTERSTITIAL_ADS` | `false` | Interstitials (requires monetization) |
| `EXPO_PUBLIC_ENABLE_STORE_PURCHASES` | `false` | IAP UX (requires monetization) |
| `EXPO_PUBLIC_ENABLE_PROGRESSION_BETA` | `false` | Progression master UX |
| `EXPO_PUBLIC_ENABLE_DAILY_REWARDS` | `false` | Daily rewards (requires progression) |
| `EXPO_PUBLIC_ENABLE_DAILY_MISSIONS` | `false` | Daily missions (requires progression) |
| `EXPO_PUBLIC_ENABLE_PURCHASE_DIAGNOSTICS` | `false` | PurchaseDiagnosticsScreen entry (also refused in production) |

Flags are **client UX only**, not authorization. Solo Play is never gated.

### RevenueCat (public SDK keys)

| Variable | Required | Secret? | Description |
|----------|----------|---------|-------------|
| `EXPO_PUBLIC_REVENUECAT_API_KEY` | Recommended | No (SDK/public) | Shared / Test Store `test_` key |
| `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY` | iOS prod | No | iOS public SDK key |
| `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY` | Android prod | No | Android public SDK key |

Client catalog (code): products `blaze_ad_free`, `blaze_inferno_pack`, `blaze_neon_pack`, `blaze_founders_pack`; packages `ad_free` / `inferno` / `neon` / `founders`; offering `default`. **Dashboard must match — unverified.**

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
| **development** / **preview** | Enable Live Duel, Quick Match, Ranked, monetization, interstitial/rewarded ads, store purchases, progression, dailies, purchase diagnostics for QA. **`EXPO_PUBLIC_ENABLE_REWARDED_CURRENCY=false`** |
| **production** | All of the above **disabled** (including diagnostics). Rewarded currency OFF |

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
