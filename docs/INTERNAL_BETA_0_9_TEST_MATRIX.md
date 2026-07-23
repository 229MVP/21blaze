# Internal Beta 0.9.0 Test Matrix — 21 Blaze

Manual / device QA matrix for **Internal Beta 0.9.0** on branch `cursor/internal-beta-0-9-0-1a6b`.

| Field | Value |
|-------|-------|
| Version | `0.9.0` |
| Android `versionCode` | `901` |
| iOS `buildNumber` | `901` |
| Bundle / package | `com.twentyoneblaze.app` |
| EAS profiles | `preview` / `development` |
| Focus | Solo + Test Store monetization |

**Baselines (honest):**

- EAS native builds **NOT RUN** — blocked by placeholder `projectId` + missing `EXPO_TOKEN` / `eas login`
- Device purchase / restore tests **NOT RUN** (need native preview binary)
- Remote Supabase migrations `0001`–`0007` deployment **unverified**
- RevenueCat dashboard + native Test Store purchase **NOT verified** in this environment
- Validation expected from parent agent: `tsc`, expo-doctor, web export, self-tests (not claimed here)

Legend for **Android / iOS / Status:** `Pass` · `Fail` · `Not run` · `Blocked` · `Disabled` · `N/A`

---

## Columns

| Column | Meaning |
|--------|---------|
| ID | Stable case id |
| Area | Feature area |
| Case | What to verify |
| Priority | P0 (ship-stop) · P1 (must before beta confidence) · P2 (polish) |
| Expected | Pass condition |
| Android | Result on Android preview/dev |
| iOS | Result on iOS preview/dev |
| Status | Roll-up / beta classification |
| Notes | Evidence, blockers, Disabled reason |

---

## A. Build & boot

| ID | Area | Case | Priority | Expected | Android | iOS | Status | Notes |
|----|------|------|----------|----------|---------|-----|--------|-------|
| A1 | Build | Install preview/dev binary | P0 | App installs | Blocked | Blocked | Blocked | EAS projectId placeholder; no EXPO_TOKEN |
| A2 | Boot | Cold start → Home | P0 | Home without crash | Not run | Not run | Not run | Needs native build |
| A3 | Boot | Version shows `0.9.0` / build `901` | P1 | Matches app.json | Not run | Not run | Not run | Repo: `0.9.0` / `901` |
| A4 | Boot | ErrorBoundary recoverable UI | P2 | Recoverable screen on throw | Not run | Not run | Not run | Boundary present in code |
| A5 | Boot | Scheme `twentyoneblaze` deep link safe | P2 | No crash on open | Not run | Not run | Not run | |

---

## B. Auth & local fallback

| ID | Area | Case | Priority | Expected | Android | iOS | Status | Notes |
|----|------|------|----------|----------|---------|-----|--------|-------|
| B1 | Auth | Anonymous sign-in when Supabase configured | P1 | Guest session or clear online state | Not run | Not run | Not run | Deploy unverified |
| B2 | Auth | Missing env → local mode | P0 | Solo still available | Not run | Not run | Not run | |
| B3 | Auth | Connect timeout → local mode | P0 | Solo never blocked | Not run | Not run | Not run | |
| B4 | Auth | Retry Online after failed init | P1 | Retry does not gate Solo | Not run | Not run | Not run | |
| B5 | Auth | Display name update | P2 | Works online only | Not run | Not run | Not run | |

---

## C. Solo gameplay (ENABLED)

| ID | Area | Case | Priority | Expected | Android | iOS | Status | Notes |
|----|------|------|----------|----------|---------|-----|--------|-------|
| C1 | Solo | Start Solo Play from Home | P0 | Match starts | Not run | Not run | Not run | |
| C2 | Solo | 4-lane gameplay | P0 | All lanes interactive | Not run | Not run | Not run | |
| C3 | Solo | Ace scoring | P1 | Ace treated per rules | Not run | Not run | Not run | |
| C4 | Solo | Exact 21 | P1 | Correct win/score | Not run | Not run | Not run | |
| C5 | Solo | Five-card rule | P1 | Correct resolution | Not run | Not run | Not run | |
| C6 | Solo | Bust | P1 | Bust ends lane/run correctly | Not run | Not run | Not run | |
| C7 | Solo | Timer | P1 | Timer counts / expires correctly | Not run | Not run | Not run | |
| C8 | Solo | Pause / resume | P1 | Pause freezes; resume continues | Not run | Not run | Not run | |
| C9 | Solo | Results screen | P0 | Score shown; return to Home | Not run | Not run | Not run | |
| C10 | Solo | Quit mid-run | P2 | Clean exit; no corrupt state | Not run | Not run | Not run | |
| C11 | Solo | Local high score persists | P0 | Score survives kill-restart | Not run | Not run | Not run | AsyncStorage |
| C12 | Solo | Local leaderboard | P1 | Entries listed locally | Not run | Not run | Not run | |
| C13 | Solo | Settings (audio/motion) | P2 | Prefs apply and persist | Not run | Not run | Not run | |
| C14 | Solo | How to Play | P2 | Content readable | Not run | Not run | Not run | |

---

## D. Monetization — RevenueCat Test Store (ENABLED in preview/dev)

