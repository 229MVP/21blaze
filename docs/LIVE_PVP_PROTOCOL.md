# Live PvP Protocol (v1.5 Phase 1)

**Protocol version:** `1`

## Channel topic

```
live-pvp:{matchId}
```

Non-secret. Join with:

```ts
supabase.channel(topic, { config: { private: true } })
```

## Subscription process

1. Authenticate.
2. Create private channel.
3. Attach validated broadcast listeners.
4. Subscribe → wait for `SUBSCRIBED`.
5. Fetch `get_live_pvp_snapshot(matchId)`.
6. Reconcile buffered events by `stateVersion`.
7. On gap / unknown / reconnect → refetch snapshot.
8. On leave → `removeChannel` (and untrack Presence).

On `TOKEN_REFRESHED`, call `supabase.realtime.setAuth(access_token)`.

## Snapshot

`get_live_pvp_snapshot` returns participant-safe state. Seed is present only when `seedAvailable` (countdown+).

## State version

Monotonic `state_version` on match. Clients:

- ignore `event.stateVersion <= local`
- apply `local + 1`
- refetch on gaps

Progress uses a separate per-participant monotonic `sequence`.

## Event envelope

```json
{
  "protocolVersion": "1",
  "eventId": "uuid",
  "matchId": "uuid",
  "stateVersion": 12,
  "eventType": "PARTICIPANT_READY",
  "serverOccurredAt": "ISO-8601",
  "payload": {}
}
```

### Event types

| Type | Meaning |
|------|---------|
| MATCH_SNAPSHOT_CHANGED | Generic refresh hint |
| PARTICIPANT_JOINED | Invite accepted / lobby |
| PARTICIPANT_READY | Ready marked |
| COUNTDOWN_SCHEDULED | Seed stored; start scheduled (seed not in broadcast) |
| MATCH_ACTIVE | Server materialized active |
| PROGRESS_ACCEPTED | Sanitized progress |
| PARTICIPANT_FINISHED | Official attempt completed |
| PARTICIPANT_FORFEITED | Explicit forfeit |
| PARTICIPANT_TIMED_OUT | Grace elapsed |
| MATCH_SETTLED | Terminal settlement |
| MATCH_CANCELLED | Cancel/decline path |
| MATCH_EXPIRED | Invite/lobby expired |
| MATCH_INVALIDATED | Ops invalidation |

Payloads are controlled schemas. Unknown types fail closed. Duplicates are harmless. Out-of-order versions are ignored or trigger refetch.

## Ready / countdown

1. Both in `lobby`.
2. Each calls `set_live_pvp_ready`.
3. When both ready, one transactional schedule stores seed/config, sets `scheduled_start_at`, creates attempts, emits `COUNTDOWN_SCHEDULED`.
4. Gameplay eligibility: `serverNow >= scheduled_start_at` (also materialized to `active` via `ensure_live_pvp_active`).

## Clock sync

`get_live_pvp_server_time` + RTT midpoint samples. Official deadlines remain server fields on the snapshot.

## Completion / forfeit / timeout

- `complete_live_pvp_attempt` — idempotent; settles when both terminal.
- `forfeit_live_pvp_match` — after countdown begins only.
- `finalize_live_pvp_deadlines` — invite expiry + grace timeouts.

## Error codes

See `LiveMatchErrorCode` in `src/livePvp/livePvpTypes.ts`.

## Compatibility

Bump `protocolVersion` in `live_pvp_config` for breaking envelope changes. In-flight matches keep snapshotted protocol/rules/deck versions.


## Phase 2 client behavior

- **Channel coordinator** (`livePvpMatchCoordinator`): one private channel per `(userId, matchId)`; survives screen remounts; teardown on terminal leave, logout, account switch.
- **Auth refresh**: `TOKEN_REFRESHED` → `realtime.setAuth` + snapshot refetch; never log JWTs.
- **Presence**: advisory connection only; debounced via full sync; never forfeit authority.
- **Ready UI**: calls `set_live_pvp_ready` only after subscribed + snapshot; irreversible Ready button removal.
- **Countdown**: render from `scheduledStartAt` + clock offset; skip elapsed numbers; do not restart local 3-2-1 after lobby.
- **Progress**: coordinator scheduler at configured cadence; sequence monotonic; opponent progress provisional until settlement.
- **Background**: official timer does not pause; foreground resnapshots via Hub/focus and game sync.
- **Process death**: Phase 2 does **not** ship a fake Resume; follow timeout/forfeit settlement. See `LIVE_PVP_PHASE_2_QA.md`.
- **Notifications**: `LIVE_MATCH_INVITE_RECEIVED` / `LIVE_MATCH_RESULT_READY` / `LIVE_MATCH_CANCELLED` with matchId deep links; stale opens resolve current server state.
- **Hub RPC**: `get_live_pvp_hub` participant-safe sections + attentionCount.
