# Version 1.3B — Ranking Rules

`ranking_rules_version = 1` on `daily_challenges`.

## Daily leaderboard source

Rows from `daily_challenge_attempts` where:

- `attempt_type = ranked`
- `status = completed`
- `verification_status = verified`
- `verified_score IS NOT NULL`

Practice, rejected, abandoned, expired, and pending attempts are excluded server-side.

## Daily tie-breakers (server order)

1. Higher `verified_score`
2. More `verified_exact_21_count`
3. More `verified_five_card_clears`
4. Fewer `verified_bust_count`
5. Higher `verified_multiplier`
6. Faster `elapsed_time_ms` (NULLS LAST)
7. Earlier `completed_at`

Ranks use `RANK()` — identical stats share the same rank; next rank skips accordingly.

## Weekly tie-breakers

Aggregated from one verified ranked attempt per UTC challenge day (unique index enforces one ranked row per user per challenge).

1. Higher Challenge Points (sum of daily `challenge_points`)
2. More verified challenge days completed
3. Better (lower) best daily rank in the week
4. Higher total verified score
5. More total exact-21 clears
6. More total five-card clears
7. Fewer total busts
8. Earlier completion of the final contributing challenge (`last_contributed_at`)

## Client rule

The client never computes or submits official rank or Challenge Points.
