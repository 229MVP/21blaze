# Version 1.3B — Backend Deployment Checklist

## Migrations

1. Apply `supabase/migrations/0012_v1_3b_leaderboards.sql`
2. Verify view `daily_challenge_leaderboard` exists
3. Verify RPCs: `get_daily_challenge_leaderboard`, `get_nearby_daily_ranks`, `get_weekly_challenge_leaderboard`, `get_nearby_weekly_ranks`, `finalize_expired_daily_challenges`

## Edge Function

Deploy updated `daily-challenge` function:

- Full tie-break ranking on complete
- `daily_rank` / `challenge_points` persistence
- Grace period enforcement
- `get_daily_leaderboard`, `get_weekly_leaderboard`, nearby actions

## Environment (client)

Optional UX flags (default OFF):

- `EXPO_PUBLIC_ENABLE_DAILY_LEADERBOARD`
- `EXPO_PUBLIC_ENABLE_WEEKLY_LEADERBOARD`
- `EXPO_PUBLIC_ENABLE_LEADERBOARD_NEARBY`
- `EXPO_PUBLIC_ENABLE_PUBLIC_PLAYER_PROFILES`
- `EXPO_PUBLIC_ENABLE_FRIENDS_LEADERBOARD` (keep false)

## Verification

- Complete a ranked attempt; confirm row in view with rank and points
- Call weekly leaderboard RPC for current UTC week
- Confirm practice attempt absent from view
- Confirm RLS blocks direct attempt reads for other users' move logs

## Blockers

- Migration not applied → RPC/view missing
- Edge function not redeployed → old ranking (score-only) until deploy completes
