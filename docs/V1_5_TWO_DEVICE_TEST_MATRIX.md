# Version 1.5 Two-Device RC Test Matrix

**Branch:** `cursor/v1-5-rc-validation-1a6b`  
**Backend:** shared staging `ioxydgrcgtvrvoxjtupr`  
**Production flags:** OFF  
**Status:** `AWAITING USER EVIDENCE`

## Tester setup

Record only sanitized labels. Never place tokens, passwords, secret keys,
service-role keys, personal information, or raw private logs in this document.

| Item | Value |
|------|-------|
| Device A / OS | `NOT RECORDED` |
| Device B / OS | `NOT RECORDED` |
| Account A | `NOT RECORDED` |
| Account B | `NOT RECORDED` |
| Unrelated Account C | `NOT RECORDED` |
| Android build | `efe8bfe8-2d8e-4376-81d8-5b74fad9bf41` (1.5.0 / 902) |
| iOS build | `25ac6125-bec1-48eb-8a28-8b7a9dd20bf5` (1.5.0 / 909) |
| Staging creation flag | OFF — enable only for the test window |

Valid result values: `PASS`, `FAIL`, `NOT EXECUTED`, `BLOCKED`, and
`AWAITING USER EVIDENCE`. A case may be marked `PASS` only from explicit
physical-device evidence.

## Matrix

| ID | Scenario | Expected result | Result | Evidence / match / timestamp | Notes / defect |
|----|----------|-----------------|--------|------------------------------|----------------|
| AUTH-01 | Account A signs in on Device A | Correct authenticated session | NOT EXECUTED | — | — |
| AUTH-02 | Account B signs in on Device B | Separate authenticated session | NOT EXECUTED | — | — |
| AUTH-03 | Account C requests private match state | Access denied; no hidden data | NOT EXECUTED | — | — |
| AUTH-04 | Account C joins private match topic | Subscription rejected | NOT EXECUTED | — | — |
| AUTH-05 | Participant signs out mid-match | Match/channel access removed | NOT EXECUTED | — | — |
| AUTH-06 | Participant signs back in | Authorized access safely restored | NOT EXECUTED | — | — |
| MATCH-01 | Account A creates a match | One staged match created | NOT EXECUTED | — | — |
| MATCH-02 | Account B joins | Correct seat assigned once | NOT EXECUTED | — | — |
| MATCH-03 | Duplicate join | Rejected or idempotent | NOT EXECUTED | — | — |
| MATCH-04 | Same account attempts both seats | Rejected | NOT EXECUTED | — | — |
| MATCH-05 | Start before participants ready | Start rejected | NOT EXECUTED | — | — |
| MATCH-06 | Valid start | Both devices receive identical public state | NOT EXECUTED | — | — |
| TURN-01 | Active player submits legal action | Applied exactly once | NOT EXECUTED | — | — |
| TURN-02 | Inactive player acts | Rejected without state change | NOT EXECUTED | — | — |
| TURN-03 | Duplicate action submission | No duplicate effect | NOT EXECUTED | — | — |
| TURN-04 | Stale or invalid action | Rejected without divergence | NOT EXECUTED | — | — |
| TURN-05 | Turn transition | Ownership agrees on both devices | NOT EXECUTED | — | — |
| TURN-06 | Timer/deadline comparison | Values remain within accepted tolerance | NOT EXECUTED | — | — |
| HIDDEN-01 | Compare public state | Public state matches | NOT EXECUTED | — | — |
| HIDDEN-02 | Compare private hands | Each player sees only own hand | NOT EXECUTED | — | — |
| HIDDEN-03 | Inspect opponent payload/UI/log | No hidden opponent information | NOT EXECUTED | — | — |
| HIDDEN-04 | Draw/discard/deck counts | Counts stay synchronized | NOT EXECUTED | — | — |
| HIDDEN-05 | Reconnect private view | Correct player perspective restored | NOT EXECUTED | — | — |
| RT-01 | Legitimate private-topic join | Both participants join authorized topic | NOT EXECUTED | — | — |
| RT-02 | Account C private-topic join | Rejected | NOT EXECUTED | — | — |
| RT-03 | Unauthorized client broadcast/mutation | Rejected and observable as failure | NOT EXECUTED | — | — |
| RT-04 | Leave and return to match | One active subscription remains | NOT EXECUTED | — | — |
| RT-05 | Repeated navigation | No duplicate messages/actions | NOT EXECUTED | — | — |
| RT-06 | Auth token refresh | Private channel continues or safely rejoins | NOT EXECUTED | — | — |
| NET-01 | Disconnect Device A | Safe offline state | NOT EXECUTED | — | — |
| NET-02 | Reconnect Device A | Authoritative state recovered once | NOT EXECUTED | — | — |
| NET-03 | Disconnect Device B | Safe offline state | NOT EXECUTED | — | — |
| NET-04 | Reconnect Device B | Authoritative state recovered once | NOT EXECUTED | — | — |
| NET-05 | Background/foreground both apps | State and one subscription preserved | NOT EXECUTED | — | — |
| NET-06 | Force-close/reopen both apps | Correct checkpoint recovery | NOT EXECUTED | — | — |
| NET-07 | Interrupt near turn transition | No duplicate or skipped action | NOT EXECUTED | — | — |
| CHECK-01 | Restore checkpoint schema v2 | Valid checkpoint accepted | NOT EXECUTED | — | — |
| CHECK-02 | Restore deck/hand/discard | Exact authorized state restored | NOT EXECUTED | — | — |
| CHECK-03 | Restore with wrong account | Private state not exposed | NOT EXECUTED | — | — |
| CHECK-04 | Submit stale checkpoint/state | Newer authoritative state wins | NOT EXECUTED | — | — |
| FINAL-01 | Complete normal match | Same winner/final state on both devices | NOT EXECUTED | — | — |
| FINAL-02 | Repeat finalization request | Exactly-once, idempotent result | NOT EXECUTED | — | — |
| FINAL-03 | Verify rewards/stats/record | Recorded once | NOT EXECUTED | — | — |
| FINAL-04 | Act after completion | Rejected | NOT EXECUTED | — | — |
| FINAL-05 | Server-only finalize/reconcile as client | Access denied | NOT EXECUTED | — | — |
| FAIL-01 | Forfeit/abandonment | Correct single outcome | NOT EXECUTED | — | — |
| FAIL-02 | Disconnect beyond allowed window | Correct timeout outcome | NOT EXECUTED | — | — |
| FAIL-03 | Return after abandonment | Invalid match is not revived | NOT EXECUTED | — | — |
| FAIL-04 | Retry after transient failure | Safe and idempotent | NOT EXECUTED | — | — |
| REG-01 | Existing Solo gameplay | No regression | NOT EXECUTED | — | — |
| REG-02 | Existing Async Duel | No regression | NOT EXECUTED | — | — |
| REG-03 | Navigation and account switching | No crash or stale user data | NOT EXECUTED | — | — |
| REG-04 | QA ads/monetization | Test-safe behavior only | NOT EXECUTED | — | — |
| REG-05 | Production configuration check | Live PvP remains OFF | NOT EXECUTED | — | — |

## Exit criteria

The RC can advance only when all critical cases pass on two physical devices,
no critical/high defect remains, exactly-once finalization passes, hidden-state
isolation passes, reconnect/checkpoint recovery passes, and production flags
remain off.