| ID | Area | Case | Priority | Expected | Android | iOS | Status | Notes |
|----|------|------|----------|----------|---------|-----|--------|-------|
| D1 | IAP | Offerings load (`default`) | P1 | Packages visible | Not run | Not run | Not run | Dashboard unverified |
| D2 | IAP | Purchase `blaze_ad_free` | P1 | `ad_free` entitlement | Not run | Not run | Not run | Test Store; NOT RUN native |
| D3 | IAP | Purchase `blaze_inferno_pack` | P1 | Inferno cosmetics unlock | Not run | Not run | Not run | |
| D4 | IAP | Purchase `blaze_neon_pack` | P1 | Neon cosmetics unlock | Not run | Not run | Not run | |
| D5 | IAP | Purchase `blaze_founders_pack` | P1 | founders + ad_free + inferno + neon | Not run | Not run | Not run | Code mapping ready |
| D6 | IAP | Restore Purchases | P1 | Prior entitlements return | Not run | Not run | Not run | Requires native preview |
| D7 | IAP | Cosmetic entitlement display | P1 | Owned/equipped shown in UI | Not run | Not run | Not run | |
| D8 | IAP | Purchase Diagnostics (preview/dev) | P1 | Screen opens; useful state | Not run | Not run | Not run | Must refuse production |
| D9 | IAP | Production store purchases | P0 | N/A for this beta | Disabled | Disabled | Disabled | Internal Beta uses Test Store only |

---

## E. Ads (ENABLED interstitials with TEST IDs only)

| ID | Area | Case | Priority | Expected | Android | iOS | Status | Notes |
|----|------|------|----------|----------|---------|-----|--------|-------|
| E1 | Ads | Interstitial with Google TEST IDs | P1 | Test ad can show when eligible | Not run | Not run | Not run | Acceptable for Internal Beta |
| E2 | Ads | Ad-Free suppresses interstitial | P1 | No interstitial after `blaze_ad_free` | Not run | Not run | Not run | Depends on D2 |
| E3 | Ads | Rewarded ads | P1 | Not offered / not claimable | Disabled | Disabled | Disabled | SSV incomplete |
| E4 | Ads | Rewarded currency | P0 | No coin grant from ads | Disabled | Disabled | Disabled | Flag OFF everywhere |
| E5 | Ads | Production AdMob IDs | P0 | Must not be required for beta | Disabled | Disabled | Disabled | Prod IDs forbidden until store RC |

---

## F. Multiplayer (DISABLED for Internal Beta)

| ID | Area | Case | Priority | Expected | Android | iOS | Status | Notes |
|----|------|------|----------|----------|---------|-----|--------|-------|
| F1 | MP | Live Duel | P1 | Hidden / inert | Disabled | Disabled | Disabled | Two-device untested; deploy unverified |
| F2 | MP | Quick Match | P1 | Hidden / inert | Disabled | Disabled | Disabled | preview/dev flags OFF |
| F3 | MP | Ranked | P1 | Hidden / inert | Disabled | Disabled | Disabled | preview/dev flags OFF |

---

## G. Progression (DISABLED for Internal Beta)

| ID | Area | Case | Priority | Expected | Android | iOS | Status | Notes |
|----|------|------|----------|----------|---------|-----|--------|-------|
| G1 | Progression | XP / levels UX | P2 | Hidden / inert | Disabled | Disabled | Disabled | Backend deploy unverified |
| G2 | Progression | Daily rewards | P2 | Hidden / inert | Disabled | Disabled | Disabled | Flag OFF in preview/dev |
| G3 | Progression | Daily missions | P2 | Hidden / inert | Disabled | Disabled | Disabled | Flag OFF in preview/dev |

---

## H. Automated smoke (parent agent)

| ID | Area | Case | Priority | Expected | Android | iOS | Status | Notes |
|----|------|------|----------|----------|---------|-----|--------|-------|
| H1 | CI | `npx tsc --noEmit` | P0 | Pass | N/A | N/A | Expected parent | Not claimed in this matrix |
| H2 | CI | expo-doctor | P1 | Pass | N/A | N/A | Expected parent | |
| H3 | CI | Web export | P1 | Completes | N/A | N/A | Expected parent | Not a native beta substitute |
| H4 | CI | `npm run test:game` | P0 | Pass | N/A | N/A | Expected parent | Pure unit |
| H5 | CI | `npm run test:monetization` | P1 | Pass | N/A | N/A | Expected parent | Pure unit |
| H6 | CI | `npm run test:ranked` | P2 | Pass | N/A | N/A | Expected parent | Feature Disabled in beta UX |
| H7 | CI | `npm run test:progression` | P2 | Pass | N/A | N/A | Expected parent | Feature Disabled in beta UX |

---

## Sign-off

| Role | Name | Date | Result |
|------|------|------|--------|
| QA | | | |
| Eng | | | |
| Release | | | |

**Cannot claim Internal Beta device-ready** until A1 Pass on at least one platform and critical Solo (C*) + purchase (D*) paths are executed on device.

**Current roll-up:** native rows **Not run / Blocked**; multiplayer & progression **Disabled**; recommendation in [INTERNAL_BETA_0_9_BUILD_REPORT.md](./INTERNAL_BETA_0_9_BUILD_REPORT.md).
