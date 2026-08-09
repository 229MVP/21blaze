# Daily Challenge Phase 3 — Manual QA

Leaderboards, streaks, and secure streak rewards (Version 1.3 Phase 3).

**Prerequisites**

- Phase 2 flags enabled (`EXPO_PUBLIC_ENABLE_DAILY_CHALLENGE`, ranked, practice)
- `EXPO_PUBLIC_ENABLE_DAILY_LEADERBOARD=true`
- Migration `0013_v1_3_phase3_leaderboards_streaks_rewards.sql` applied
- Authenticated test account

| Test | Steps | Expected | Android | iOS | Web |
|------|-------|----------|---------|-----|-----|
| **A** Daily leaderboard | Complete ranked run → View Leaderboard | Your score appears; top 50 loads | | | |
| **B** Player rank | Check Results after completion | DAILY RANK shown when lookup succeeds | | | |
| **C** Daily tie breakers | Two accounts with same score, different 21s | Higher exact-21 count ranks above | | | |
| **D** Weekly leaderboard | Open Weekly tab | Sum of daily scores; days played shown | | | |
| **E** Consecutive streak | Complete on consecutive UTC days | Streak increments | | | |
| **F** Missed-day reset | Skip a UTC day, then complete | Streak resets to 1 | | | |
| **G** Milestone earned | Reach 3-day streak | Celebration modal; eligible reward | | | |
| **H** Reward claim | Tap CLAIM on milestone | One grant; wallet updates if monetization on | | | |
| **I** Double-tap claim | Rapid double-tap CLAIM | Single grant (idempotent) | | | |
| **J** Offline leaderboard | Offline → Leaderboard | OFFLINE message; no fabricated ranks | | | |
| **K** After completion | Results → View Leaderboard | Rank list includes your entry | | | |
| **L** Practice exclusion | Practice run → Leaderboard | Practice score not listed | | | |
| **M** Android layout | 320–430 widths | No clipping; podium + list scroll | | | |
| **N** iPhone layout | Safe areas | Tabs and YOUR RANK readable | | | |
| **O** Web layout | Desktop/narrow web | Leaderboard loads; refresh works | | | |

## Regression

- Solo Play unchanged
- Daily ranked start/complete (Phase 2)
- Practice mode still unranked
