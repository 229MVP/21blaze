# RC 0.9.0 Readiness Report — 21 Blaze

**Verdict: NO-GO for store submission.**  
Internal native preview / TestFlight–Play testing is **blocked by P1-1** (EAS `projectId` placeholder).  
This report reflects code hardening on the named branch — it does **not** claim remote deployment success, sandbox purchase success, or EAS build success.

| Field | Value |
|-------|-------|
| Release | Production RC 0.9.0 |
| Branch | `cursor/rc-0-9-0-1a6b` |
| Commit | `TBD_COMMIT` |
| Version in repo | **`0.9.0`** (`versionCode` / `buildNumber` = `900`) |
| Bundle ID | `com.twentyoneblaze.app` |
| Feature freeze | Active — [FEATURE_FREEZE.md](./FEATURE_FREEZE.md) |
| Report date | 2026-07-23 |

---

## Executive summary

Hardening landed: version bump, RevenueCat client remap, local migration `0007` (verified solo coins + Founders→neon), feature flags default OFF with production-safe EAS profile, ErrorBoundary, auth retry, PurchaseDiagnostics (non-prod).  

Store/production readiness remains blocked by placeholder EAS identity, AdMob test IDs, unverified RevenueCat dashboard, unverified remote Supabase (incl. `0007`), untested purchases, and untested two-device multiplayer.

**Open P0:** none confirmed.  
**Open P1:** P1-1 EAS projectId; P1-2 AdMob test IDs; P1-3 RC dashboard unverified (code remapped); P1-4 remote deploy unverified; P1-5 purchases untested; P1-6 two-device untested; P1-7 `0007` local only / remote pending.

---

## Build & validation results

| Check | Result |
|-------|--------|
| EAS iOS build | **Not run / blocked by EAS projectId** (`00000000-0000-0000-0000-000000000000`) |
| EAS Android build | **Not run / blocked by EAS projectId** |
| Native store binary validation | **Not run / blocked by EAS projectId** |
| Web export | In progress — **not claimed succeeded** |
| TypeScript (`tsc --noEmit`) | **PASS** |
| Expo doctor | In progress — **not claimed succeeded** |
| `npm run test:game` | **PASS** |
| `npm run test:ranked` | **PASS** |
| `npm run test:monetization` | **PASS** |
| `npm run test:progression` | **PASS** |
| Purchase sandbox | **Not performed** |
| Two-device multiplayer | **Not performed** |
| Remote Supabase migrate/deploy | **Unverified** (local `0001`–`0007` present) |
| Secrets printed | **None** (`.env.example` updated) |

---

## System readiness (condensed)

| Area | Readiness | Notes |
|------|-----------|-------|
| Solo game | Code ready; online unverified | Self-test PASS |
| Auth | Improved | Local fallback; Retry Online; promise cleared on failure |
| Live / Quick / Ranked | Code local; QA missing | Default OFF; production EAS OFF; two-device P1 |
| Wallet / coins | Local fix pending remote | `0007` uses `verified_scores`; casual/ranked still client formulas |
| IAP / RevenueCat | Code remapped; sandbox untested | `blaze_*` products; offering `default`; dashboard unverified |
| Pro subs | Present | Freeze — do not expand |
| Ads | Not store-ready | Google TEST app IDs in `app.json`; rewarded currency OFF |
| Progression / dailies | Code local | Deploy unverified; flags default OFF |
| ErrorBoundary | Done | Wraps NavigationContainer |
| PurchaseDiagnostics | Done | Dev/preview only; refuses production |
| Account deletion | Missing | Compliance plan only |
| RLS write protection | Designed OK | Client wallet/XP/score writes blocked in migrations |

---

## P1 detail (must close)

