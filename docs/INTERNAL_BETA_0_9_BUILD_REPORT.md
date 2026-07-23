# Internal Beta 0.9.0 Build Report — 21 Blaze

Honest status for Internal Beta packaging on `cursor/internal-beta-0-9-0-1a6b`.  
This report does **not** claim EAS build success, device purchase success, or remote Supabase deploy.

| Field | Value |
|-------|-------|
| Release | Internal Beta 0.9.0 |
| Branch | `cursor/internal-beta-0-9-0-1a6b` |
| Commit | (set after tip push — see branch tip) |
| Version | `0.9.0` |
| Android `versionCode` | `901` |
| iOS `buildNumber` | `901` |
| Bundle / package | `com.twentyoneblaze.app` |
| Slug | `21-blaze` |
| Scheme | `twentyoneblaze` |
| Report date | 2026-07-23 |

---

## Recommendation

**CONDITIONAL** — Solo-focused internal testing can proceed **once** the EAS project is linked (real `projectId`) and preview APK/IPA are produced.  
**Do not claim ready** until those builds exist and critical Solo + Test Store paths are exercised on device.

---

## Build status

| Target | Status |
|--------|--------|
| Android EAS (`preview` / `development`) | **NOT RUN** — blocked by missing EAS auth (`EXPO_TOKEN` / `eas login`) and placeholder `projectId` `00000000-0000-0000-0000-000000000000` in `app.json` |
| iOS EAS (`preview` / `development`) | **NOT RUN** — same blockers + Apple credentials unavailable in this environment |
| Android device-test | **NOT RUN** |
| iOS device-test | **NOT RUN** |

---

## Monetization / ads status

| Item | Status |
|------|--------|
| RevenueCat Test Store | **CODE READY**; dashboard + native Test Store purchase **NOT verified** in this environment |
| Purchase / restore test results | **NOT RUN** (requires native preview build) |
| Products (client) | `blaze_ad_free`, `blaze_inferno_pack`, `blaze_neon_pack`, `blaze_founders_pack` |
| Interstitial ads | Configured with Google **TEST** IDs only (Ad-Free verification) |
| Production store / production AdMob | **Disabled** for this beta |

---

## Feature freeze for Internal Beta (preview/dev)

| Feature | Beta status |
|---------|-------------|
| Solo Play / local scores / Settings / How to Play | **ENABLED** |
| Store purchases + Purchase Diagnostics + test interstitials | **ENABLED** (preview/dev) |
| Live Duel / Quick Match / Ranked | **Disabled** — two-device untested; deploy unverified |
| Progression / Daily rewards / Daily missions | **Disabled** — backend deploy unverified |
| Rewarded ads / rewarded currency | **Disabled** — SSV incomplete |
| Multiplayer | **Disabled for beta** |

---

## Backend

| Item | Status |
|------|--------|
| Remote Supabase migrations `0001`–`0007` | **Deployment unverified** |
| Edge functions remote deploy | **Unverified** |
| Anonymous auth / local fallback | Code path present; Solo never gated |

---

## Defect counts

| Severity | Count |
|----------|-------|
| P0 confirmed | **0** |
| P1 open | See list below |

### Open P1 items

1. **EAS identity / auth** — placeholder `projectId`; no `EXPO_TOKEN` / `eas login` in this environment → cannot run `eas build`  
2. **Apple credentials** — unavailable here → iOS IPA blocked even after Android auth  
3. **RevenueCat dashboard** — product/offering configuration unverified from this agent  
4. **Purchase / restore on device** — NOT RUN (needs native preview)  
5. **Remote Supabase** — migrations `0001`–`0007` + functions deployment unverified  
6. **AdMob production IDs** — still test IDs (acceptable for Internal Beta preview; **must not** ship in production store binaries)  
7. **Multiplayer / progression** — intentionally OFF; remain open for a later RC, not this Solo beta  

---

## Validation (local agent)

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` | **PASS** |
| `npx expo-doctor` | **PASS** (20/20) |
| `npx expo export --platform web --clear` | **PASS** |
| `npm run test:game` | **PASS** |
| `npm run test:monetization` | **PASS** |
| `npm run test:ranked` | **PASS** |
| `npm run test:progression` | **PASS** |
| `eas build --platform android --profile preview` | **FAILED** — Expo account required (`EXPO_TOKEN` / `eas login`); placeholder `projectId` |
| `eas build --platform ios --profile preview` | **FAILED** — same auth blocker (+ Apple credentials unavailable) |

---

## Explicit non-claims

- No successful EAS Android or iOS build is claimed.  
- No device purchase or restore Pass is claimed.  
- No remote Supabase deploy is claimed.  
- App is **not** production-ready for store submission.  
- Internal Beta readiness is **conditional** on producing preview binaries after EAS project link + auth.
