# Version 1.3A — Daily Challenge Audit

Audit date: 2026-08-05  
Branch: `feature/1.3-daily-challenge`

## Summary

Version 1.3A introduces a **new Daily Challenge system**. Prior to this milestone, no Daily Challenge screens, services, migrations, or feature flags existed. The repository already contained strong reusable primitives for seeded play, replay verification, and leaderboard UI.

## Classification

| Component | Status | Notes |
|-----------|--------|-------|
| Daily Challenge screens | **Missing → Implemented in 1.3A** | `DailyChallengeScreen`, `DailyChallengeLeaderboardScreen` |
| Challenge services / store | **Missing → Implemented in 1.3A** | `dailyChallengeService`, `useDailyChallengeStore` |
| Seeded deck generation | **Implemented and working** | Reused `createSeededShuffledDeck` + new UTC date seed helper |
| Deterministic shuffle | **Implemented and working** | Mulberry32 + Fisher–Yates parity with Edge Functions |
| Daily leaderboard | **Missing → Implemented in 1.3A** | `daily_challenge_leaderboard` view + client table |
| Ranked attempt security | **Missing → Implemented in 1.3A** | Edge Function + RLS + replay verification |
| Practice mode | **Missing → Implemented in 1.3A** | Unlimited local/online practice attempts |
| Challenge streak | **Missing → Implemented in 1.3A** | `daily_challenge_streaks`, display only (no rewards yet) |
| Global Solo leaderboard | **Partial** | Existing `verified_scores` / `global_leaderboard` unchanged |
| Match verification / replay | **Implemented and working** | Reused `replayMatch` from Solo online submit |
| Ranked duel mode | **Disabled** | Unrelated live/ranked beta remains off |
| Daily Rewards (login streak) | **Disabled** | Separate 1.1 retention system |
| Daily Missions | **Disabled** | Separate 1.1 retention system |
| RevenueCat / purchases | **Disabled** | `EXPO_PUBLIC_ENABLE_STORE_PURCHASES=false` |
| Feature flags | **Implemented in 1.3A** | Master + ranked + practice + leaderboard flags |

## Reused Systems

- `src/game/seededRandom.ts` and `src/game/deck.ts`
- `supabase/functions/_shared/game/replayMatch.ts`
- `src/components/leaderboard/LeaderboardTable.tsx`
- `src/components/GameTimer/GameStartCountdown.tsx`
- `src/screens/GameScreen.tsx` gameplay shell
- `src/screens/ResultsScreen.tsx` results shell

## Backend Deploy Status

Migration `0011_v1_3a_daily_challenge.sql` and Edge Function `daily-challenge` are present locally. Remote Supabase deploy remains operator-managed — see `docs/V1_3A_BACKEND_DEPLOYMENT_CHECKLIST.md`.

## Trust Limitations

Full move-log replay verification is used for ranked submissions (same engine as Solo online). The client cannot set score, rank, seed, or challenge date. Device clock does not determine eligibility — UTC challenge date is computed server-side.

## Deferred to 1.3B+

- Real reward grants for challenge placement
- Challenge-specific cosmetics
- Historical leaderboard browsing beyond current day
- Push/reminder notifications
