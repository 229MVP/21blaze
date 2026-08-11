# Version 1.5 Staging Database Report — Exit Gate

**Branch:** `cursor/v1-5-release-freeze-exit-gate-1a6b`  
**Baseline commit:** `a8ffef0` (from `origin/cursor/v1-5-release-freeze-1a6b`)  
**Report date:** 2026-08-10  
**Agent environment:** Cloud (Docker unavailable)

## Environment identity (non-production)

| Item | Value |
|------|--------|
| Parent project | **21 Blaze** — ref `ioxydgrcgtvrvoxjtupr` (hosted staging/production data; **not modified** by this task) |
| Disposable preview branch | **v15-exit-gate** — ref `cotjuvmgcsgzuqkaimqa` |
| Parent proof | Named "21 Blaze" in Supabase dashboard; documented in `docs/DAILY_CHALLENGE_LIVE_VERIFICATION.md` |
| Preview proof | Branch `v15-exit-gate` with `with_data: false`, parent `ioxydgrcgtvrvoxjtupr`, `ACTIVE_HEALTHY` |
| Production | **No** `db push`, reset, or migration applied to parent `ioxydgrcgtvrvoxjtupr` |

## Docker / local replay

| Step | Status | Notes |
|------|--------|-------|
| Docker available | **Not executed** | `docker: command not found` |
| `supabase start` / `supabase db reset` | **Not executed** | Requires Docker |
| Fresh migration replay (local) | **Not executed** | Blocked by Docker |

## Remote migration replay (preview branch)

| Step | Status | Result |
|------|--------|--------|
| Create preview branch `v15-exit-gate` | **Executed — passed** | Reused existing branch from prior session |
| `npx supabase link --project-ref cotjuvmgcsgzuqkaimqa` | **Executed — passed** | |
| `npx supabase migration list --linked` | **Executed — passed** | All local migrations through `20260810185335` match remote |
| `npx supabase db push --yes` (prior session) | **Executed — passed** | Applied `0013`–`0018` + Live PvP `20260810143545` … `20260810185335` |
| Privilege closure migration | **Executed — passed** | `20260810185335_v1_5_live_pvp_privilege_closure.sql` applied; inline `has_function_privilege` DO block ran during push |

### Migration chain verified on preview

1. `0001` … `0018` (v1.4 baseline)
2. `20260810143545_v1_5_phase1_live_pvp_foundation.sql`
3. `20260810151826_v1_5_phase2_live_pvp_playable.sql`
4. `20260810183000_v1_5_phase3_live_pvp_resilience.sql`
5. `20260810185335_v1_5_live_pvp_privilege_closure.sql`

## Parent project state (unchanged)

| Step | Status | Result |
|------|--------|--------|
| `npx supabase migration list` on `ioxydgrcgtvrvoxjtupr` | **Executed** | Remote at `0012`; `0013`–`20260810185335` **pending** |
| `db push` to parent | **Not executed** | Safety rule: no destructive/push to production-linked host without human approval |
| `db push --dry-run` to parent | **Not executed** | Requires `SUPABASE_DB_PASSWORD` for CLI postgres role |

## Upgrade path

| Path | Status | Notes |
|------|--------|-------|
| Fresh replay on empty DB | **Executed — passed** | Preview branch `with_data: false` + full push |
| Upgrade from parent at `0012` | **Executed — passed** | Same push applied delta `0013`–`20260810185335` on preview forked from parent schema at `0012` |

## Database tests and lint

| Command | Status | Result |
|---------|--------|--------|
| Migration inline assertions | **Executed — passed** | In `20260810185335` during `db push` |
| `npx supabase db query --linked -f scripts/livePvpPrivilegeVerification.sql` | **Executed — partial** | CLI returns last query only; `pgcrypto` extension confirmed present |
| `npx supabase db lint --linked` | **Executed — findings** | See security section in `docs/V1_5_PRIVILEGE_VERIFICATION_REPORT.md` |
| `npx supabase db advisors --linked` | **Executed — failed** | `SUPABASE_DB_PASSWORD` / `cli_login_postgres` auth failure on preview |

## Warnings captured from `db lint`

| Function / area | Level | Summary | v1.5 Live PvP relevance |
|-----------------|-------|---------|-------------------------|
| `enqueue_player_notification` overload | ERROR | 7-arg vs 9-arg ambiguity in async duel paths | Indirect — async duel notifications; not Live PvP RPC surface |
| `gen_random_bytes` in `live_pvp_try_schedule_countdown` | ERROR | Static lint cannot resolve `pgcrypto` | **Likely false positive** — `pgcrypto` present on replayed DB |
| `room_code` ambiguity | ERROR | `try_create_quick_match` / `try_create_ranked_match` | Legacy live match; pre-v1.5 |
| `get_weekly_leaderboard` | ERROR | `ranked` relation in lint context | Pre-v1.5 daily challenge lint artifact |
| Many `search_path` / IMMUTABLE warnings | WARN | Broad codebase | Documented; not introduced by v1.5 closure migration |

## Cleanup

| Item | Status |
|------|--------|
| Delete preview branch `v15-exit-gate` | **Awaiting human** | Retain for RC QA against `cotjuvmgcsgzuqkaimqa` until parent staging is migrated |

## Human actions required

1. Apply pending migrations to shared **21 Blaze** staging (`ioxydgrcgtvrvoxjtupr`) after RC sign-off process — **not** during this exit gate.
2. Provide `SUPABASE_DB_PASSWORD` (or dashboard SQL) to run full `livePvpPrivilegeVerification.sql` and `db advisors` on the verified environment.
3. Optionally delete preview branch after parent staging replay is confirmed.
