# Version 1.3B — Finalization Policy

## Challenge close

A Daily Challenge UTC day ends at `ends_at` (next UTC midnight). Ranked play cannot start after the verification grace period.

## Verification grace period

**10 minutes** after `ends_at` (`DAILY_CHALLENGE_VERIFICATION_GRACE_MINUTES`).

- Verified attempts submitted before grace ends may finish processing.
- Completions after grace are rejected (`Challenge submission grace period has ended`).
- Server time (`now()` / Edge Function clock) is authoritative — not device time.

## Finalization

`finalize_expired_daily_challenges()` runs on leaderboard reads and challenge status:

- Sets `status = closed` and `finalized_at` when `ends_at + 10 minutes < now()`
- Persisted `daily_rank` and `challenge_points` on attempts stabilize weekly totals
- Finalized daily ranks do not change from later invalid submissions (rejected at completion)

## Ranking rules version

`daily_challenges.ranking_rules_version` records the ruleset used (default `1`).

## Deferred

Placement rewards and weekly prize grants are Version 1.3C.
