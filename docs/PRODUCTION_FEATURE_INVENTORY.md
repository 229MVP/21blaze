# Production Feature Inventory — 21 Blaze 0.9.0

**Track:** Internal Beta 0.9.0 (Solo-focused)  
**Branch:** `cursor/internal-beta-0-9-0-1a6b`  
**Version:** `0.9.0` (`app.json`, `package.json`, `APP_VERSION`); `android.versionCode=901`; `ios.buildNumber=901`  
**Bundle ID:** `com.twentyoneblaze.app` (iOS + Android)  
**Slug / scheme:** `21-blaze` / `twentyoneblaze`  
**Feature freeze:** Internal Beta set — multiplayer + progression **OFF** in preview/dev; see [FEATURE_FREEZE.md](./FEATURE_FREEZE.md) for broader 1.0 freeze.

Status legend:

| Status | Meaning |
|--------|---------|
| **Enabled (Internal Beta)** | Intended ON for preview/dev Internal Beta |
| **Disabled (Internal Beta)** | Intentionally OFF for this beta |
| **Implemented** | Code path exists |
| **Partially implemented** | Client and/or server incomplete, mismatched, or unverified |
| **Blocked** | Cannot ship as-is for store / production |
| **Unverified** | Exists locally; remote deploy or device validation not confirmed |
| **Not started** | Planned, not present yet |

---

## Core game

| System | Status | Notes |
|--------|--------|-------|
| Solo Blaze gameplay | **Enabled (Internal Beta)** | 4-lane; Ace / exact-21 / five-card / bust / timer / pause / results |
| Local high scores / history | **Enabled (Internal Beta)** | AsyncStorage-backed |
| Local leaderboard | **Enabled (Internal Beta)** | |
| How to Play | **Enabled (Internal Beta)** | Static guidance screens |
| Settings (audio/motion/etc.) | **Enabled (Internal Beta)** | Local settings storage |
| Web export | Unverified | Parent validation expected; not a native beta substitute |
| ErrorBoundary | Implemented | Wraps `NavigationContainer` in `App.tsx` |

---

## Auth & profiles

| System | Status | Notes |
|--------|--------|-------|
| Anonymous Supabase auth | **Enabled (Internal Beta)** / Partially implemented | Falls back to **local mode** when Supabase missing or connect timeout |
| Local mode fallback | **Enabled (Internal Beta)** | Solo never blocked |
| Display name / profile | Implemented (client) | Depends on online auth + `profiles` table |
| Auth retry after failure | Implemented | `initializePromise` cleared on failure; Home **Retry Online** |
| Account deletion | Not started | Required for store compliance — see [ACCOUNT_DELETION_PLAN.md](./ACCOUNT_DELETION_PLAN.md) |

---

## Online / multiplayer

| System | Status | Notes |
|--------|--------|-------|
| Online solo match submit / leaderboard | Unverified | Migrations + edge functions local; **remote deployment unverified** |
| Live Duel (private room) | **Disabled (Internal Beta)** | preview/dev EAS `false`; two-device untested; deploy unverified |
| Quick Match (casual) | **Disabled (Internal Beta)** | preview/dev EAS `false` |
| Ranked matchmaking | **Disabled (Internal Beta)** | preview/dev EAS `false` |
| Ranked leaderboard / history UI | Implemented (client) | Not part of Internal Beta surface |
| Two-device multiplayer validation | Not started | Deferred past Internal Beta |

---

## Monetization

| System | Status | Notes |
|--------|--------|-------|
| Blaze Store UI | **Enabled (Internal Beta)** | Ad-free, Inferno, Neon, Founders (+ Pro present, freeze) |
| RevenueCat client | **Enabled (Internal Beta)** — code ready | Products `blaze_*`; **dashboard + native Test Store NOT verified** |
| RevenueCat Test Store purchases | **Enabled (Internal Beta)** | Device tests **NOT RUN** (need preview binary) |
| Production store purchases | **Disabled (Internal Beta)** | Not for this beta |
| Pro subscriptions (lifetime / yearly / monthly) | Implemented (present) | Feature freeze — do not expand |
| Founders Bundle grant mapping | Implemented in code | founders + ad_free + inferno + neon; migration `0007` local |
| Restore / sync entitlements | **Enabled (Internal Beta)** / Partially implemented | Restore UX on; sandbox/device **NOT RUN** |
| PurchaseDiagnosticsScreen | **Enabled (Internal Beta)** | Preview/dev only; refuses production |
| Interstitial ads (AdMob TEST IDs) | **Enabled (Internal Beta)** | Google TEST IDs for Ad-Free verification |
| Production AdMob IDs | **Disabled (Internal Beta)** / Blocked for store | Must swap before store binaries |
| Rewarded ads | **Disabled (Internal Beta)** | SSV incomplete |
| Rewarded currency | **Disabled (Internal Beta)** | OFF everywhere until SSV |
| EAS / store build identity | Blocked | Placeholder `projectId` + missing Expo auth |

