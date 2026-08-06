# Version 1.4A — Async Challenge Audit

Branch: `feature/1.4-async-challenges` · App version **1.4.0**

## Summary

Version 1.4A adds **server-authoritative async direct-invite duels** (shared seed, one verified attempt per player). Prior live/ranked/quick-match systems remain **disabled by default** and are **not** reused as the async backend.

## Classification

| Area | Status | Notes |
|------|--------|-------|
| Live Duel screens (`LiveDuelHome`, lobby, live game) | Client-only / Disabled | `EXPO_PUBLIC_ENABLE_LIVE_DUEL=false`; realtime friend rooms in `0002_live_duels.sql` + Edge Functions |
| Quick Match | Client-only / Disabled | `EXPO_PUBLIC_ENABLE_QUICK_MATCH=false` |
| Ranked Beta | Client-only / Disabled | `EXPO_PUBLIC_ENABLE_RANKED_BETA=false` |
| `live_matches` / `live_match_players` | Backend-only | Service-role Edge Functions; not used by 1.4A |
| `ranked_*` tables | Backend-only | Ranked beta migration; disabled client |
| Supabase Realtime (live topics) | Disabled | Live match polling/state; not wired to async |
| Daily Challenge | Complete and working | Unchanged; separate tables and Edge Function |
| Match verification (`replayMatch`) | Complete and working | Reused for async attempt completion |
| Seeded decks (`createChallengeDeck`) | Complete and working | Same deterministic path as Daily Challenge |
| Push notifications | Missing | No infrastructure for async invites |
| Friends leaderboard | Missing / Disabled | Flag off |
| Deep links (pre-1.4A) | Missing | Scheme `twentyoneblaze` existed; no challenge routes |
| Async challenges (1.4A) | New — Complete but untested in production | Migration `0014`, Edge `async-challenge`, client hub |

## Async 1.4A (new)

| Component | Status |
|-----------|--------|
| `async_challenges` / `async_challenge_attempts` | Migration `0014` |
| Edge Function `async-challenge` | Implemented |
| Invite codes `BLAZE-XXXX-XXXX` | Server-generated, SHA-256 hash stored |
| Client hub / create / join / detail | Implemented |
| Deep link `twentyoneblaze://challenge/:code` | Implemented when flag on |
| Rewards / rematch | Deferred (1.4B) |

## Verification limitations (honest)

- Async completion uses `replayMatch` + `buildMatchSummaryFromReplay` for tie-break stats (exact-21, five-card, multiplier).
- Daily Challenge ranked path still approximates some stats in legacy rows; async 1.4A uses full replay summary for tie-breakers.
