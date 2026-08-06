# Version 1.4A — Async Result Rules

Server computes all results. Client displays only finalized server state.

## Tie-break order (higher/faster wins except busts)

1. Higher verified score
2. More exact-21 clears
3. More five-card clears
4. Fewer busts
5. Higher verified multiplier
6. Faster verified elapsed time

When all tie-breakers are equal → **draw** (`result_type: draw`).

**Not used:** acceptance time, completion time, creator favoritism.

## Result types

- `creator_win` / `opponent_win` / `draw`
- `expired` / `cancelled` / `invalid`

## Opponent privacy

Before viewer completes and verifies own attempt:

- Opponent score, move log, and verified stats are **not** returned in API responses.

After viewer verified completion:

- Opponent verified stats shown only when server allows (opponent also verified or challenge finalized).
