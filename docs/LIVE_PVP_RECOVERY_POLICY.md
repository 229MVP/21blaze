# Live PvP Recovery Policy (v1.5 Phase 3)

## Checkpoint scope

AsyncStorage checkpoint `@21blaze/livePvpCheckpoint` stores only:

- Account and match identifiers (user, match, attempt, role)
- Protocol/rules/deck versions and authoritative deadlines
- Engine deck position, lanes, score, counters, timer fields
- Last accepted and attempted progress sequence numbers

Checkpoints are **untrusted**. They never grant rewards, change winners, extend deadlines, or bypass server validation.

## When checkpoints are written

- During active Live PvP gameplay (throttled to ~2s)
- After card plays and timer sync while `timerStatus === running`

## When checkpoints are cleared

- Verified completion submission
- Explicit forfeit or terminal settlement
- Logout or account switch
- Failed server reconciliation (wrong account, terminal match, version mismatch, corrupt payload)
- `clearLivePvpMode` / hub discard paths

## Resume eligibility

Resume is offered only after:

1. Authenticated session restored
2. `get_live_pvp_snapshot` confirms participant status
3. Match still in `countdown`, `active`, or `settling`
4. Attempt not completed/forfeited/timed out
5. Checkpoint versions match snapshot
6. Server deadline not passed for active play

Lobby enters gameplay via `prepareLivePvpGameFromCheckpoint` when reconciliation passes; otherwise fresh `prepareLivePvpGame`.

## Countdown and time

Recovery **never** restarts local 3-2-1 countdown. Remaining time is derived from `gameplayDeadlineAt` and sampled server clock.

## Progress sequence

On join/recovery, client sets next sequence from `myLatestProgressSequence + 1` from snapshot RPC. Stale submission errors trigger snapshot refresh and sequence resync.

## Reconnect

Coordinator `reconnectWithBackoff` uses bounded exponential backoff with jitter (max 5 attempts per chain). Cancelled on logout, account switch, match switch, or terminal settlement. Presence remains advisory only.
