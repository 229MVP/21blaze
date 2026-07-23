# Production Feature Inventory — 21 Blaze RC 0.9.0

**Release candidate:** Production RC 0.9.0  
**Branch:** `cursor/rc-0-9-0-1a6b`  
**Version:** `0.9.0` (`app.json`, `package.json`, `APP_VERSION`); `android.versionCode=900`; `ios.buildNumber=900`  
**Bundle ID:** `com.twentyoneblaze.app` (iOS + Android)  
**Feature freeze:** See [FEATURE_FREEZE.md](./FEATURE_FREEZE.md) — no major new features; Pro subscriptions documented as present, not expanded.

Status legend:

| Status | Meaning |
|--------|---------|
| **Implemented** | Code path exists and is intended for RC |
| **Partially implemented** | Client and/or server incomplete, mismatched, or unverified |
| **Blocked** | Cannot ship as-is for store / production |
| **Unverified** | Exists locally; remote deploy or device validation not confirmed |
| **Not started** | Planned for RC hardening, not present yet |

---

## Core game

| System | Status | Notes |
|--------|--------|-------|
| Solo Blaze gameplay | Implemented | Local engine + self-test (`npm run test:game`) — **PASS** |
| Local high scores / history | Implemented | AsyncStorage-backed |
| How to Play | Implemented | Static guidance screens |
| Settings (audio/motion/etc.) | Implemented | Local settings storage |
| Web export | Unverified (running) | Not claimed succeeded in this report |
| ErrorBoundary | Implemented | Wraps `NavigationContainer` in `App.tsx` |

---

## Auth & profiles

| System | Status | Notes |
|--------|--------|-------|
| Anonymous Supabase auth | Partially implemented | Falls back to **local mode** when Supabase missing or connect timeout |
| Display name / profile | Implemented (client) | Depends on online auth + `profiles` table |
| Auth retry after failure | Implemented | `initializePromise` cleared on failure; Home **Retry Online** without blocking Solo |
| Account deletion | Not started | Required for store compliance — see [ACCOUNT_DELETION_PLAN.md](./ACCOUNT_DELETION_PLAN.md) |

---

## Online / multiplayer

| System | Status | Notes |
|--------|--------|-------|
| Online solo match submit / leaderboard | Unverified | Migrations + edge functions local; **remote deployment unverified** |
| Live Duel (private room) | Unverified | Code local; **default OFF**; production EAS disables; **no two-device tests** |
| Quick Match (casual) | Unverified | Code local; **default OFF**; production EAS disables; two-device unverified |
| Ranked matchmaking | Unverified | Code local; **default OFF**; self-test pure unit **PASS** |
| Ranked leaderboard / history UI | Implemented (client) | Server-backed paths unverified remotely |
| Two-device multiplayer validation | Not started | **P1** — never run on real devices |

---

## Monetization

| System | Status | Notes |
|--------|--------|-------|
| Blaze Store UI | Implemented | Catalog: ad-free, Inferno, Neon, Founders (+ Pro present, freeze) |
| RevenueCat client | Implemented in code | Products `blaze_ad_free`, `blaze_inferno_pack`, `blaze_neon_pack`, `blaze_founders_pack`; packages `ad_free` / `inferno` / `neon` / `founders`; offering `default`. **Dashboard match unverified** |
| Pro subscriptions (lifetime / yearly / monthly) | Implemented (present) | From prior phase; **feature freeze — do not expand** |
| Founders Bundle grant mapping | Implemented in code | Unlocks `founders_pack` + `ad_free` + `inferno_pack` + `neon_pack` (+ founder cosmetics/coins). Migration `0007` remaps server grant to neon (not volcano). **Remote apply unverified** |
| Restore / sync entitlements | Partially implemented | `sync-entitlements` + webhook local; sandbox purchases **not tested** |
| PurchaseDiagnosticsScreen | Implemented | Dev/preview entry only; refuses production |
| Interstitial ads (AdMob) | Blocked for store | `app.json` / defaults use **Google TEST app IDs** — **P1 open** |
| Rewarded ads | Blocked for store | Same test ID issue; **rewarded currency OFF everywhere** until SSV complete |
| Purchase sandbox validation | Not started | **P1** — no sandbox purchase tests performed |
| EAS / store build identity | Blocked | `eas.projectId` is placeholder `00000000-…` — **P1 open** |

