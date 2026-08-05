# Version 1.3B — Leaderboard Audit

## Summary

| Component | Status |
|-----------|--------|
| `DailyLeaderboardScreen` | Implemented (tabs Daily/Weekly) |
| `WeeklyLeaderboardPanel` | Implemented |
| `challengeLeaderboardService` | Implemented (Edge Function actions) |
| `useLeaderboardStore` | Implemented |
| `daily_challenge_leaderboard` view | Implemented (migration 0012) |
| Weekly aggregation RPC / Edge | Implemented |
| `get_daily_challenge_leaderboard` RPC | Implemented (client may use Edge) |
| `get_weekly_challenge_leaderboard` RPC | Implemented |
| Nearby rank RPCs | Implemented |
| Global Solo leaderboard (`leaderboardService`) | Implemented and working (unchanged) |
| Local high scores | Client-only (unchanged) |
| Ranked beta leaderboard screen | Disabled (feature flag) |
| Friends tab (`HighScoresScreen`) | Hidden unless `EXPO_PUBLIC_ENABLE_FRIENDS_LEADERBOARD=true` |
| Real-time multiplayer leaderboards | Missing (out of scope) |
| Placement rewards | Missing (deferred to 1.3C) |
| Materialized views | Not used (live view + stored `daily_rank` on finalize) |
| Client direct INSERT to leaderboard | Not possible (no leaderboard table) |

## Security posture

Leaderboards derive from `daily_challenge_attempts` with server filters. Clients cannot insert official rows. See `V1_3B_LEADERBOARD_SECURITY.md`.

## Pre-1.3B state (1.3A)

- Partial daily view (score + `completed_at` only)
- Edge `get_leaderboard` top 100 without tie-breakers or cosmetics
- No weekly schema
- No finalization snapshots
- No Challenge Points
