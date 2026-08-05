# Version 1.3A — Daily Challenge Security Model

## Server-Authoritative Data

| Data | Authority |
|------|-----------|
| UTC challenge date | Server (`getUtcChallengeDate`) |
| Deck seed | Server (`deriveDailyChallengeSeed` + `daily_challenges`) |
| Ranked attempt creation | Server (`start_attempt`) |
| Verified score | Server replay (`complete_attempt`) |
| Daily rank | Server (`computeRankForAttempt`) |
| Challenge streak | Server (`daily_challenge_streaks`) |

## Client Cannot

- Create an official challenge row
- Choose a ranked seed
- Take more than one ranked attempt per UTC day
- Convert practice into ranked
- Set verified score or rank
- Change scoring version or challenge date
- Submit another user's attempt ID

## Verification

Ranked completion uses the existing **`replayMatch`** engine with the server-assigned seed. Client-submitted move logs are validated (`validateMoveLog`) then replayed. Mismatch ⇒ rejection, no leaderboard row.

### Trust Limitations

- Anti-cheat beyond deterministic replay is not implemented in 1.3A (no attestation, no timing attestation beyond elapsed move timestamps).
- Practice runs are intentionally client-local when offline — they never affect leaderboard integrity.

## RLS

- `daily_challenges`: authenticated read
- `daily_challenge_attempts`: users read/write **own rows only**
- `daily_challenge_streaks`: users read/write **own row only**
- Leaderboard view exposes display names and verified scores only

## Secrets

- No service-role keys in client code
- Edge Functions use service role server-side only via `createServiceClient()`

## Feature Flags

Not a security boundary. Disabled flags hide UX; server still enforces authorization when endpoints are deployed and called.
