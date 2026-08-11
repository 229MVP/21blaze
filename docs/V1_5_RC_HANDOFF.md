# Version 1.5 RC Handoff — Shared Staging + QA Builds

**Branch:** `cursor/v1-5-shared-staging-qa-builds-1a6b`  
**Source:** `cursor/v1-5-release-freeze-exit-gate-1a6b` @ `5edc570`  
**Report date:** 2026-08-11

## Final decision

### `READY FOR TWO-DEVICE RC QA`

Shared staging promotion, privilege verification, overload fix, EAS preview
configuration, both internal builds, and the refreshed local regression suite
**passed**. CLI security advisors on 21 Blaze remain blocked without a securely
supplied database password and are retained as a production sign-off item.
Staging match creation remains **OFF** until the physical RC session begins.

**Two-device RC validation:** **May begin** after installing the completed builds
and explicitly enabling `live_pvp_creation_enabled` on shared staging for the
test window.

## Completed gates

| Gate | Status |
|------|--------|
| Shared staging migration to v1.5 + overload fix | **Passed** |
| Privilege API verification (all roles) | **Passed** |
| `enqueue_player_notification` overload | **Fixed** |
| EAS preview Supabase URL + publishable key | **Configured** |
| Automated app checks | **Passed** |
| Expo Doctor | **Passed** (20/20) |
| Android and iOS `live-pvp-qa` builds | **Passed** — both finished |
| RC branch local regression refresh | **Passed** |
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

| Platform | Build ID | Status |
|----------|----------|------------------|
| Android | `efe8bfe8-2d8e-4376-81d8-5b74fad9bf41` | Finished — installable APK |
| iOS | `25ac6125-bec1-48eb-8a28-8b7a9dd20bf5` | Finished — Ad Hoc IPA |

Detail: `docs/V1_5_QA_BUILD_REPORT.md`

## Human actions before two-device RC

1. Install the completed APK and/or iOS Ad Hoc IPA on two physical devices.
2. Run `UPDATE app_configuration SET value = 'true'::jsonb WHERE key = 'live_pvp_creation_enabled'` on shared staging only when starting RC.
3. Execute `docs/V1_5_TWO_DEVICE_TEST_MATRIX.md` with distinct test accounts.
4. Supply the database password through a secure local prompt to run `db advisors` before production sign-off; never commit or paste it into reports.

## Related documents

- `docs/V1_5_QA_BUILD_REPORT.md`
- `docs/V1_5_STAGING_DATABASE_REPORT.md`
- `docs/V1_5_PRIVILEGE_VERIFICATION_REPORT.md`
- `docs/V1_5_RELEASE_VALIDATION_REPORT.md`
