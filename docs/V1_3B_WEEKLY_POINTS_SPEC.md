# Version 1.3B — Weekly Challenge Points

## UTC week

Weeks begin **Monday 00:00 UTC** through Sunday (PostgreSQL `date_trunc('week', …)` / `getUtcWeekStartDate`).

## Contribution rules

- One verified ranked attempt per UTC challenge day contributes
- Up to seven challenge days per week
- Practice attempts contribute **0** points

## Points by daily rank

| Daily rank | Points |
|------------|--------|
| 1 | 100 |
| 2 | 90 |
| 3 | 85 |
| 4–10 | 75 |
| 11–25 | 60 |
| 26–50 | 45 |
| 51–100 | 30 |
| Outside top 100 (verified) | 15 |

Implemented in `challenge_points_for_rank()` and `src/leaderboards/challengePoints.ts`.

## Weekly leaderboard

Sum of Challenge Points per user for the UTC week, with tie-breakers in `V1_3B_RANKING_RULES.md`.

## Rewards

No weekly placement rewards in 1.3B (deferred to 1.3C).
