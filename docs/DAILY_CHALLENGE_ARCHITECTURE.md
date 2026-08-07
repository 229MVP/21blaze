# Daily Challenge Architecture (Version 1.3.0 Phase 1)

This document describes the server-authoritative Daily Challenge foundation introduced in Phase 1. UI, leaderboards, rewards, and practice mode are intentionally deferred.

## Flow

```
Mobile Client (authenticated)
        ↓
Supabase RPC (`get_today_daily_challenge`, `start_daily_challenge`, `complete_daily_challenge`)
        ↓
`daily_challenges` (UTC date, authoritative seed, rules/deck versions)
        ↓
`daily_challenge_attempts` (one ranked attempt per user per challenge)
        ↓
Deterministic deck (`createDailyChallengeDeck` + Mulberry32 Fisher–Yates)
        ↓
Secure completion (validation + idempotent `started → completed`)
        ↓
Future: replay verification, leaderboard, Blaze Coins, streaks
```

## Client modules

| Module | Role |
|--------|------|
| `src/challenge/dailyChallengeRegistry.ts` | Central `rules_version` / `deck_version` constants |
| `src/challenge/seedDerivation.ts` | Authoritative seed string + FNV-1a numeric derivation |
| `src/challenge/utcChallengeDate.ts` | UTC calendar date (00:00 UTC reset) |
| `src/challenge/dailyChallengeTypes.ts` | Typed domain models |
| `src/challenge/dailyChallengeFoundationService.ts` | RPC wrappers (`getTodayDailyChallenge`, start/complete) |
| `src/game/challenge/createDailyChallengeDeck.ts` | Deterministic deck from authoritative seed |
| `src/challenge/dailyChallengeAttemptLogic.ts` | Client-side mirror of start/complete gates (tested) |

The legacy Edge Function (`supabase/functions/daily-challenge`) remains for earlier 1.3A experiments. **Phase 1 canonical path is Postgres RPC** for ranked start/complete.

## Deterministic deck

1. Server stores `authoritative_seed` (text), e.g. `21blaze-daily-v1:2026-08-05`.
2. Client receives the seed only from `start_daily_challenge()` after authentication.
3. `deriveNumericSeedFromAuthoritative()` applies FNV-1a (32-bit) — must match Postgres `derive_daily_challenge_numeric_seed`.
4. `createOrderedDeck()` builds the canonical 52-card deck.
5. `shuffleDeckWithSeed()` runs Fisher–Yates with Mulberry32 PRNG (`createSeededRandom`).
6. `Math.random()` is never used for official challenge shuffling.

## Attempt lifecycle

| Status | Meaning |
|--------|---------|
| `started` | Ranked attempt in progress (created via RPC) |
| `completed` | Score submitted once |
| `abandoned` | Player left without submit (future) |
| `invalid` | Rejected by validation (future replay) |

Ranked attempts are unique per `(challenge_id, user_id)` via partial unique index.

`start_daily_challenge()` is idempotent for in-progress attempts (double tap / retry resumes). Completed attempts return `{ error: 'ALREADY_PLAYED' }`.

`complete_daily_challenge()` transitions `started → completed` once. Repeat calls return the existing result (`alreadyCompleted: true`).

## Versioning

- `rules_version` and `deck_version` are stored on each challenge and copied to attempts.
- Completion rejects mismatched `p_rules_version`.
- Historical results retain the version they were played under.

## Security summary

See `docs/DAILY_CHALLENGE_SECURITY_MODEL.md`.

## Operations

See `docs/DAILY_CHALLENGE_OPERATIONS.md`.
