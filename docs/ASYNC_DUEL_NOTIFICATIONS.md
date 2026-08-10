# Async Duel Notifications (v1.4 Phase 3)

## Events

| Type | Recipient | When | Push |
| --- | --- | --- | --- |
| `DUEL_CHALLENGE_RECEIVED` | Opponent | Challenger completes → `awaiting_opponent` | Yes (prefs) |
| `DUEL_COMPLETED` | Challenger | Opponent settles duel | Yes (prefs) |
| `DUEL_DECLINED` | Challenger | Opponent declines | Yes (prefs) |
| `DUEL_EXPIRED` | Both participants | Server `expire_async_duels` | No (in-app only) |

Creation is transactional with the duel state change via `enqueue_player_notification`. Dedupe: unique `(user_id, dedupe_key)`.

## In-app read behavior

- List + unread count via RPCs
- Opening a notification marks it read after ownership check
- Mark-all-read affects only the authenticated user
- Account switch clears `useDuelNotificationStore`

## Deep links

Payload shape: `{ screen, duelId }`. Valid screens: `AsyncDuelChallengeDetails`, `AsyncDuelResult`, `AsyncDuelHub`. Client validates before navigate, then fetches authoritative duel state. Payload is never authorization.

## Push architecture

1. Notification row + outbox row inserted in DB (outside push I/O)
2. Edge function `async-duel-push-dispatch` claims outbox (service role)
3. Loads active tokens, applies preferences already reflected at enqueue time
4. Sends Expo push payload without seed/private data
5. Records provider ids; deactivates permanently invalid tokens
6. Retries transient failures with backoff (`attempt_count < 8`)

Push failure never rolls back duel settlement.

## Token lifecycle

- `register_device_push_token` / `revoke_device_push_token`
- On logout/account switch: revoke current device token + clear caches
- Token uniqueness: transferring a device token detaches prior account

## Preferences

Server-backed: challenges / results / status × in-app / push. Disabling push does not remove duel inbox/history.

## Provider configuration (manual)

1. Apply migration `0017_v1_4_phase3_async_duel_notifications.sql`
2. Install `expo-notifications` in the app when enabling real push
3. Set `EXPO_PUBLIC_EAS_PROJECT_ID`
4. Deploy `async-duel-push-dispatch` with secrets:
   - `PUSH_DISPATCH_SECRET`
   - `EXPO_ACCESS_TOKEN`
   - service role key (standard)
5. Schedule cron/webhook to `POST` the function with header `x-push-dispatch-secret`

Until those steps are done, outbox jobs are marked `suppressed` with safe reason codes. **Do not claim real-device push delivery passed.**

## Privacy

Never store/send: seed, email, phone, tokens, service-role keys, raw SQL, full gameplay payloads. Display names are plain text only.
