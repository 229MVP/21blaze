# Version 1.4 Async Duel Operations

Operational runbook for Async Duel after migrations `0015`–`0018`.
Do not put production secrets in this document.

## Kill switches

Stored in `public.app_configuration`:

| Key | Effect when `false` |
|-----|---------------------|
| `async_duel_creation_enabled` | Rejects new duel creation RPCs |
| `async_duel_rematch_enabled` | Rejects rematch creation (also requires creation enabled) |
| `async_duel_push_enabled` | Suppresses new push outbox jobs; claim worker returns empty |
| `async_duel_config.active` | Treated as creation unavailable via ops status |

### Disable new duel creation

```sql
UPDATE public.app_configuration
SET value = 'false'::jsonb, updated_at = now()
WHERE key = 'async_duel_creation_enabled';
```

Client Hub / Confirm Challenge show an unavailable state via `get_async_duel_ops_status`.
Existing inbox, history, and results remain readable.
Active attempts may still complete or expire per server rules.

### Disable rematch creation

```sql
UPDATE public.app_configuration
SET value = 'false'::jsonb, updated_at = now()
WHERE key = 'async_duel_rematch_enabled';
```

### Disable push dispatch

```sql
UPDATE public.app_configuration
SET value = 'false'::jsonb, updated_at = now()
WHERE key = 'async_duel_push_enabled';
```

In-app notifications continue. Settlement is unaffected.

## Inspect stuck duels

```sql
SELECT id, status, challenger_id, opponent_id, expires_at, settled_at, created_at
FROM public.async_duels
WHERE status IN ('challenger_playing', 'awaiting_opponent', 'opponent_playing')
ORDER BY created_at DESC
LIMIT 50;
```

Integrity scan (service role only — not in the mobile app):

```sql
SELECT public.diagnose_async_duel_integrity(100);
```

## Expire abandoned duels

Service role / cron only (`expire_async_duels` is **not** executable by `authenticated`):

```sql
SELECT public.expire_async_duels(now());
```

Client-supplied future timestamps are clamped to `now()` as defense in depth.

## Invalidate a broken duel

Service-role SQL only; record who ran it and why:

```sql
UPDATE public.async_duels
SET status = 'invalid', updated_at = now()
WHERE id = '<duel-uuid>'
  AND status IN ('challenger_playing', 'awaiting_opponent', 'opponent_playing');
```

Do not rewrite scores or winners by hand unless paired with a documented stats reconciliation.

## Reconcile statistics

1. Run `diagnose_async_duel_integrity`.
2. Compare `player_duel_stats` against completed settlements (`duel_stat_events`).
3. Prefer replaying `apply_async_duel_settlement_stats(duel_id)` for a specific completed duel (idempotent via unique event keys).
4. Report mismatches before repairing. Keep an audit note of every correction.

## Reprocess safe notification / push jobs

- In-app rows use `(user_id, dedupe_key)` uniqueness — safe to re-run enqueue.
- Push outbox: reset failed jobs carefully:

```sql
UPDATE public.notification_push_outbox
SET status = 'pending', next_attempt_at = now(), last_error_code = NULL, updated_at = now()
WHERE id = '<outbox-uuid>'
  AND status = 'failed'
  AND attempt_count < 8;
```

Never invent notification content outside the controlled registry.

## Invalid push tokens

Edge Function `async-duel-push-dispatch` should deactivate permanent failures via `revoke` / `active = false`.
Do not log raw push tokens in production.

## Rotate server secrets

Rotate Expo push / provider credentials in the Edge Function secrets store.
Redeploy `async-duel-push-dispatch`.
Do not commit secrets. Client continues to use the publishable anon key only.

## Monitoring failures

Watch for elevated rates of:

- `ASYNC_DUEL_DISABLED`
- `INVALID_RESULT`
- `ACTIVE_DUEL_LIMIT` / `DUPLICATE_ACTIVE_DUEL`
- Push outbox `failed` / `suppressed`
- Integrity diagnostic finding counts

Log only safe ids (`duelId`, `attemptId`, `notificationId`, error codes). Never log seeds, tokens, or service-role keys.

## Rules / deck version rollout

1. Update `async_duel_config` JSON (`rulesVersion`, `deckVersion`).
2. Ship a client that accepts the new versions.
3. In-flight duels keep snapshotted versions; completion rejects mismatched client versions.

## Incident rollback

Forward-only migrations. Product rollback:

1. Disable creation + rematch + push kill switches.
2. Set `EXPO_PUBLIC_ENABLE_ASYNC_DUEL=false` on the next client if needed.
3. Keep tables; do not drop live duel data.

## Player-support investigation

1. Confirm caller is a participant (`challenger_id` / `opponent_id`).
2. Read duel status, expires_at, attempt rows, settled_at, outcome.
3. Check notifications by `duel_id` + `user_id` (never expose another user’s inbox).
4. Do not reveal seeds to support unless the player already started their attempt and investigation requires it; prefer fingerprints.

## Safe deployment order

1. Database migrations `0015` → `0018`
2. RLS / grant verification
3. Edge Function `async-duel-push-dispatch`
4. Push credential + environment separation
5. `diagnose_async_duel_integrity` + stats spot-check
6. Kill-switch verification
7. Internal app build (`1.4.0`)
8. Device QA (see release matrix)
9. Staged client rollout
10. Monitoring

## Manual store identifiers

Marketing version is `1.4.0`. iOS `buildNumber` and Android `versionCode` must be incremented by a human release manager — do not invent store numbers in automation.
