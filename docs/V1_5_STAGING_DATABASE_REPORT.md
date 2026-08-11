# Version 1.5 Staging Database Report — Shared Staging Promotion

**Branch:** `cursor/v1-5-shared-staging-qa-builds-1a6b`  
**Report date:** 2026-08-11

## Environment identity

| Item | Value |
|------|--------|
| Project name | **21 Blaze** |
| Project ref | `ioxydgrcgtvrvoxjtupr` |
| API hostname | `https://ioxydgrcgtvrvoxjtupr.supabase.co` |
| Organization | Draft Picks LLC (`vgcppwnnarfcdxioyyyx`) |
| Classification | Repository-documented shared hosted backend — **not** a separate disposable preview |
| Production | No other 21 Blaze Supabase ref in repository; this is the documented hosted target |

## Migration plan (executed)

Pending range before promotion: after remote `0012` through privilege closure, plus forward overload fix.

| Order | Migration | Primary effects |
|-------|-----------|-----------------|
| 1 | `0013_v1_3_phase3_leaderboards_streaks_rewards.sql` | Leaderboards, streaks, rewards tables/functions |
| 2 | `0014_v1_3_phase4_progression.sql` | Progression RPCs and policies |
| 3 | `0015_v1_4_phase1_async_duel_foundation.sql` | Async duel schema |
| 4 | `0016_v1_4_phase2_async_duel_playable.sql` | Async duel gameplay RPCs |
| 5 | `0017_v1_4_phase3_async_duel_notifications.sql` | Notifications, `enqueue_player_notification` (7-arg) |
| 6 | `0018_v1_4_release_freeze_safeguards.sql` | Async duel safeguards, enqueue update |
| 7 | `20260810143545_v1_5_phase1_live_pvp_foundation.sql` | Live PvP tables, RLS, Realtime policies, core RPCs |
| 8 | `20260810151826_v1_5_phase2_live_pvp_playable.sql` | Hub/ops RPCs, enqueue 9-arg overload |
| 9 | `20260810183000_v1_5_phase3_live_pvp_resilience.sql` | Rematch, records, snapshot hardening |
| 10 | `20260810185335_v1_5_live_pvp_privilege_closure.sql` | REVOKE/GRANT closure, inline privilege assertions |
| 11 | `20260811140153_enqueue_player_notification_drop_7arg_overload.sql` | DROP obsolete 7-arg enqueue overload |

**Data-destructive statements:** None in pending v1.5 migrations (DDL additive + grants). No `db reset` on remote.

**Locking risks:** Standard migration locks on new tables/indexes; applied during promotion window.

**Realtime:** Live PvP private channel authorization policies in phase 1 foundation.

**Rollback:** Forward-only; overload fix is additive DROP of duplicate function.

## Promotion result

| Step | Status |
|------|--------|
| `npx supabase link --project-ref ioxydgrcgtvrvoxjtupr` | **Passed** |
| `npx supabase migration list --linked` (pre) | Remote `0012`; pending `0013`–`20260810185335` |
| `npx supabase db push --linked --yes` | **Passed** — 10 migrations applied |
| `npx supabase db push` (overload fix) | **Passed** — `20260811140153` applied |
| Remote migration head | **`20260811140153_enqueue_player_notification_drop_7arg_overload`** |
| `live_pvp_creation_enabled` default after migration | `true` → **set to `false`** for RC safety |

## Smoke queries (post-promotion)

| Check | Result |
|-------|--------|
| `enqueue_player_notification` overload count | **1** (9-arg only) |
| `pgcrypto` extension | **Present** |
| `live_pvp_matches` RLS | Enabled; direct client access denied (API tests) |

## Lint (`npx supabase db lint --linked`)

Remaining ERROR-level findings (legacy / static-analysis artifacts):

- `room_code` ambiguity in quick/ranked match functions (pre-v1.5)
- `ranked` relation in weekly leaderboard lint context
- `gen_random_bytes` in static lint for async duel / live PvP countdown (`pgcrypto` present at runtime)

`enqueue_player_notification` ambiguity: **resolved** after overload DROP migration.

## Advisors

`npx supabase db advisors --linked`: **Failed** — CLI postgres role password (`SUPABASE_DB_PASSWORD`) not available in agent environment.

## Docker / local replay

**Not executed** — Docker unavailable in agent environment.
