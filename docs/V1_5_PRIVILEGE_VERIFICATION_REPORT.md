# Version 1.5 Privilege Verification Report — Exit Gate

**Environment tested:** Supabase preview branch `v15-exit-gate` (`cotjuvmgcsgzuqkaimqa`)  
**Migration:** `20260810185335_v1_5_live_pvp_privilege_closure.sql` applied  
**Report date:** 2026-08-10

## Summary

| Role | API verification (`npm run test:live-pvp-privileges`) | SQL `has_function_privilege` file |
|------|-----------------------------------------------------|-----------------------------------|
| `anon` | **Passed** | Partial (CLI query runner limitation) |
| `authenticated` | **Passed** | Partial |
| `service_role` | **Passed** | Partial |

**Realtime private channel isolation:** **Not executed** — requires two subscribed clients in a live match (physical-device / RC QA scope).

## API verification method

```bash
SUPABASE_URL=https://cotjuvmgcsgzuqkaimqa.supabase.co \
SUPABASE_ANON_KEY=<anon> \
SUPABASE_SERVICE_ROLE_KEY=<service_role> \
npm run test:live-pvp-privileges
```

Script: `scripts/livePvpPrivilegeApiVerification.ts`

## Results by role

### Anonymous (`anon`)

| Action | Expected | Actual | Status |
|--------|----------|--------|--------|
| `get_live_pvp_ops_status` | Denied | `permission denied for function get_live_pvp_ops_status` | **PASS** |
| `finalize_live_pvp_deadlines` | Denied | `permission denied` | **PASS** |
| `get_live_pvp_snapshot` | Denied | `permission denied` | **PASS** |
| `SELECT live_pvp_matches` | Denied | `permission denied for table live_pvp_matches` | **PASS** |

### Authenticated participant (signed-in user, not in match)

| Action | Expected | Actual | Status |
|--------|----------|--------|--------|
| `get_live_pvp_ops_status` | Allowed | OK | **PASS** |
| `get_live_pvp_server_time` | Allowed | OK | **PASS** |
| `finalize_live_pvp_deadlines` | Denied | `permission denied` | **PASS** |
| `live_pvp_settle_match` | Denied | `permission denied` | **PASS** |
| `get_live_pvp_snapshot` (fake match id) | Denied / not found | `MATCH_NOT_FOUND` | **PASS** |
| `SELECT live_pvp_matches` (direct) | Denied | `permission denied` | **PASS** |
| `INSERT live_pvp_events` | Denied | `permission denied` | **PASS** |

### Authenticated gameplay allowlist (invite → accept → play)

| Action | Expected | Actual | Status |
|--------|----------|--------|--------|
| Full participant RPC flow with unrelated match rejection | Allowed / rejected appropriately | **Not executed** | Requires `live_pvp_creation_enabled` ON and two test users — deferred to RC QA |

### Service role

| Action | Expected | Actual | Status |
|--------|----------|--------|--------|
| `finalize_live_pvp_deadlines` | Allowed | OK | **PASS** |
| `reconcile_live_pvp_active_slots` | Allowed | OK | **PASS** |

Internal helpers (`live_pvp_record_and_broadcast`, `live_pvp_try_schedule_countdown`, etc.) are **not** exposed as client RPCs with row-type signatures; closure migration **REVOKE**s `authenticated`/`anon` **EXECUTE** — verified indirectly via migration assertions and deny tests above.

## SQL file (`scripts/livePvpPrivilegeVerification.sql`)

| Check | Status |
|-------|--------|
| Full multi-row output via `npx supabase db query --linked -f` | **Partial** — CLI surfaced only final query (`ext_pgcrypto` = true) |
| Inline migration DO block (`has_function_privilege`) | **Executed — passed** during `db push` |

## Database security lint (`npx supabase db lint --linked`)

Run against preview branch. **Not all findings are v1.5 regressions.**

| Category | Finding | Assessment |
|----------|---------|------------|
| Live PvP privilege closure | No lint ERROR on closure grants themselves | Acceptable |
| `enqueue_player_notification` ambiguity | ERROR on async duel notification calls | **Open** — pre-existing overload conflict; fix in forward migration |
| `gen_random_bytes` in `live_pvp_try_schedule_countdown` | ERROR in static lint | **Acceptable as lint artifact** — `pgcrypto` installed on replayed DB |
| `security definer` + mutable `search_path` (many functions) | WARN | Legacy; tracked; not gate-blocking for Live PvP closure |
| RLS on `live_pvp_*` tables | Direct table access denied in API tests | Acceptable |

## Security advisors

| Method | Status |
|--------|--------|
| `npx supabase db advisors --linked` (preview) | **Failed** — `cli_login_postgres` password auth; set `SUPABASE_DB_PASSWORD` |
| MCP `get_advisors` (supabase server) | **Wrong project** — returned Draft Picks / KYC lints, not 21 Blaze |

**Critical unexplained findings on 21 Blaze:** None verified via API privilege tests. Lint ERROR on `enqueue_player_notification` affects async duel notification paths and should be fixed before production async-duel notification traffic at scale.

## Realtime

| Check | Status |
|-------|--------|
| Private channel subscribe (valid participant) | **Not executed** |
| Private channel subscribe (non-participant) | **Not executed** |
| Client broadcast row insertion | **Blocked** — events table INSERT denied for authenticated user |
