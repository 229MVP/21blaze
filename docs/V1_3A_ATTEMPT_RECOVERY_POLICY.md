# Version 1.3A — Attempt Recovery Policy

## Goals

- Prevent ranked restarts from improving deck knowledge
- Allow fair resume after brief interruptions
- Never consume a ranked attempt on failed offline start

## Ranked Attempt Lifecycle

1. **Created** — Player taps START RANKED ATTEMPT online. Server creates attempt with status `created`. Attempt is **not consumed** yet.
2. **Started** — First meaningful card placement calls `record_first_move`. Status becomes `started`. Attempt is **consumed** for the UTC day.
3. **Completed** — Valid replay submission stores verified score and leaderboard rank.
4. **Abandoned** — Player quits after first move, or server marks attempt abandoned.
5. **Expired** — Player force-closes before first move; attempt becomes `expired` and ranked slot remains unavailable only if later abandoned after first move.
6. **Rejected** — Invalid replay or rule violation.

## Disconnect / Background

- Brief background during an active ranked run may resume within the server attempt window (120s play + 30s submission grace).
- Force-close after first move calls `abandon_attempt` and marks ranked attempt unavailable for the day.
- Practice attempts may restart freely; abandoning practice never affects ranked eligibility.

## Offline

- Ranked start is blocked with **CONNECT ONLINE FOR A RANKED ATTEMPT**
- Cached challenge config may power offline **practice** only when the UTC date still matches
- Ranked verification requires online replay submission

## Idempotency

- `start_attempt` for ranked returns the existing open attempt before gameplay begins
- `complete_attempt` is idempotent — duplicate submissions return the stored verified result
- `record_first_move` is idempotent

## Not Allowed

- Converting practice into ranked
- Client-selected seeds or challenge dates
- Multiple ranked submissions per UTC day
- Local wallet or rank manipulation
