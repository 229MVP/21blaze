# Version 1.5 Privilege Verification Report — Shared Staging

**Environment:** 21 Blaze shared staging (`ioxydgrcgtvrvoxjtupr`)  
**Migration head:** `20260811140153_enqueue_player_notification_drop_7arg_overload`  
**Report date:** 2026-08-11

## Summary

| Role | API verification | SQL `has_function_privilege` file |
|------|------------------|-----------------------------------|
| `anon` | **Passed** | Partial (CLI returns last query row only) |
| `authenticated` (participant context) | **Passed** | Partial |
| `authenticated_unrelated` | **Passed** | Partial |
| `service_role` | **Passed** | Partial |

**Realtime private channel isolation:** **Not executed** (RC QA scope).

## API verification

```bash
SUPABASE_URL=https://ioxydgrcgtvrvoxjtupr.supabase.co \
SUPABASE_ANON_KEY=<anon> \
SUPABASE_SERVICE_ROLE_KEY=<service_role> \
npm run test:live-pvp-privileges
```

### Anonymous

| Action | Expected | Result |
|--------|----------|--------|
| `get_live_pvp_ops_status` | Denied | **PASS** |
| `finalize_live_pvp_deadlines` | Denied | **PASS** |
| `get_live_pvp_snapshot` | Denied | **PASS** |
| `SELECT live_pvp_matches` | Denied | **PASS** |

### Authenticated (signed-in, not in match)

| Action | Expected | Result |
|--------|----------|--------|
| `get_live_pvp_ops_status` | Allowed | **PASS** |
| `get_live_pvp_server_time` | Allowed | **PASS** |
| `finalize_live_pvp_deadlines` | Denied | **PASS** |
| `live_pvp_settle_match` | Denied | **PASS** |
| `get_live_pvp_snapshot` (fake id) | Denied / not found | **PASS** (`MATCH_NOT_FOUND`) |
| `SELECT live_pvp_matches` | Denied | **PASS** |
| `INSERT live_pvp_events` | Denied | **PASS** |

### Authenticated unrelated account

| Action | Expected | Result |
|--------|----------|--------|
| `get_live_pvp_snapshot` | Denied / not found | **PASS** |
| `SELECT live_pvp_matches` | Denied | **PASS** |
| `finalize_live_pvp_deadlines` | Denied | **PASS** |

### Service role

| Action | Expected | Result |
|--------|----------|--------|
| `finalize_live_pvp_deadlines` | Allowed | **PASS** |
| `reconcile_live_pvp_active_slots` | Allowed | **PASS** |

## Notification overload disposition

| Item | Finding |
|------|---------|
| Root cause | Phase 2 added 9-arg `enqueue_player_notification`; 7-arg overload remained |
| RC impact | Async-duel notification `PERFORM` sites could fail with ambiguity at runtime |
| Fix | Migration `20260811140153` DROP 7-arg; retain 9-arg with `p_match_id DEFAULT NULL` |
| Post-fix overload count | **1** |
| `db lint` enqueue errors | **Resolved** |

## Security lint

Critical Live PvP privilege closure: **no new unexplained ERROR** on closure grants.

Remaining lint ERRORs are legacy (quick/ranked `room_code`, weekly leaderboard `ranked` CTE, static `gen_random_bytes`).

## Advisors

CLI `db advisors --linked`: **Not executed** (password auth failure). Privilege closure verified via API + migration inline assertions + `db lint` enqueue resolution.