1. **EAS projectId placeholder** — blocks meaningful native preview/store builds.  
2. **AdMob test IDs** — must not ship in store binaries.  
3. **RevenueCat dashboard unverified** — client uses `blaze_ad_free` / pack IDs; packages `ad_free`/`inferno`/`neon`/`founders`; Founders unlocks founders+ad_free+inferno+neon. Dashboard/store products not confirmed.  
4. **Remote deployment unverified** — migrations and edge functions local only.  
5. **Purchase sandbox untested** — no Pass evidence.  
6. **Multiplayer two-device untested** — no Pass evidence.  
7. **Solo coin / Founders server fix** — `0007_rc_solo_coin_verified.sql` present locally; **remote apply pending**.

---

## P2 highlights

| ID | Status |
|----|--------|
| P2-1 Casual/Ranked unverified coin UI | Open |
| P2-2 ErrorBoundary | **Done** |
| P2-3 Auth retry | **Done** |
| P2-4 Version 0.9.0 | **Done** |
| P2-5 Flags default OFF | **Done** |
| P2-6 Native EAS builds | Open (blocked by P1-1) |
| P2-7 Deletion / privacy | Open |
| P2-8 Native/web parity | Open |

Full list: [PRODUCTION_BLOCKERS.md](./PRODUCTION_BLOCKERS.md).

---

## Documentation set for RC

| Doc | Purpose |
|-----|---------|
| [PRODUCTION_FEATURE_INVENTORY.md](./PRODUCTION_FEATURE_INVENTORY.md) | System-by-system status |
| [PRODUCTION_BLOCKERS.md](./PRODUCTION_BLOCKERS.md) | P0/P1/P2 + remediation |
| [ENVIRONMENT_VARIABLES.md](./ENVIRONMENT_VARIABLES.md) | Client/server env |
| [SUPABASE_DEPLOYMENT_CHECKLIST.md](./SUPABASE_DEPLOYMENT_CHECKLIST.md) | Migrations + edge functions |
| [DATABASE_ROLLBACK_PLAN.md](./DATABASE_ROLLBACK_PLAN.md) | Rollback options |
| [PURCHASE_TEST_MATRIX.md](./PURCHASE_TEST_MATRIX.md) | IAP sandbox matrix |
| [PRIVACY_DATA_MAP.md](./PRIVACY_DATA_MAP.md) | Data categories |
| [STORE_DISCLOSURE_CHECKLIST.md](./STORE_DISCLOSURE_CHECKLIST.md) | Store questionnaires |
| [ACCOUNT_DELETION_PLAN.md](./ACCOUNT_DELETION_PLAN.md) | Deletion compliance plan |
| [CONTENT_RATING_NOTES.md](./CONTENT_RATING_NOTES.md) | Rating guidance |
| [STORE_METADATA_DRAFT.md](./STORE_METADATA_DRAFT.md) | Listing copy draft |
| [SCREENSHOT_PLAN.md](./SCREENSHOT_PLAN.md) | Screenshot shot list |
| [RC_0_9_MANUAL_TEST_MATRIX.md](./RC_0_9_MANUAL_TEST_MATRIX.md) | Manual QA |
| [RC_0_9_RELEASE_GATES.md](./RC_0_9_RELEASE_GATES.md) | Go/No-Go gates |
| This report | Readiness snapshot |

---

## Recommended next sequence

1. Replace EAS projectId (**P1-1**) — unlocks native preview builds  
2. Swap AdMob to production IDs in `app.json` + env  
3. Align RevenueCat dashboard + store products with client remap  
4. Deploy Supabase migrations `0001`–`0007` + edge functions; run checklist  
5. Execute purchase sandbox + two-device matrices (dev/preview flags)  
6. Re-issue this report with commit hash + evidence; revisit gates  

---

## Explicit non-claims

- Remote Supabase deployment was **not** verified.  
- Migration `0007` was **not** applied remotely (present locally only).  
- Sandbox purchases were **not** tested.  
- Two-device multiplayer was **not** tested.  
- Native EAS builds were **not** run (blocked by projectId).  
- Expo doctor / web export success is **not** claimed.  
- App is **not** production-ready for store submission.
