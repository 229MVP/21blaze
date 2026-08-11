# Version 1.5 Release Validation Report

**Branch:** `cursor/v1-5-shared-staging-qa-builds-1a6b`  
**Source:** `cursor/v1-5-release-freeze-exit-gate-1a6b` @ `5edc570`  
**Report date:** 2026-08-11

## Release decision

### `READY WITH DOCUMENTED RISKS — FLAGS REMAIN OFF`

Shared staging promoted; privilege checks passed; EAS configured; internal builds in progress. See `docs/V1_5_RC_HANDOFF.md`.

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
| Android `live-pvp-qa` build | IN PROGRESS |
| iOS `live-pvp-qa` build | IN PROGRESS |

## Phase 7 — Flags

| Flag | State |
|------|--------|
| Staging `live_pvp_creation_enabled` | OFF |
| Production client Live PvP | OFF |
