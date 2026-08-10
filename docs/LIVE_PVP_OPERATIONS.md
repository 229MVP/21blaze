# Live PvP Operations (v1.5 Phase 1)

Do not store production secrets in this document.

## Version decisions

| Component | Version / note |
|-----------|----------------|
| `@supabase/supabase-js` | `2.109.0` (installed) |
| Supabase CLI (npx) | `2.113.0` |
| Migration | `20260810143545_v1_5_phase1_live_pvp_foundation.sql` via `supabase migration new` |
| Realtime | Private channels + `realtime.send` private broadcasts; Presence optional |
| Schema | Application tables in `public` as `live_pvp_*` — **not** legacy `live_matches` |
| `realtime` schema | No app tables/functions/triggers created there; only RLS policies on `realtime.messages` |

## Enable / disable

```sql
UPDATE public.app_configuration
SET value = 'false'::jsonb, updated_at = now()
WHERE key = 'live_pvp_creation_enabled';
```

Or set `enabled: false` inside `live_pvp_config`.

Client flag: `EXPO_PUBLIC_ENABLE_LIVE_PVP` (default false). Harness is `__DEV__` only.

## Realtime project settings

1. Confirm Realtime Authorization is available on the project.
2. Keep legacy `live-match:{id}` policies for the dormant friend/quick/ranked beta.
3. New policies: `live_pvp_realtime_select`, `live_pvp_realtime_presence_insert`.
4. **Disable “Allow public access”** only after auditing all existing channels (legacy Live Duel, any other public topics). Document the change in the release notes before flipping.

## Required policies

- SELECT broadcast+presence for `is_live_pvp_participant(topic)`
- INSERT presence only for participants
- No authenticated INSERT for broadcast

## Inspect stuck matches

```sql
SELECT id, status, state_version, expires_at, scheduled_start_at, submission_grace_until
FROM public.live_pvp_matches
WHERE status IN ('invited', 'lobby', 'countdown', 'active', 'settling')
ORDER BY created_at DESC
LIMIT 50;
```

## Deadline finalizer

```sql
SELECT public.finalize_live_pvp_deadlines(20);
```

Schedule via cron / Edge Function. Safe to re-run. Prefer service_role for workers; authenticated grant exists for opportunistic bounded calls.

## Release stale active slots

```sql
SELECT public.reconcile_live_pvp_active_slots(100);
```

## Invalidate a broken match

Service-role SQL with audit note:

```sql
UPDATE public.live_pvp_matches
SET status = 'invalid', state_version = state_version + 1, updated_at = now()
WHERE id = '<match-uuid>'
  AND status IN ('invited', 'lobby', 'countdown', 'active', 'settling');

UPDATE public.live_pvp_participants
SET active_slot = false, updated_at = now()
WHERE match_id = '<match-uuid>';
```

## Protocol / rules / deck rollout

1. Update `live_pvp_config` JSON.
2. Ship clients that understand new versions.
3. In-flight matches keep snapshotted values.

## Monitoring

Watch: `LIVE_PVP_DISABLED`, `ACTIVE_MATCH_LIMIT`, `PROGRESS_RATE_LIMITED`, finalizer `processed` counts, channel auth failures.

Log matchId / eventId / error codes only — never seeds, tokens, or service-role keys.

## Scaling

- Progress cadence ≥ `progressMinimumIntervalMs` (default 1000ms)
- Finalizer batch ≤ 50 with `SKIP LOCKED`
- One active slot per player (unique partial index)

## Rollback

1. Disable creation flag.
2. Keep `EXPO_PUBLIC_ENABLE_LIVE_PVP=false`.
3. Do not drop tables with live data.
4. Legacy Live Duel stack remains independently gated.

## Manual configuration checklist

- [ ] Apply migration `20260810143545_v1_5_phase1_live_pvp_foundation.sql`
- [ ] Verify `realtime.send` available on project
- [ ] Verify Realtime Auth policies created
- [ ] Decide whether to disable public Realtime access (after audit)
- [ ] Schedule `finalize_live_pvp_deadlines`
- [ ] Confirm service-role key not in mobile bundle


## Phase 2 operations

- Apply migration `20260810151826_v1_5_phase2_live_pvp_playable.sql` after Phase 1.
- Client flag `EXPO_PUBLIC_ENABLE_LIVE_PVP` still defaults false.
- Server creation kill switch via `get_live_pvp_ops_status` / config flags.
- Manual two-device matrix: `docs/LIVE_PVP_PHASE_2_QA.md` (do not mark unrun cases Pass).
- Dev harness remains available under Settings when `__DEV__`.
