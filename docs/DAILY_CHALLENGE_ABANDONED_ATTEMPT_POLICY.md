# Daily Challenge — Abandoned Attempt Policy (Version 1.3)

## Decision

Once `start_daily_challenge()` successfully creates a ranked attempt row, that
**official ranked attempt is consumed** for that UTC challenge date.

The player cannot obtain a second ranked attempt by:
- force-closing the app
- navigating away
- network retries after the first successful start

## Status while incomplete

| Status | Meaning |
|--------|---------|
| `started` | Official attempt in progress or abandoned mid-run |

If the player leaves before completion, the row remains `started`. A later
`start_daily_challenge()` call **resumes the same attempt** (`resumed: true`)
and returns the same `attemptId` and server seed.

## After completion

When status is `completed`, further `start_daily_challenge()` calls return
`{ error: 'ALREADY_PLAYED' }`. No new ranked row is created.

## Not in Phase 1 / 1.5

- Practice attempts (future)
- Abandon → new ranked attempt (rejected by design)
- Resume UI / recovery screens (Phase 2+)
- Automatic `abandoned` transition on timeout (future ops playbook)

## Rationale

Prevents exploit: start → bad run → abandon → free second ranked try.

Server enforcement:
- Partial unique index on `(challenge_id, user_id)` WHERE `attempt_type = 'ranked'`
- Idempotent start RPC with advisory lock + resume for `started`

## Future recovery (optional)

A future phase may allow **continuing the same `started` attempt** in the
gameplay UI without creating a new row. Marking `abandoned` without completing
would still not grant a second ranked attempt under this policy.
