# Live PvP Security Model (v1.5 Phase 1)

## Trust boundaries

| Layer | Trust |
|-------|-------|
| Supabase Auth `auth.uid()` | Identity source of truth |
| `live_pvp_*` SECURITY DEFINER RPCs | Authoritative match mutations |
| Private Realtime topic `live-pvp:{matchId}` | Delivery only; not source of truth |
| Presence | Ephemeral UX; never settles a match |
| Mobile client | Local gameplay for responsiveness; untrusted for start/winner/seed/ready-of-others |

## Private-channel authorization

- Client joins with `config: { private: true }`.
- RLS on `realtime.messages` uses `is_live_pvp_participant(realtime.topic())`.
- SELECT allowed for `broadcast` and `presence` extensions for members only.
- INSERT allowed for **`presence` only** — clients cannot publish authoritative Broadcast.
- Topic string is **not** a secret; membership is.

Authorization is evaluated on channel connection and cached for that connection. Do not assume immediate revocation mid-connection for sensitive post-membership data; sensitive values (seed) are fetched via RPC snapshot, not assumed from older broadcasts.

## Server-originated Broadcast

Authoritative transitions persist DB state, append `live_pvp_events`, increment `state_version`, then call `realtime.send(..., private := true)`.

Clients request commands via RPCs only.

## Presence limitations

Presence may show connected / reconnecting in the lobby. It must not determine membership, ready, start, forfeit, winner, timeout, or settlement.

## Seed handling

- Null until both players are ready and countdown is scheduled.
- Returned only via `get_live_pvp_snapshot` once status is `countdown` or later.
- Omitted from Broadcast countdown payload (clients refetch snapshot).
- Revealing the seed before `scheduled_start_at` permits client precomputation — **not** full anti-cheat.

## Clock authority

Server timestamps control `scheduled_start_at`, deadlines, and grace. Clients may estimate offset for UX countdown alignment. Device wall clock never decides eligibility alone.

## Readiness authority

Only `set_live_pvp_ready(matchId)` marks the caller ready. Presence cannot substitute. Idempotent.

## Progress validation

`submit_live_pvp_progress` enforces ownership, active window, monotonic sequence, rate limit, and nonnegative bounds. Progress is provisional and never settles the match.

## Attempt uniqueness

One attempt per user/role per match. Completed attempts cannot overwrite result fields.

## Settlement

Reuses `compare_async_duel_results` for dual completed results. Forfeit/timeout/no_contest policies are server-side. Idempotent via settled status. **No** Async Duel stats, XP, Blaze Coins, or public Live PvP records in Phase 1.

## Disconnect policy

WebSocket disconnect does not instantly forfeit. Clock continues. Reconnect: refresh auth, rejoin private channel, snapshot, continue if grace permits. Missing final submission → timeout finalizer.

## Timeout policy

`finalize_live_pvp_deadlines` expires invites/lobbies and times out incomplete attempts past `submission_grace_until`, then settles. Bounded batches + `SKIP LOCKED`.

## RLS / privileges

All `live_pvp_*` tables have RLS enabled and **no** client table grants. Mutations/reads go through RPCs. Legacy `live_matches` Realtime policies remain for the older friend/quick/ranked beta and are separate.

## Known client-trust limitations

Server does not reconstruct full card-action replay. Clients can inflate scores/counters within bounds. Competitive integrity for future public records will need stronger validation.

**Live PvP Phase 1 is not cheat-proof.**
