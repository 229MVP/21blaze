# Quick Match concurrency checks

Run against a linked local/remote Supabase project after applying `0003_quick_match.sql`.

## SQL probes

```sql
-- 1) Partial unique index prevents two active queue rows per user
-- Expect unique violation on second insert with status queued.
-- (Use service_role / SQL editor.)

-- 2) Matcher cannot pair a user with themselves
-- Insert one queued row for user A and call:
--   select public.try_create_quick_match(A, 'unknown', '1.0.0');
-- Expect NULL.

-- 3) Two queued compatible users create one match
-- Insert queued rows for A and B (same game_rules_version), then:
--   select public.try_create_quick_match(A, 'unknown', '1.0.0');
-- Expect one live_matches row mode=quick_match, two live_match_players, two acceptances.
-- Second call for B should return the same match_id or NULL if already matched.

-- 4) Three users → one match + one still queued
-- Queue A,B,C then match A; expect one match and one remaining queued user.

-- 5) Expired / cancelled rows are ignored
-- Set expires_at in the past or status=cancelled; matcher returns NULL.

-- 6) SKIP LOCKED race
-- Concurrent try_create_quick_match from two sessions against the same pair
-- must create exactly one live_matches row.
```

## Edge Function probes

1. Repeated `action=join` reuses one queue entry.
2. Repeated `action=poll` does not create duplicate matches.
3. One `accept` does not start countdown; two accepts start exactly one.
4. Acceptance timeout cancels pending match and can requeue the acceptor.
5. `cancel` only affects the caller’s queued entry.
6. Running Live Duel blocks a new `join` with `already_in_match`.
7. Authenticated user cannot SELECT another user’s `matchmaking_queue` row (RLS).
