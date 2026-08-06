# Version 1.3C — Reward Grant Model

| Reward | Model |
|--------|--------|
| Participation (20 coins, 75 XP) | **Automatic** after verified ranked completion (Edge Function) |
| Daily placement coins | **Automatic** after challenge finalization (SQL finalize hook) |
| Weekly tier | **Player claim** via `ChallengeRewardsScreen` / `claim_weekly_challenge_reward` |
| Streak milestones | **Automatic** when streak hits 3/7/14/30 on verified completion |

All grants use idempotency keys in `challenge_reward_claims` and wallet `idempotency_key` uniqueness.

Failed client responses do not duplicate server grants. Client refreshes wallet, XP, and cosmetics after claim.
