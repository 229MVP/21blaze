# Version 1.5 Release Validation Report

**Branch:** `cursor/v1-5-shared-staging-qa-builds-1a6b`  
**Source:** `cursor/v1-5-release-freeze-exit-gate-1a6b` @ `5edc570`  
**Report date:** 2026-08-11

## Release decision

### `READY FOR TWO-DEVICE RC QA`

Shared staging is promoted, privilege checks passed, both EAS internal builds
finished, and the local RC regression suite passed. Physical two-device results
remain unexecuted and production flags remain off. Database advisors still
require a securely supplied database password and remain a production sign-off
item. See `docs/V1_5_RC_HANDOFF.md`.

## Phase 1 — Baseline

| Check | Result |
|-------|--------|
| Supabase CLI | 2.113.0 |
| EAS CLI | 21.7.1 |
| Expo account | `229mvp` |
| App version | 1.5.0 |
| iOS build | 909 |
| Android versionCode | 902 |
| Staging project | 21 Blaze `ioxydgrcgtvrvoxjtupr` |

## Phase 2 — Expo

| Check | Result |
|-------|--------|
| `npx expo install --check` | PASS |
| `npx expo-doctor` | PASS (20/20) |

## Phase 3 — Migration

| Check | Result |
|-------|--------|
| Shared staging `db push` | PASS — through `20260811140153` |
| Remote head | `20260811140153_enqueue_player_notification_drop_7arg_overload` |

## Phase 4 — Privilege

| Check | Result |
|-------|--------|
| `npm run test:live-pvp-privileges` (staging) | PASS |

## Phase 5 — Security

| Check | Result |
|-------|--------|
| `db lint` enqueue ambiguity | RESOLVED |
| `db advisors` | FAILED (DB password) |

## Phase 6 — EAS / builds

| Check | Result |
|-------|--------|
| Preview env Supabase URL + publishable key | CONFIGURED |
| Android `live-pvp-qa` build | PASS — finished APK (`efe8bfe8-2d8e-4376-81d8-5b74fad9bf41`) |
| iOS `live-pvp-qa` build | PASS — finished IPA (`25ac6125-bec1-48eb-8a28-8b7a9dd20bf5`) |

## RC branch regression refresh

Run on `cursor/v1-5-rc-validation-1a6b` on 2026-08-11:

| Check | Result |
|-------|--------|
| TypeScript (`tsc --noEmit`) | PASS |
| Expo dependency compatibility | PASS |
| Expo Doctor | PASS (20/20) |
| Game, ranked, monetization, progression | PASS |
| Version 1.3 release and Async Duel release | PASS |
| Live PvP phases 1-3 and release suite | PASS |
| Visual asset validation | PASS |

The clean strict dependency install exposed a missing direct declaration for
`expo-constants`, which is imported by `src/services/deviceInfo.ts`. It is now
declared at the Expo SDK 57-compatible range and the type check passes.

## Phase 7 — Flags

| Flag | State |
|------|--------|
| Staging `live_pvp_creation_enabled` | OFF |
| Production client Live PvP | OFF |
