# Version 1.5 Rollback Drill

**Staging execution:** **UNPERFORMED** (no linked 21blaze staging)

## Staging drill script

1. `UPDATE app_configuration` → `live_pvp_creation_enabled = false`
2. Confirm `create_live_pvp_invite` rejects new invitations
3. Allow active matches to complete or run `finalize_live_pvp_deadlines` (service_role)
4. `reconcile_live_pvp_active_slots`
5. Client: `EXPO_PUBLIC_ENABLE_LIVE_PVP=false` on next build
6. Verify Solo, Daily Challenge, Async Duel unaffected
7. Do **not** drop `live_pvp_*` tables
8. Re-enable creation on staging after drill

## Production rollback order

1. Disable server creation (`live_pvp_creation_enabled`).
2. Disable client flag (`EXPO_PUBLIC_ENABLE_LIVE_PVP=false`) — hide navigation.
3. Run service-role finalizer + slot reconciliation on schedule.
4. Inspect stuck matches (`LIVE_PVP_OPERATIONS.md` queries).
5. Preserve all match/attempt/notification data.
6. Forward corrective migration only if schema bug — never destructive rollback.
7. Re-enable only after root cause documented and RC re-run.

## Rollback owner

Assign before production cutover (see production cutover runbook).