---

## Wallet & coins

| System | Status | Notes |
|--------|--------|-------|
| Player wallet (server tables + RLS) | Implemented (schema local) | Client SELECT only; remote deploy unverified |
| Solo match coin claim | Fixed in local migration `0007` | **Remote apply pending** — not Internal Beta gate for local Solo |
| Casual / Ranked coin grant | **Disabled (Internal Beta)** | Multiplayer OFF; client formulas only if re-enabled |
| Ad double-coins reward | **Disabled (Internal Beta)** | Rewarded currency OFF |

---

## Cosmetics & progression

| System | Status | Notes |
|--------|--------|-------|
| Cosmetic catalog / equip (from purchases) | **Enabled (Internal Beta)** | Entitlement display after Test Store / restore |
| XP / levels / free rewards | **Disabled (Internal Beta)** | Backend deploy unverified; flags OFF in preview/dev |
| Daily rewards | **Disabled (Internal Beta)** | Flag OFF |
| Daily missions | **Disabled (Internal Beta)** | Flag OFF |
| Progression self-tests | Implemented | Pure unit — parent validation expected |

---

## Backend platform

| System | Status | Notes |
|--------|--------|-------|
| Migrations `0001`–`0006` | Local only | **Deployment unverified** |
| Migration `0007_rc_solo_coin_verified.sql` | Present locally | **Remote apply pending** |
| Edge functions | Local only | **Deployment unverified** |
| RLS blocking client wallet/XP/score writes | Implemented (by design) | Mutations via edge/RPC |

---

## Feature flags (Internal Beta 0.9.0)

Defaults in code are **OFF**. EAS preview/dev for Internal Beta:

| Flag | Code default | production EAS | development / preview EAS (Internal Beta) |
|------|--------------|----------------|---------------------------------------------|
| `EXPO_PUBLIC_ENABLE_LIVE_DUEL` | OFF | OFF | **OFF** |
| `EXPO_PUBLIC_ENABLE_QUICK_MATCH` | OFF | OFF | **OFF** |
| `EXPO_PUBLIC_ENABLE_RANKED_BETA` | OFF | OFF | **OFF** |
| `EXPO_PUBLIC_ENABLE_MONETIZATION_BETA` | OFF | OFF | **ON** |
| `EXPO_PUBLIC_ENABLE_REWARDED_ADS` | OFF | OFF | **OFF** |
| `EXPO_PUBLIC_ENABLE_REWARDED_CURRENCY` | OFF | OFF | **OFF** (SSV incomplete) |
| `EXPO_PUBLIC_ENABLE_INTERSTITIAL_ADS` | OFF | OFF | **ON** (TEST IDs) |
| `EXPO_PUBLIC_ENABLE_STORE_PURCHASES` | OFF | OFF | **ON** (Test Store) |
| `EXPO_PUBLIC_ENABLE_PROGRESSION_BETA` | OFF | OFF | **OFF** |
| `EXPO_PUBLIC_ENABLE_DAILY_REWARDS` | OFF | OFF | **OFF** |
| `EXPO_PUBLIC_ENABLE_DAILY_MISSIONS` | OFF | OFF | **OFF** |
| `EXPO_PUBLIC_ENABLE_PURCHASE_DIAGNOSTICS` | OFF | OFF | **ON** |

Flags are **not a security boundary**. Server must remain authoritative. Solo Play is never gated.

---

## Quality / tooling

| System | Status | Notes |
|--------|--------|-------|
| Self-tests: game, ranked, monetization, progression | Implemented | Parent validation expected |
| TypeScript `tsc --noEmit` | Expected parent | Not claimed in Internal Beta build report |
| Expo doctor / web export | Expected parent | Not claimed succeeded here |
| Native EAS builds | **Blocked** | Placeholder `projectId` + no Expo auth |
| Secret exposure audit | No confirmed P0 | |

---

## Explicitly out of scope (feature freeze)

Premium Season Pass, Blaze Club subscription (beyond existing Pro), Tournaments, Spectator, Clans, Creator events, Rematches, Advanced replays, additional game modes — see [FEATURE_FREEZE.md](./FEATURE_FREEZE.md).

Internal Beta also excludes Live/Quick/Ranked and progression/dailies until deploy + device evidence exist.
