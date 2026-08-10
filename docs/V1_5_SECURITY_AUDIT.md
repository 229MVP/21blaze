# Version 1.5 Security Audit — Live PvP Privilege Closure

## Client-callable RPC allowlist (`authenticated` only)

| Function | Purpose |
|----------|---------|
| `get_live_pvp_ops_status()` | Ops / kill-switch visibility |
| `get_live_pvp_hub(text, integer, integer)` | Hub sections |
| `create_live_pvp_invite(uuid)` | Send invite |
| `accept_live_pvp_match(uuid)` | Accept |
| `decline_live_pvp_match(uuid)` | Decline |
| `cancel_live_pvp_match(uuid)` | Cancel |
| `set_live_pvp_ready(uuid)` | Ready |
| `get_live_pvp_snapshot(uuid)` | Authoritative snapshot + seed |
| `get_live_pvp_server_time()` | Clock sample |
| `submit_live_pvp_progress(...)` | Progress heartbeat |
| `complete_live_pvp_attempt(...)` | Attempt completion |
| `forfeit_live_pvp_match(uuid)` | Forfeit |
| `create_live_pvp_rematch(uuid)` | Rematch |
| `get_live_pvp_player_record()` | Private record |
| `get_live_pvp_head_to_head_record(uuid)` | H2H record |
| `is_live_pvp_participant(text)` | Realtime RLS helper (`authenticated` + `service_role`) |

## Internal / worker-only (never `authenticated` / `anon`)

| Function | Granted to |
|----------|------------|
| `live_pvp_config()` | `service_role` |
| `live_pvp_creation_enabled()` | `service_role` |
| `assert_live_pvp_transition(text, text)` | `service_role` |
| `live_pvp_record_and_broadcast(...)` | `service_role` |
| `live_pvp_public_participant(uuid)` | `service_role` |
| `live_pvp_try_schedule_countdown(uuid)` | `service_role` |
| `ensure_live_pvp_active(uuid)` | `service_role` |
| `live_pvp_settle_match(uuid)` | `service_role` |
| `finalize_live_pvp_deadlines(integer)` | `service_role` |
| `reconcile_live_pvp_active_slots(integer)` | `service_role` |
| `live_pvp_enforce_participant_identity()` | trigger only (no EXECUTE) |
| `live_pvp_enforce_attempt_identity()` | trigger only (no EXECUTE) |
| `enqueue_player_notification` (7-arg) | `service_role` |
| `enqueue_player_notification` (9-arg) | `service_role` |

## Migration

`20260810185335_v1_5_live_pvp_privilege_closure.sql` — forward-only REVOKE/GRANT + `has_function_privilege` assertions.

## Client trust / anti-cheat limitations

- Progress and completion RPCs trust bounded client-reported counters within server validation rules; not full move-log replay.
- Checkpoint stores full remaining deck for deterministic resume (no rewards/ranking in Live PvP).
- Seed never persisted locally; recovery requires fresh authorized snapshot.
- Presence loss does not forfeit; only explicit forfeit RPC or server deadline finalizer settles.

## Secrets

- Mobile bundle: publishable Supabase URL + anon key only (`src/lib/supabase.ts`).
- No service-role key in tracked source (verified by release self-test grep).
