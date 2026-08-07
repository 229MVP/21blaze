# Daily Challenge Security Model

Version 1.3.0 Phase 1 establishes a **server-authoritative** competitive boundary. The mobile client is untrusted for anything that affects ranking, economy, or official attempt consumption.

## Never trust the client for

| Concern | Server authority |
|---------|------------------|
| Official attempt count | Partial unique index + `start_daily_challenge()` |
| Challenge seed | `daily_challenges.authoritative_seed`; returned only from start RPC |
| Leaderboard placement | Future: verified attempts + server-side ranking |
| Reward grants | Future: server after verification |
| Blaze Coins | Not granted in Phase 1 |
| XP | Not granted in Phase 1 |
| Streak grants | Future: server after verified completion |
| Sabotage ownership | Out of scope |
| PvP outcomes | Out of scope |

## Phase 1 enforcement

### Row Level Security

- `daily_challenges`: authenticated read for `active` / `published` only. No client insert/update/delete.
- `daily_challenge_attempts`: authenticated read own rows only. **No client insert/update** (removed in migration `0012`). Writes go through `SECURITY DEFINER` RPCs.

### RPC boundaries

- `start_daily_challenge()` uses `auth.uid()` — never accepts `user_id` from the client.
- `complete_daily_challenge()` validates ownership, status, UTC date, rules version, nonnegative counters, and plausible completion time.
- `get_today_daily_challenge()` does **not** expose the seed.

### Service role

The Supabase service-role key must never ship in the mobile app. Admin challenge creation uses database functions / scheduled jobs with elevated privileges.

## Future gameplay validation strategy

Phase 1 stores client-reported stats with `verification_status = 'pending'`. Full anti-cheat is not implemented yet.

Planned layers:

1. **Structural validation** (Phase 1): bounds, status machine, version match, time plausibility.
2. **Move-log replay** (future): client submits `move_log`; server replays with `gameEngine` + seeded deck; compares score/counters.
3. **Rate limits** (future): completion velocity, impossible scores vs deck length.
4. **Leaderboard eligibility**: only `verification_status = 'verified'` rows (existing view filter in `0011`).

Architecture goal: the client may submit outcomes, but **ranking and economy hooks only fire after server verification**.

## Idempotency

- Start: advisory lock + unique index + resume in-progress attempts.
- Complete: `FOR UPDATE` on attempt row; completed attempts return existing payload.

This prevents duplicate rewards when network retries duplicate completion requests.

## Development diagnostics

`DailyChallengeDiagnosticsScreen` is registered only under `__DEV__`. It shows challenge metadata and a **deck hash**, not raw seeds in UI copy (seed is used internally only when probing RPC).
