# Version 1.3C — Challenge Reward Audit

| Component | Status |
|-----------|--------|
| Participation reward (20 coins, 75 XP) | Implemented — `grant_daily_challenge_participation_reward` |
| Daily placement rewards | Implemented — auto on `finalize_expired_daily_challenges` |
| Weekly tier rewards | Implemented — `claim_weekly_challenge_reward` (claim model) |
| Challenge streak tracking | Complete — `daily_challenge_streaks` |
| Streak milestone rewards | Implemented — `grant_challenge_streak_milestone` |
| Badge/title catalog | Implemented — migration 0013 seeds |
| `challenge_reward_claims` ledger | Implemented |
| Wallet idempotency | Complete — `apply_wallet_delta` |
| XP grants | Complete — `grant_player_xp` + `daily_challenge` source |
| Leaderboard finalization | Complete — 1.3B + placement hook in 0013 |
| Scheduled cron | **Missing** — lazy finalization only (documented) |
| `ChallengeRewardsScreen` | Implemented |
| Feature flags | Implemented (default OFF) |
| Notifications | Deferred — not integrated |
| Placement rewards UI (pending state) | Implemented |
| Practice reward exclusion | Server-enforced |
