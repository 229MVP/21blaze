# Async Duel Records and Rematches (v1.4 Phase 3)

## Record counting

Only `status = completed` with a stored `outcome` counts.

| Outcome | Challenger | Opponent |
| --- | --- | --- |
| `challenger_win` | win | loss |
| `opponent_win` | loss | win |
| `tie` | tie | tie |

Declined / cancelled / expired / invalid / incomplete attempts do **not** count.

Invariant: `completed_duels = wins + losses + ties`. Highest score is max completed attempt score.

## Idempotent stat events

Table `duel_stat_events` unique on `(duel_id, user_id)`. Settlement calls `apply_async_duel_settlement_stats`, which inserts events with `ON CONFLICT DO NOTHING` and recomputes aggregates from events.

## Backfill / reconcile

- `backfill_async_duel_stat_events()` — service_role; safe to re-run
- `reconcile_async_duel_stats()` — reports mismatches
- `repair_async_duel_stats_from_events()` — admin repair from events

Not exposed in production mobile UI.

## Public vs participant data

Public/approved aggregate via `get_player_duel_record` / `get_my_duel_record`: completed, W/L/T, win rate, highest score. Zero games → win rate `—`.

Head-to-head (`get_head_to_head_record`) only for the authenticated user vs another player. No third-party pair history.

## Rematch

`create_async_duel_rematch(sourceDuelId)`:

- Caller must be a participant of a **completed** source duel
- Other participant derived server-side
- New duel id, new server seed, current config, independent expiration
- Links: `rematch_of_duel_id`, `series_root_duel_id`
- Unique index: one direct rematch child per source duel
- Race: unique violation returns existing rematch to the creator; other player gets `DUPLICATE_ACTIVE_DUEL`
- Active-duel / pair limits still apply
- Opponent is notified only after the new challenger completes (same as any challenge)

No XP or Blaze Coins. No best-of series enforcement.

## Known limitations

- Expo push package may be absent until release config adds it
- Real-device push requires secrets + cron (see notifications doc)
- Series rematch index is informational only
