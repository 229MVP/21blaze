# Version 1.4A — Async Recovery Policy

## Pre-first meaningful move

- Failed launch may resume the same attempt (`created` / `started`, no `first_move_at`).
- Network failure on start may retry idempotently.
- Challenge not considered played.

## After first meaningful move

- Force-close or quit abandons the attempt (Edge `abandon_attempt` or completion rejection path).
- Restarting the app must not create a duplicate attempt (unique constraint + resume pre-first-move only).
- Player cannot replay the shared deck on a new attempt.

## Background resume window

- **5 minutes** recommended client resume window (same lifecycle handling as Daily Challenge).
- Attempt submission grace: duration + 30s (aligned with Daily Challenge).
- Challenge expiration grace for active attempt completion: **10 minutes** after `expires_at`.

## Offline

- In-progress attempt follows local game state only; submission requires connectivity.
- No queued create/accept without secure sync design.