---

## Wallet & coins

| System | Status | Notes |
|--------|--------|-------|
| Player wallet (server tables + RLS) | Implemented (schema local) | Client has **SELECT only**; writes via service_role RPCs / edge functions |
| Solo match coin claim | Fixed in local migration `0007` | `claim_solo_match_coins` ignores client score; uses `verified_scores`. **Remote apply pending** |
| Casual live duel coin grant | Partially implemented | **Client formulas only**; no verified server grant path |
| Ranked coin grant | Partially implemented | **Client formulas only**; no verified server grant path |
| Unverified coin claim UI | Policy for RC | **Disable / hide** Casual/Ranked unverified coin claims until server grants exist |
| Ad double-coins reward | Blocked / OFF | `claim-ad-reward` local; rewarded currency flag **OFF** until SSV complete |

---

## Cosmetics & progression

| System | Status | Notes |
|--------|--------|-------|
| Cosmetic catalog / equip | Implemented (client + RPCs local) | Equip via edge/`equip-cosmetic`; coin purchase via `purchase-cosmetic` |
| XP / levels / free rewards | Unverified | Migration `0006` + progression client; remote deploy unverified; flags **default OFF** |
| Daily rewards | Unverified | `daily-reward` edge function local; default OFF |
| Daily missions | Unverified | `daily-missions` edge function local; default OFF |
| Progression self-tests | Implemented | Pure unit (`npm run test:progression`) — **PASS** |

---

## Backend platform

| System | Status | Notes |
|--------|--------|-------|
| Migrations `0001`–`0006` | Local only | **Deployment unverified** |
| Migration `0007_rc_solo_coin_verified.sql` | Present locally | Solo score trust + Founders→neon remap. **Remote apply pending** |
| Edge functions (18) | Local only | **Deployment unverified** |
| RLS blocking client wallet/XP/score writes | Implemented (by design) | Mutations must go through edge/RPC |

---

## Feature flags

Defaults in code are **OFF**. EAS profiles override for QA vs production:

| Flag | Code default | production EAS | development / preview EAS |
|------|--------------|----------------|---------------------------|
| `EXPO_PUBLIC_ENABLE_LIVE_DUEL` | OFF | OFF | ON |
| `EXPO_PUBLIC_ENABLE_QUICK_MATCH` | OFF | OFF | ON |
| `EXPO_PUBLIC_ENABLE_RANKED_BETA` | OFF | OFF | ON |
| `EXPO_PUBLIC_ENABLE_MONETIZATION_BETA` | OFF | OFF | ON |
| `EXPO_PUBLIC_ENABLE_REWARDED_ADS` | OFF | OFF | ON |
| `EXPO_PUBLIC_ENABLE_REWARDED_CURRENCY` | OFF | OFF | **OFF** (SSV incomplete) |
| `EXPO_PUBLIC_ENABLE_INTERSTITIAL_ADS` | OFF | OFF | ON |
| `EXPO_PUBLIC_ENABLE_STORE_PURCHASES` | OFF | OFF | ON |
| `EXPO_PUBLIC_ENABLE_PROGRESSION_BETA` | OFF | OFF | ON |
| `EXPO_PUBLIC_ENABLE_DAILY_REWARDS` | OFF | OFF | ON |
| `EXPO_PUBLIC_ENABLE_DAILY_MISSIONS` | OFF | OFF | ON |
| `EXPO_PUBLIC_ENABLE_PURCHASE_DIAGNOSTICS` | OFF | OFF | ON |

Flags are **not a security boundary**. Server must remain authoritative. Solo Play is never gated.

---

## Quality / tooling

| System | Status | Notes |
|--------|--------|-------|
| Self-tests: game, ranked, monetization, progression | Implemented | **PASS** (pure unit via `tsx`) |
| TypeScript `tsc --noEmit` | **PASS** | |
| Expo doctor / web export | In progress | Not claimed succeeded |
| Native EAS builds | Blocked | Placeholder `projectId` |
| Secret exposure audit | No confirmed P0 | No secrets printed; `.env.example` updated |

---

## Explicitly out of scope (feature freeze)

Premium Season Pass, Blaze Club subscription (beyond existing Pro), Tournaments, Spectator, Clans, Creator events, Rematches, Advanced replays, additional game modes — see [FEATURE_FREEZE.md](./FEATURE_FREEZE.md).
