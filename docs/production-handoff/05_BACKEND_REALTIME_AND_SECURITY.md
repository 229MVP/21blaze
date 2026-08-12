# Backend, Realtime, and Security Handoff

## Recommended architecture

- Expo React Native client for iOS and Android.
- Supabase Auth, Postgres, Storage, and Realtime for accounts and durable data.
- A server-authoritative match service or Supabase Edge Function/WebSocket authority for live game validation. Do not let clients directly mutate live match state tables.
- Remote configuration for `rulesVersion`, balance values, feature flags, maintenance mode, and minimum client version.

## Match state machine

`created → waiting → ready_check → countdown → active → resolving → completed`

Exceptional terminal states: `cancelled`, `forfeit`, `abandoned`, `invalidated`.

## Server-authoritative flow

1. Matchmaker creates match, seed, rules version, players, and equipped loadouts.
2. Both clients acknowledge ready and clock offset.
3. Server emits snapshot revision 0 and countdown.
4. Client submits an intent with unique `clientActionId` and `expectedRevision`.
5. Server authenticates player, validates intent, applies deterministic reducer, stores action, increments revision, and broadcasts accepted event plus canonical state delta.
6. Client reconciles prediction with server state. Rejected intents never change authoritative state.
7. Server finalizes score, rating, missions, XP, and rewards in one transaction.

## Required tables

- `profiles`
- `player_settings`
- `player_stats`
- `power_catalog`
- `player_powers`
- `player_loadouts`
- `cosmetic_catalog`
- `player_cosmetics`
- `shop_catalog`
- `wallets`
- `wallet_ledger`
- `seasons`
- `ranked_ratings`
- `matches`
- `match_players`
- `match_actions`
- `match_snapshots`
- `match_results`
- `matchmaking_tickets`
- `missions`
- `player_missions`
- `achievements`
- `player_achievements`
- `friendships`
- `inbox_messages`
- `reports`
- `device_push_tokens`
- `analytics_events` only if a dedicated analytics provider is not used

## Realtime messages

Client intents:

- `match.ready`
- `card.place`
- `power.activate`
- `match.pause_request` for private/practice only
- `match.forfeit`
- `match.rematch_vote`
- `connection.ping`

Server events:

- `match.snapshot`
- `match.countdown`
- `card.revealed`
- `card.placed`
- `card.auto_routed`
- `lane.updated`
- `power.activated`
- `power.blocked`
- `status.applied`
- `status.expired`
- `score.updated`
- `player.disconnected`
- `player.reconnected`
- `match.completed`
- `match.invalidated`
- `error.action_rejected`

## Reconnect

- Client retains `matchId`, last accepted revision, and unsent intent IDs in secure local storage.
- On reconnect, request events after the last revision. If compaction removed them, receive a complete snapshot.
- Server continues the match. Auto-Route handles missed card decisions during the 20-second grace window.
- After grace expires, server may forfeit the disconnected player. If infrastructure failure affects both players, invalidate with no rating loss.

## Security and anti-cheat

- Use short-lived authenticated tokens and verify user identity on every intent.
- Rate-limit matchmaking, power activation, reports, friend requests, and purchase verification.
- Never accept client-provided deck order, score, energy, timer, reward, rating, ownership, or match result.
- Enforce unique `(match_id, client_action_id)` for idempotency.
- Store append-only wallet ledger and match actions.
- Sign match result summaries; retain rules version and seed for replay verification.
- Detect impossible action frequency, stale revision abuse, modified clients, repeated disconnect patterns, collusion, and abnormal win trading.
- RLS: players may read permitted profile/result data and their own inventory; all ranked result, currency, ownership, and live-match writes are service-role only.
- Reports require target, category, optional match, evidence reference, and moderation state.
- Delete-account workflow must revoke sessions, remove personal data per policy, and retain only legally permitted anonymized anti-fraud records.

## Purchase validation

Google Play and Apple receipts are verified server-side. Grant ownership through an idempotent transaction keyed by platform transaction ID. Never unlock paid items solely from a client callback.
