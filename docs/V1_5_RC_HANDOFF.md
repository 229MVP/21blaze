# Version 1.5 RC Handoff — Shared Staging + QA Builds

**Branch:** `cursor/v1-5-shared-staging-qa-builds-1a6b`  
**Source:** `cursor/v1-5-release-freeze-exit-gate-1a6b` @ `5edc570`  
**Report date:** 2026-08-11

## Final decision

### `READY WITH DOCUMENTED RISKS — FLAGS REMAIN OFF`

Shared staging promotion, privilege verification, overload fix, and EAS preview configuration **passed**. Internal `live-pvp-qa` builds were **submitted** but were **in progress** at report time — install artifacts not yet confirmed. CLI security advisors on 21 Blaze remain blocked without database password. Staging match-creation kill switch is **OFF**.

**Two-device RC validation:** **May begin** after confirming at least one installable build artifact (Android APK and/or iOS Ad Hoc) and optionally enabling `live_pvp_creation_enabled` on staging.

## Completed gates

| Gate | Status |
|------|--------|
| Shared staging migration to v1.5 + overload fix | **Passed** |
| Privilege API verification (all roles) | **Passed** |
| `enqueue_player_notification` overload | **Fixed** |
| EAS preview Supabase URL + publishable key | **Configured** |
| Automated app checks | **Passed** |
| Expo Doctor | **Passed** (20/20) |
| `live-pvp-qa` builds submitted | **In progress** |
| `db advisors` on 21 Blaze | **Failed** (credentials) |
| Physical two-device QA | **Not executed** |

## Staging identity

- **21 Blaze** — `ioxydgrcgtvrvoxjtupr` — `https://ioxydgrcgtvrvoxjtupr.supabase.co`
- Organization: Draft Picks LLC (`vgcppwnnarfcdxioyyyx`)

## Flag state

| Control | State |
|---------|--------|
| `app_configuration.live_pvp_creation_enabled` (staging) | **OFF** (`false`) |
| `EXPO_PUBLIC_ENABLE_LIVE_PVP` (testflight / production) | **OFF** |
| `EXPO_PUBLIC_ENABLE_LIVE_PVP` (`live-pvp-qa`) | **ON** |

## Build IDs (see EAS dashboard for install URLs)

| Platform | Build ID | Status at report |
|----------|----------|------------------|
| Android | `efe8bfe8-2d8e-4376-81d8-5b74fad9bf41` | In progress |
| iOS | `25ac6125-bec1-48eb-8a28-8b7a9dd20bf5` | In progress |

Detail: `docs/V1_5_QA_BUILD_REPORT.md`

## Human actions before two-device RC

1. Confirm EAS builds finished and install APK / iOS Ad Hoc on test devices.
2. Run `UPDATE app_configuration SET value = 'true'::jsonb WHERE key = 'live_pvp_creation_enabled'` on staging when starting RC.
3. Provide `SUPABASE_DB_PASSWORD` to run `db advisors` if required for sign-off.
4. Complete two-device matrix (separate task).

## Related documents

- `docs/V1_5_QA_BUILD_REPORT.md`
- `docs/V1_5_STAGING_DATABASE_REPORT.md`
- `docs/V1_5_PRIVILEGE_VERIFICATION_REPORT.md`
- `docs/V1_5_RELEASE_VALIDATION_REPORT.md`
