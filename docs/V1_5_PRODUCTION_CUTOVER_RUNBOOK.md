# Version 1.5 Production Cutover Runbook

**Approval-gated.** Do not execute without explicit human sign-off.

## Release artifact

| Item | Value |
|------|--------|
| Branch | `cursor/1-5-rc-validation-1a6b` (after RC sign-off merge) |
| App version | 1.5.0 |
| iOS build | ≥ 909 |
| Android versionCode | ≥ 902 |
| Final migration | `20260810185335_v1_5_live_pvp_privilege_closure.sql` |

## Pre-cutover

- [ ] RC validation report: no critical blockers
- [ ] Two-device matrix complete
- [ ] Staging soak complete
- [ ] Production AdMob IDs in EAS **or** production ads remain disabled
- [ ] Database backup / PITR checkpoint confirmed

## Database migration

```bash
# On production project — human operator
supabase link --project-ref <PRODUCTION_REF>
supabase db push
supabase migration list
```

Verification queries:

```sql
-- authenticated must fail
SELECT public.finalize_live_pvp_deadlines(1);

-- service_role worker (edge/cron)
SELECT public.finalize_live_pvp_deadlines(50);
SELECT public.reconcile_live_pvp_active_slots(100);
```

## Initial kill switches

- `live_pvp_creation_enabled` → **false**
- `EXPO_PUBLIC_ENABLE_LIVE_PVP` → **false** on production build

## Realtime

- Audit legacy public channels before disabling “Allow public access”
- Confirm private `live_pvp:*` policies only

## Finalizer

Schedule `finalize_live_pvp_deadlines` via Edge Function / cron with **service_role** only.

## Production smoke (controlled accounts)

1. Cold start, auth restore
2. Solo Play
3. Daily Challenge (if enabled)
4. Async Duel (if enabled)
5. Live PvP **disabled** — hub not reachable

## Feature enablement sequence

1. Deploy client with Live PvP hidden, migrations applied.
2. Production smoke with internal accounts.
3. Enable server creation on staging-like cohort.
4. Enable `EXPO_PUBLIC_ENABLE_LIVE_PVP` on `live-pvp-qa` / limited profile first.
5. Monitor 48h: errors, joins, settlements, finalizer.
6. Expand only after observation window.

## Monitoring

- API error rate on Live PvP RPCs
- Stuck matches query (`LIVE_PVP_OPERATIONS.md`)
- Finalizer duration / rows processed
- Realtime join failures

## Rollback threshold

Disable creation + client flag; do not drop tables. See `V1_5_ROLLBACK_DRILL.md`.

## Store upload

Manual: EAS production profile → App Store Connect / Play Console. **Not automated by agents.**
