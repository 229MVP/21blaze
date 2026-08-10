# Async Duel Operations (v1.4 Phase 1)

## Configuration

Stored in `app_configuration`:

| Key | Purpose |
|-----|---------|
| `async_duel_config` | JSON: rulesVersion, deckVersion, durationSeconds, bustLimit, invitationLifetimeHours, opponentPlayLifetimeHours, targetScoreVisibility, maxPendingOutgoing, maxActiveBetweenPair, creationCooldownSeconds, active |
| `async_duel_creation_enabled` | Kill switch for new duels |

Existing duels keep snapshotted rules/duration/bust/seed; config changes apply to **new** duels only.

Client mirror: `src/asyncDuel/asyncDuelConfig.ts` (display defaults only).

## Disable new duel creation

```sql
UPDATE public.app_configuration
SET value = 'false'::jsonb, updated_at = now()
WHERE key = 'async_duel_creation_enabled';
```

Or set `"active": false` inside `async_duel_config`.

## Expiration

- **Scheduled:** `SELECT public.expire_async_duels();` via cron / Edge Function using **service_role** (not authenticated clients).
- **0016 hardening:** `expire_async_duels` is revoked from `authenticated` and `anon`. Parameter `p_now` is clamped to `<= now()` for defense in depth.
- Inbox and start RPCs invoke expiration opportunistically as the function owner with `now()`.
- Statuses flipped to `expired`: `challenger_playing`, `awaiting_opponent`, `opponent_playing` when `expires_at <= effective_now`.
- Expired duels grant no rewards and cannot start or settle as completed.

**Known vulnerability (0015 only):** If `0016` is not applied, authenticated users could call `expire_async_duels` with a future timestamp. Apply `0016` before enabling Async Duel in production.

## Inspect stuck duels (read-only)

```sql
SELECT id, status, challenger_id, opponent_id, expires_at, settled_at, created_at
FROM public.async_duels
WHERE status IN ('challenger_playing', 'awaiting_opponent', 'opponent_playing')
ORDER BY created_at DESC
LIMIT 50;
```

Do not manually rewrite scores. Prefer `status = 'invalid'` via a future admin RPC; Phase 1 uses service-role SQL carefully:

```sql
-- Service role only — document who ran this
UPDATE public.async_duels
SET status = 'invalid', updated_at = now()
WHERE id = '<duel-uuid>'
  AND status IN ('challenger_playing', 'awaiting_opponent', 'opponent_playing');
```

## Rules / deck version changes

1. Update `async_duel_config` JSON versions.
2. Deploy client that understands the new versions.
3. Old in-flight duels keep prior snapshotted versions.

## Indexes

- Challenger/opponent status indexes for inbox and limits
- Partial index on `expires_at` for active statuses
- Unique attempt indexes for concurrency safety

## Migration deployment

1. Apply `0015_v1_4_phase1_async_duel_foundation.sql` after v1.3 migrations.
2. Apply `0016_v1_4_async_duel_security_hardening.sql` (required before production Async Duel).
3. Verify grants: authenticated can execute create/start/complete/decline/cancel/inbox/history/details/result — **not** `expire_async_duels`.
4. Confirm RLS enabled; no INSERT/UPDATE for authenticated; table SELECT revoked.

## Create retry / timeout recovery

If `create_async_duel` succeeds server-side but the client times out, retrying create with the same opponent returns the existing active duel (`resumedExisting: true`) with seed and attempt id. Do not treat timeout as failure without checking inbox or retrying create.

See `src/asyncDuel/asyncDuelResumePolicy.ts`.

## Rollback considerations

Forward-only. To disable product surface: turn off creation flags and hide client feature flag `EXPO_PUBLIC_ENABLE_ASYNC_DUEL`. Do not drop tables with live data without a backup plan.

## Performance

- Inbox page size capped at 50
- Clients must use RPCs only; table SELECT is revoked for authenticated users (seed cannot be read via PostgREST)
- Unique indexes protect concurrent opponent starts

## Secrets

Never store service-role keys in the app. Never log access tokens in diagnostics.
