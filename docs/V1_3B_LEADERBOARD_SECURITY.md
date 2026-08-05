# Version 1.3B — Leaderboard Security

## Source of truth

`daily_challenge_attempts` — no separate writable leaderboard table.

## Client restrictions

- Cannot INSERT/UPDATE official leaderboard rows (no table exposed for writes)
- Cannot set `daily_rank` or `challenge_points` (no client UPDATE policy on those fields for ranked lifecycle)
- Cannot alter another player's `profiles.display_name` via leaderboard APIs
- Leaderboard APIs return public fields only (no email, move logs, or auth internals)

## Server enforcement

- Edge Function `complete_attempt` verifies replays; practice blocked from leaderboard
- Grace period enforced on completion
- RPCs use `SECURITY DEFINER` with `auth.uid()` for authenticated reads
- Pagination capped at 100 rows; nearby window capped at 10
- `search_path` set on SQL functions

## RLS

Existing attempt RLS remains; leaderboard view is SELECT-only for `authenticated`. Service role used by Edge Function for authoritative writes.

## Anti-cheat visibility

Public APIs omit rejected/pending/suspicious attempts. No public CHEATER/FRAUD labels.

## Feature flags

Client flags gate UX only — not authorization.
