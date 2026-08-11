# Version 1.5 Staging Database Report

This file merges exit-gate findings (merged from `cursor/v1-5-release-freeze-1a6b`) with the RC validation branch snapshot. For shared staging promotion results, see `cursor/v1-5-shared-staging-qa-builds-1a6b` when available.

## RC validation branch snapshot (initial attempt)

**Status at RC branch creation:** **UNPERFORMED — staging project not linked**

The RC validation agent could not positively identify the 21 Blaze staging project via available MCP connections. See `docs/V1_5_RC_VALIDATION_REPORT.md` for the full RC decision (`NOT READY — BLOCKERS REMAIN` at that time).

| MCP server | Project URL | 21blaze match |
|------------|-------------|---------------|
| `supabase` | `https://qpxtntvnripddmspsckp.supabase.co` | **No** |
| `DraftsPicks.com` | `https://mgplqovylfaziwnugzvh.supabase.co` | **No** |
| `Undefeated Draft Picks` | `https://wckflnjvzyppctkzlqkc.supabase.co` | **No** |

**Action required (at RC time):** Link the 21blaze **staging** project before applying v1.5 migrations.

---

## Exit Gate — preview branch replay

**Branch:** `cursor/v1-5-release-freeze-exit-gate-1a6b`  
**Baseline commit:** `a8ffef0` (from `origin/cursor/v1-5-release-freeze-1a6b`)  
**Report date:** 2026-08-10  
**Agent environment:** Cloud (Docker unavailable)

### Environment identity (non-production)

| Item | Value |
|------|--------|
| Parent project | **21 Blaze** — ref `ioxydgrcgtvrvoxjtupr` (hosted staging/production data; **not modified** by exit gate) |
| Disposable preview branch | **v15-exit-gate** — ref `cotjuvmgcsgzuqkaimqa` |
| Parent proof | Named "21 Blaze" in Supabase dashboard; documented in `docs/DAILY_CHALLENGE_LIVE_VERIFICATION.md` |
| Preview proof | Branch `v15-exit-gate` with `with_data: false`, parent `ioxydgrcgtvrvoxjtupr`, `ACTIVE_HEALTHY` |
| Production | **No** `db push`, reset, or migration applied to parent `ioxydgrcgtvrvoxjtupr` during exit gate |

### Docker / local replay

| Step | Status | Notes |
|------|--------|-------|
| Docker available | **Not executed** | `docker: command not found` |
| `supabase start` / `supabase db reset` | **Not executed** | Requires Docker |
| Fresh migration replay (local) | **Not executed** | Blocked by Docker |

### Remote migration replay (preview branch)

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

### Parent project state at exit gate (unchanged)

| Step | Status | Result |
|------|--------|--------|
| `npx supabase migration list` on `ioxydgrcgtvrvoxjtupr` | **Executed** | Remote at `0012`; `0013`–`20260810185335` **pending** |
| `db push` to parent | **Not executed** | Safety rule during exit gate |

### Database tests and lint (preview)

| Command | Status | Result |
|---------|--------|--------|
| Migration inline assertions | **Executed — passed** | In `20260810185335` during `db push` |
| `npx supabase db query --linked -f scripts/livePvpPrivilegeVerification.sql` | **Executed — partial** | CLI returns last query only; `pgcrypto` extension confirmed present |
| `npx supabase db lint --linked` | **Executed — findings** | See `docs/V1_5_PRIVILEGE_VERIFICATION_REPORT.md` |
| `npx supabase db advisors --linked` | **Executed — failed** | `SUPABASE_DB_PASSWORD` / `cli_login_postgres` auth failure on preview |

### Warnings captured from `db lint` (preview)

| Function / area | Level | Summary | v1.5 Live PvP relevance |
|-----------------|-------|---------|-------------------------|
| `enqueue_player_notification` overload | ERROR | 7-arg vs 9-arg ambiguity in async duel paths | Fixed in shared-staging promotion (`20260811140153`) |
| `gen_random_bytes` in `live_pvp_try_schedule_countdown` | ERROR | Static lint cannot resolve `pgcrypto` | **Likely false positive** — `pgcrypto` present on replayed DB |
| `room_code` ambiguity | ERROR | `try_create_quick_match` / `try_create_ranked_match` | Legacy live match; pre-v1.5 |
| `get_weekly_leaderboard` | ERROR | `ranked` relation in lint context | Pre-v1.5 daily challenge lint artifact |

### Expected migration order (22 files)

`0001` … `0018` → `20260810143545` → `20260810151826` → `20260810183000` → `20260810185335`

Privilege closure SHA-256: `e755e2d97346e6a4123259ebc084a8d86ea65c45948d2be282a7ff6ecefa05fa`

### Staging verification checklist (when linked)

- [ ] `supabase migration list` matches repo
- [ ] `has_function_privilege` matrix for Live PvP RPCs
- [ ] `anon` denied on `finalize_live_pvp_deadlines`
- [ ] `enqueue_player_notification` overloads service_role only
- [ ] RLS on all `live_pvp_*` tables
- [ ] Rematch idempotency + record isolation (two test users)
- [ ] Realtime participant isolation (A/B join, C rejected)
- [ ] Seed not in notifications/records before countdown
- [ ] Service-role finalizer cron on staging
