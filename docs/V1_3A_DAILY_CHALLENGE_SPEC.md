# Version 1.3A — Daily Challenge Specification

## Overview

One **UTC Daily Challenge** is available each calendar day. Every eligible player receives the same challenge configuration:

- Challenge ID (server UUID)
- Deck seed (deterministic from UTC date)
- Rules version
- Scoring version
- Duration (120 seconds — same as Solo)

## Attempt Types

| Type | Limit | Online required | Leaderboard |
|------|-------|-----------------|-------------|
| Ranked | 1 per user per UTC day | Yes | Yes, after replay verification |
| Practice | Unlimited | No (cached config OK) | Never |

## Challenge Generation

- Seed formula: FNV-1a hash of `21blaze-daily-v1:{YYYY-MM-DD}` → signed 32-bit integer
- Lazy creation: first authenticated `get_status` or `start_attempt` inserts the day's row
- Historical rows remain immutable

## Client Modules

- `src/game/challenge/createDailyChallenge.ts`
- `src/game/challenge/createChallengeDeck.ts`
- `src/game/challenge/seededRandom.ts`
- `src/services/dailyChallengeService.ts`
- `src/store/useDailyChallengeStore.ts`

## Edge Function Actions

`daily-challenge` (JWT required):

| Action | Purpose |
|--------|---------|
| `get_status` | Current challenge, ranked attempt, streak |
| `start_attempt` | Create/resume ranked or practice attempt |
| `record_first_move` | Mark attempt started; ranked consumed after first move |
| `complete_attempt` | Replay-verify ranked submission |
| `abandon_attempt` | Abandon active attempt |
| `get_leaderboard` | Daily verified scores |

## Feature Flags

| Flag | Default |
|------|---------|
| `EXPO_PUBLIC_ENABLE_DAILY_CHALLENGE` | `false` |
| `EXPO_PUBLIC_ENABLE_DAILY_CHALLENGE_RANKED` | `false` |
| `EXPO_PUBLIC_ENABLE_DAILY_CHALLENGE_PRACTICE` | `false` |
| `EXPO_PUBLIC_ENABLE_DAILY_LEADERBOARD` | `false` |

Flags are UX gates only — server authorization is final.

## Ads & Purchases

- No interstitial/rewarded ads on Daily Challenge screens (`dailyChallenge` blocked screen)
- RevenueCat remains disabled
- Daily Challenge entry is free

## Version

Application version: **1.3.0**  
Bundle identifier unchanged: `com.twentyoneblaze.app`
