# Daily Blaze Leaderboard Tie-Breakers

Canonical ranking order for **Daily** official ranked attempts (server-side only):

1. Higher `verified_score`
2. More `verified_exact_21_count`
3. More `verified_five_card_clears`
4. Fewer `verified_bust_count`
5. Faster `elapsed_time_ms` (lower completion time)
6. Earlier `completed_at` (first official completion wins)

Implemented in:

- View `daily_challenge_leaderboard` (migration `0013_v1_3_phase3_leaderboards_streaks_rewards.sql`)
- RPC `compute_daily_challenge_rank`

**Weekly Blaze** ranking (sum of official daily scores, UTC Mon–Sun):

1. Higher weekly score (sum of daily scores)
2. More days played
3. Higher best daily score in the week
4. `user_id` ascending (deterministic fallback)

Clients must never compute competitive rank for display — always use RPC responses.

## Leaderboard eligibility

Only rows where:

- `attempt_type = 'ranked'`
- `status = 'completed'`
- `verification_status IN ('accepted', 'verified')`
- `verified_score IS NOT NULL`

Practice, abandoned, invalid, and pending-only attempts are excluded.
