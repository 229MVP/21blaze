# Version 1.5 RC Validation Report

**Branch:** `cursor/1-5-rc-validation-1a6b`  
**Base:** `origin/cursor/v1-5-release-freeze-1a6b` @ `a8ffef0`  
**Date:** 2026-08-10

## Final decision

**NOT READY — BLOCKERS REMAIN**

Local code/configuration blockers from release-freeze are largely resolved (Expo Doctor, AdMob, permissions). Staging database validation, physical two-device QA, soak testing, and rollback drill remain **unperformed**. Live PvP and server creation flags remain **OFF**.

---

## A. Release baseline

| Item | Value |
|------|--------|
| Base branch | `cursor/v1-5-release-freeze-1a6b` |
| Base commit | `a8ffef001b557889a325744c9e5cf2c01ac24dfb` |
| App version | 1.5.0 |
| iOS buildNumber | 909 |
| Android versionCode | 902 |
| Supabase CLI | 2.113.0 (`npx supabase`) |
| `@supabase/supabase-js` | 2.109.0 (exact) |
| Protocol version | `livePvpConfig` LIVE_PVP_PROTOCOL_VERSION |
| Checkpoint schema | v2 (`LIVE_PVP_CHECKPOINT_SCHEMA_VERSION = 2`) |
| Privilege migration | `20260810185335` SHA-256 `e755e2d9…` |
| Live PvP client flag | OFF (all standard profiles) |
| Server creation | OFF (documented; not enabled in this run) |

## B. Expo SDK alignment

| Package | Before | After |
|---------|--------|-------|
| @expo/metro-runtime | 57.0.8 | ~57.0.9 |
| expo | 57.0.11 | ~57.0.12 |
| expo-asset | 57.0.9 | ~57.0.10 |
| expo-build-properties | 57.0.8 | ~57.0.10 |
| expo-dev-client | 57.0.10 | ~57.0.11 |
| expo-splash-screen | 57.0.5 | ~57.0.6 |
| expo-updates | 57.0.12 | ~57.0.13 |

| Check | Result |
|-------|--------|
| `npx expo install --check` | PASS — up to date |
| `npx expo-doctor` | PASS — 20/20 |

## C. AdMob configuration

| Check | Result |
|-------|--------|
| Environment-specific native IDs | PASS — `app.config.js` |
| Production sample + live ads blocked | PASS — `test:admob-config` |
| Production EAS profile ads disabled until IDs | PASS — see `V1_5_ADMOB_CONFIGURATION_AUDIT.md` |

## D. Native permissions

| Check | Result |
|-------|--------|
| RECORD_AUDIO removed | PASS |
| Foreground service removed | PASS |
| MODIFY_AUDIO_SETTINGS only | PASS (resolved public config) |
| EAS project:info | UNPERFORMED — no EAS auth in agent |

## E. Database

| Check | Result |
|-------|--------|
| Local `supabase db reset` | UNPERFORMED — no Docker |
| Staging project identified | **FAILED** — MCP projects are not 21blaze |
| Staging migration apply | UNPERFORMED |
| Privilege live tests | UNPERFORMED |
| Advisors / lint | UNPERFORMED |

See `V1_5_STAGING_DATABASE_REPORT.md`.

## F. Two-device QA

**UNPERFORMED** — see `V1_5_TWO_DEVICE_TEST_MATRIX.md`.

## G. Soak test

**UNPERFORMED** — see `V1_5_SOAK_TEST_REPORT.md`.

## H. Rollback drill

**UNPERFORMED** on staging — see `V1_5_ROLLBACK_DRILL.md`.

## I. Automated regression

| Command | Result |
|---------|--------|
| `npm run test:game` | PASS |
| `npm run test:countdown-layout` | PASS |
| `npm run test:monetization` | PASS |
| `npm run test:progression` | PASS |
| `npm run test:v1.1-rewards` | PASS |
| `npm run test:v1.1b-locker` | PASS |
| `npm run test:v1.1c-ads` | PASS |
| `npm run test:v1.2a-visual-theme` | PASS |
| `npm run test:daily-challenge` | PASS |
| `npm run test:v1.3-release` | PASS |
| `npm run test:async-duel-phase1` | PASS |
| `npm run test:async-duel-phase2` | PASS |
| `npm run test:async-duel-phase3` | PASS |
| `npm run test:async-duel-release` | PASS |
| `npm run test:live-pvp-phase1` | PASS |
| `npm run test:live-pvp-phase2` | PASS |
| `npm run test:live-pvp-phase3` | PASS |
| `npm run test:live-pvp-release` | PASS |
| `npm run test:admob-config` | PASS |
| `npm run validate:visual-assets` | PASS |
| `npx tsc --noEmit` | PASS |
| `npx expo config --type public` | PASS |
| `git diff --check` | PASS |
| `npm run test:v1.2-startup-hotfix` | UNPERFORMED — not in tree |

## J. Internal build (`live-pvp-qa`)

| Item | Status |
|------|--------|
| Profile configured in `eas.json` | PASS |
| EAS build started | **NOT STARTED** — no credentials / human authorization |
| Staging Supabase URL in profile | **Requires human EAS env** |

## K. Remaining blockers

1. Link and validate 21blaze **staging** Supabase project.
2. Full migration replay + privilege matrix.
3. Physical two-device QA (all combinations).
4. Soak test on staging.
5. Staging rollback drill.
6. EAS project verification + optional `live-pvp-qa` build.
7. Configure production AdMob IDs before enabling production ads.

## L. Documentation created

- `V1_5_RC_VALIDATION_REPORT.md` (this file)
- `V1_5_STAGING_DATABASE_REPORT.md`
- `V1_5_TWO_DEVICE_TEST_MATRIX.md`
- `V1_5_SOAK_TEST_REPORT.md`
- `V1_5_ADMOB_CONFIGURATION_AUDIT.md`
- `V1_5_NATIVE_PERMISSION_AUDIT.md`
- `V1_5_PRODUCTION_CUTOVER_RUNBOOK.md`
- `V1_5_ROLLBACK_DRILL.md`
- `V1_5_FINAL_RELEASE_CHECKLIST.md`

Updated: `V1_5_RELEASE_CHECKLIST.md` (RC section).
