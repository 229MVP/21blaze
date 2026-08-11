# Version 1.5 Supabase Deployment Checklist

**Do not apply to production until RC QA sign-off.** Live PvP creation remains OFF.

## Migration order (forward-only)

1. `0001` … `0018` (v1.4 baseline)
2. `20260810143545_v1_5_phase1_live_pvp_foundation.sql`
3. `20260810151826_v1_5_phase2_live_pvp_playable.sql`
4. `20260810183000_v1_5_phase3_live_pvp_resilience.sql`
5. `20260810185335_v1_5_live_pvp_privilege_closure.sql`

## Pre-deploy

- [ ] Staging full replay (`supabase db reset` locally when Docker available)
- [ ] `supabase migration list` matches remote
- [ ] Advisors / lint on staging
- [ ] Privilege queries as `anon`, `authenticated`, `service_role`

## Post-deploy verification

```sql
-- authenticated must fail
SELECT public.finalize_live_pvp_deadlines(1);  -- expect permission denied

-- service_role worker
SELECT public.finalize_live_pvp_deadlines(20);
SELECT public.reconcile_live_pvp_active_slots(100);
```

## Kill switches

```sql
UPDATE public.app_configuration
SET value = 'false'::jsonb, updated_at = now()
WHERE key = 'live_pvp_creation_enabled';
```

## Rollback sequence

1. Disable creation flag (above).
2. Client: `EXPO_PUBLIC_ENABLE_LIVE_PVP=false`.
3. Do not revert applied migrations on live data without explicit DBA plan.

## Unperformed in cloud agent environment

- Local `supabase db reset` — Docker not available.
- Staging privilege smoke — requires linked project + credentials.
