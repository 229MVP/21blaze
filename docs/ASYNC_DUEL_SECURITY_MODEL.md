# Async Duel Security Model (v1.4 Phase 1)

## Trust boundaries

| Concern | Authority |
|---------|-----------|
| Participant identities | `auth.uid()` on create; opponent id validated against profiles |
| Seed | Server `gen_random_uuid` + random bytes; never from client |
| Rules / duration / bust limit | Snapshotted from `async_duel_config` at create |
| Attempt count | Unique indexes: one challenger + one opponent per duel |
| Results | Validated in `complete_async_duel_attempt` |
| Winner / outcome | `compare_async_duel_results` inside settlement transaction |
| Expiration | Server time only — `expire_async_duels` callable by **service_role** only (0016); internal RPCs call with `now()` |

The mobile client may submit only opponent id (create) or attempt id + result counters (complete). It must never submit challenger id, seed, rules, winner, or outcome.

## Seed generation and disclosure

- Format: `21blaze-async-v1:{uuid}:{hex}`
- Returned to challenger only from `create_async_duel`
- Returned to opponent only from `start_async_duel_opponent_attempt`
- Omitted from inbox, history, and details RPCs

Seed confidentiality reduces casual precomputation but is **not** a complete anti-cheat system once a participant starts an attempt (they hold the deck).

## Attempt uniqueness

- `UNIQUE (duel_id, participant_role)`
- `UNIQUE (duel_id, user_id)`
- Concurrent opponent starts catch unique_violation and return the existing attempt

## Result validation

Minimum checks (aligned with Daily Challenge patterns):

- Nonnegative score and counters
- Plausible cards played / lanes cleared
- Completion duration within duration + 30s grace
- Matching rules and deck versions
- Ownership + valid state transition
- Idempotent completion when already completed

**Accepted Phase 1 limitation:** server does not replay every card action for Async Duel. Future versions may add move-log replay similar to Solo `submit-match`.

## State transitions

Central policy: `assert_async_duel_transition`

```
challenger_playing → awaiting_opponent | cancelled | expired | invalid
awaiting_opponent → opponent_playing | declined | expired | invalid
opponent_playing → completed | expired | invalid
```

Terminal states do not reopen.

## Settlement

Opponent completion and settlement occur in one transaction:

1. Validate and complete opponent attempt
2. Load completed challenger attempt
3. Compare via `compare_async_duel_results`
4. Set outcome, winner, `settled_at`, status `completed`

No XP or Blaze Coin grants in Phase 1.

## RLS

- `async_duels` / `async_duel_attempts`: RLS enabled; **no** grants to `authenticated`/`anon`
- All participant reads and writes go through SECURITY DEFINER RPCs
- Inbox/details/history omit seed; seed only from create (challenger) or opponent start
- Functions use `SET search_path = public` and validate `auth.uid()`

## Idempotency

- **Create (challenger):** retry returns existing active duel for same opponent (`resumedExisting: true`) — lost-response / double-tap safe (0016)
- Opponent start: unique constraint + exception handler
- Completion: completed attempt returns existing settlement/result
- Decline/cancel: already-terminal returns success with flag

## Spam controls

- Max pending outgoing challenges
- Max active duels between a pair
- Creation cooldown seconds
- Creation kill switch: `async_duel_creation_enabled`

## Client response validation (Phase 1.5)

`src/asyncDuel/asyncDuelProtocol.ts` validates all Async Duel RPC payloads at runtime. Malformed responses throw `AsyncDuelServiceError` — never coerced to `"undefined"` strings or untyped `Record` objects.

## Why Phase 1 is not cheat-proof

Clients still run gameplay locally. Without full server replay, a sophisticated client could inflate counters within plausibility bounds. Mitigations: ownership, state machine, version checks, uniqueness, seed secrecy until start. Full anti-cheat is deferred.
