# Version 1.4 Security Audit — Async Duel

Audit scope: Async Duel Phases 1–3 + release-freeze migration `0018`.
This document does **not** claim full anti-cheat or cheat-proof competitive records.

## Trust boundaries

| Boundary | Trust |
|----------|-------|
| Supabase Auth `auth.uid()` | Server identity source of truth |
| SECURITY DEFINER RPCs | Only mutation path for duels / attempts / notifications / stats |
| Mobile client | Untrusted for winner, seed before start, stats, notification creation |
| Push payload | Untrusted for authorization; deep links re-fetch server state |
| Client-submitted result counters | Trusted within server bounds only (see limitations) |

## RLS coverage

Tables with RLS enabled and **no** client INSERT/UPDATE paths for competitive state:

- `async_duels`, `async_duel_attempts`
- `player_notifications`, `notification_preferences`, `device_push_tokens`
- `notification_push_outbox`
- `player_duel_stats`, `duel_stat_events`

Freeze hardening (`0018`):

- `REVOKE INSERT/UPDATE/DELETE` on notifications, prefs, tokens from `authenticated`
- `REVOKE ALL` on duel/attempt/stat/outbox tables from `PUBLIC` / `anon` / `authenticated`
- Reads and writes go through SECURITY DEFINER RPCs

## Function authorization

- Create / start / complete / decline / cancel / rematch validate `auth.uid()` and participation.
- `expire_async_duels`: **revoked from `authenticated`** (fixed in freeze). Clamps `p_now` ≤ `now()`.
- `diagnose_async_duel_integrity`: `service_role` only.
- `get_async_duel_ops_status`: authenticated, returns kill-switch booleans only.
- Functions set `search_path = public` and use explicit schema qualification.

## Seed handling

- Seed omitted from inbox, active, history, details, notifications, push payloads, public profiles.
- Seed returned only on authorized attempt start (`create_async_duel`, opponent start, rematch start for the rematch challenger).
- Participant may inspect seed after their attempt starts — **not** full replay anti-cheat.
- Status: **Mitigated** to the documented model.

## Attempt uniqueness

- Unique indexes enforce one attempt per role and concurrency-safe opponent starts.
- Status: **Fixed** in Phase 1; revalidated in freeze tests.

## State-machine enforcement

- `assert_async_duel_transition` rejects illegal transitions.
- Terminal statuses cannot return to playing.
- Status: **Fixed**.

## Result validation

- Freeze restores `validate_async_duel_result_fields` on `complete_async_duel_attempt` (regression from Phase 3).
- Checks: non-negative counters, cards ≤ 52, lanes ≤ 20, completion_ms within duration+grace.
- Does **not** reconstruct a full move log.
- Status: **Fixed** (bounds); **Deferred** (replay).

## Settlement idempotency

- Completed attempts early-return existing result.
- Stat events unique per `(duel_id, user_id)`; re-apply is safe.
- Status: **Fixed**.

## Notification privacy

- Recipient selected server-side; dedupe keys prevent duplicates.
- Content from controlled registry; client strips unexpected seed-like body fields.
- Mark-read ownership enforced in SECURITY DEFINER RPC.
- Status: **Fixed**.

## Push-token protection

- Tokens private; registration authenticated; outbox not client-readable.
- Provider secrets stay in Edge Function env.
- Push failure cannot roll back settlement.
- Status: **Mitigated**. Real-device delivery **unverified** in this environment.

## Rematch authorization

- Participant-only; source must be completed; other player derived server-side.
- One rematch child per source (`UNIQUE` on `rematch_of_duel_id`).
- New seed + current approved config; original immutable.
- Rematch kill switch + creation kill switch.
- Status: **Fixed**.

## Statistic integrity

- Client cannot modify aggregates.
- Public profile exposes approved aggregates only.
- Head-to-head is participant-safe.
- Status: **Fixed** for write protection; competitive accuracy limited by client-trusted counters.

## Abuse controls

Server-side: active duel limits, duplicate pair challenges, rematch uniqueness, search limit ≤ 30, inbox/history caps, completion ownership checks, push token format/env checks.

Remaining risks: display-name search scraping, client-trusted score inflation within bounds, notification volume under legitimate high activity.

## Known client-trust limitations

Server validates ownership, attempt status, timing window (expiration), score/counter bounds, rules/deck versions. It does **not** verify complete action replay.

Effect of cheating:

- Can inflate public win/loss and highest score within bounds
- Can distort head-to-head
- Would poison future ranking systems if added without stronger validation
- **No** duel XP / Blaze Coin rewards in v1.4 → economic exploit impact limited

**Recommendation:** Competitive records remain visible with explicit anti-cheat limitation disclosure. Do **not** describe Async Duel as cheat-proof. Stronger replay validation is deferred (not a freeze rewrite unless required).

## Findings summary

| ID | Finding | Disposition |
|----|---------|-------------|
| H1 | `expire_async_duels` executable by authenticated with forged `p_now` | **Fixed** in `0018` |
| H2 | Phase 3 completion dropped full result-field validation | **Fixed** in `0018` |
| H3 | Direct UPDATE on `player_notifications` could alter content | **Fixed** (REVOKE + RPC-only) |
| M1 | Privilege hygiene incomplete vs PUBLIC | **Fixed** in `0018` |
| M2 | Client kill-switch UX not wired | **Fixed** (Hub/Confirm/Result) |
| M3 | App version still 1.3.0 | **Fixed** marketing `1.4.0` (store build numbers manual) |
| M4 | OS push tap deep links / `expo-notifications` absent | **Accepted** — in-app deep links only; push E2E unverified |
| A1 | Seed after start is inspectable by participant | **Accepted** |
| D1 | Full move-log replay anti-cheat | **Deferred** |
| D2 | Physical-device push delivery | **Deferred** / manual |

## Release-blocking criteria

Release is blocked if any remain true:

- Critical authorization defect
- Duplicate settlement / attempt path
- Seed leak before authorized start
- Client-modifiable duel statistics
- Service-role key in mobile bundle
- Required automated checks failing

None of the above are known open after freeze fixes. Manual device QA and push E2E remain incomplete and are called out in the release decision.
