# Version 1.5 QA Build Report — Shared Staging Promotion

**Branch:** `cursor/v1-5-shared-staging-qa-builds-1a6b`  
**Source:** `cursor/v1-5-release-freeze-exit-gate-1a6b` @ `5edc570`  
**Report date:** 2026-08-11  
**Expo account:** `229mvp` (`devinenoel7@gmail.com`)  
**EAS project:** `@229mvp/21-blaze` (`0c5db163-a4c0-4a17-9a8a-e12eed3bf511`)

## Staging backend target

| Field | Value |
|-------|--------|
| Project name | 21 Blaze |
| Project ref | `ioxydgrcgtvrvoxjtupr` |
| API hostname | `https://ioxydgrcgtvrvoxjtupr.supabase.co` |
| Organization | Draft Picks LLC (`vgcppwnnarfcdxioyyyx`) |
| Classification | Repository-documented shared hosted backend (`docs/DAILY_CHALLENGE_LIVE_VERIFICATION.md`, `docs/V1_5_RC_HANDOFF.md`) — sole permitted migration target for this task |

## EAS `preview` environment (configured)

| Variable | Environment | Visibility | Value in report |
|----------|-------------|------------|-----------------|
| `EXPO_PUBLIC_SUPABASE_URL` | preview | Plain text | `https://ioxydgrcgtvrvoxjtupr.supabase.co` |
| `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | preview | Plain text | Set (redacted — retrieve via `eas env:list`) |
| `EXPO_PUBLIC_REVENUECAT_API_KEY` | preview | (existing) | Set (redacted) |
| `EXPO_PUBLIC_ENABLE_V1_2_VISUAL_SYSTEM` | preview | Plain text | `false` |

Configured with `eas env:create` (preview environment). No service-role or secret Supabase keys in EAS or `EXPO_PUBLIC_*`.

## `live-pvp-qa` profile

| Setting | Value |
|---------|--------|
| EAS environment | `preview` |
| Distribution | internal |
| `EXPO_PUBLIC_ENABLE_LIVE_PVP` | `true` (profile `env` in `eas.json`) |
| `EXPO_PUBLIC_ADMOB_USE_TEST_ADS` | `true` |
| `EXPO_PUBLIC_ENABLE_STORE_PURCHASES` | `false` |
| App version | `1.5.0` |
| iOS buildNumber | `909` |
| Android versionCode | `902` |

## Prebuild verification

| Check | Result |
|-------|--------|
| `eas env:pull --environment preview` | **Passed** — Supabase URL + publishable key present |
| `npx expo config --type public` (with preview env + `EAS_BUILD_PROFILE=live-pvp-qa`) | **Passed** — version 1.5.0, build 909 / 902 |
| `npx tsc --noEmit` | **Passed** |
| `npx expo install --check` | **Passed** |
| `npx expo-doctor` | **Passed** (20/20) |
| Core automated tests | **Passed** (game, monetization, progression, async-duel-release, live-pvp phases 1–3 + release, visual assets) |
| Secret material in public config | **None observed** |

## Internal builds submitted

Install artifact URLs are **not** committed (access-controlled). Use EAS dashboard with build IDs below.

| Platform | Build ID | Profile | Status at report time | Git commit (EAS metadata) | Version |
|----------|----------|---------|----------------------|---------------------------|---------|
| Android | `efe8bfe8-2d8e-4376-81d8-5b74fad9bf41` | live-pvp-qa | In progress | `5edc570` | 1.5.0 (902) |
| iOS | `25ac6125-bec1-48eb-8a28-8b7a9dd20bf5` | live-pvp-qa | In progress | `5edc570` | 1.5.0 (909) |

### iOS credentials (at submit)

- Ad Hoc provisioning profile active; devices registered (2 UDIDs in profile)
- Distribution certificate valid through 2027-07-14
- Apple Team: 9C5LBWL2HS (Devine Noel Individual)

### Android credentials (at submit)

- Remote keystore (Expo server), default credentials `BQMSUyGhY5`
- Output: APK (`buildType: apk`) — directly installable for internal testing

## Staging server flags

| Control | Location | State |
|---------|----------|--------|
| `live_pvp_creation_enabled` | `public.app_configuration` key | **OFF** (`false`) — set after migration default was `true` |
| `live_pvp_config.enabled` | `public.app_configuration` JSON | `true` (feature config present; creation kill switch OFF) |
| Client `EXPO_PUBLIC_ENABLE_LIVE_PVP` (production/testflight profiles) | `eas.json` | **OFF** |
| Client `EXPO_PUBLIC_ENABLE_LIVE_PVP` (`live-pvp-qa`) | `eas.json` | **ON** |

To enable match creation at RC start:

```sql
UPDATE public.app_configuration
SET value = 'true'::jsonb
WHERE key = 'live_pvp_creation_enabled';
```

(Run on shared staging only when beginning two-device testing.)

## Gate summary

| Gate | Status |
|------|--------|
| Shared staging migration | **Passed** |
| Privilege verification | **Passed** |
| `enqueue_player_notification` overload fix | **Passed** (new migration applied) |
| Security advisors (CLI) | **Failed** — `SUPABASE_DB_PASSWORD` required for `db advisors` |
| EAS preview Supabase config | **Passed** |
| Android internal build | **In progress** at report time |
| iOS internal build | **In progress** at report time |
| Physical two-device QA | **Not executed** |
