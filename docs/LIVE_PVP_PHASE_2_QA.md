# Live PvP Phase 2 — Two-Device Manual QA

Honest matrix for physical / multi-network validation.  
**Do not mark unperformed cases as Pass.**

Environment: Expo React Native · Supabase Live PvP · flag `EXPO_PUBLIC_ENABLE_LIVE_PVP`

| Field | Value |
| --- | --- |
| Build / commit | _fill in_ |
| Protocol version | 1 |
| Tester | _fill in_ |
| Date | _fill in_ |

## Shared preconditions

1. Two authenticated accounts (A challenger, B opponent).
2. Live PvP creation enabled server-side (`get_live_pvp_ops_status`).
3. Client flag enabled on both devices.
4. Push configured only where noted; push failure must not block invite/settlement.

---

## Cases

### LP2-QA-001 — iOS vs iOS happy path

| | |
| --- | --- |
| Test ID | LP2-QA-001 |
| Devices | iOS A, iOS B |
| Accounts | A, B |
| Preconditions | Same Wi-Fi optional |
| Steps | A: Home → Live PvP → Challenge B → Send. B: Accept → both Ready → countdown → play → both finish. |
| Expected | Lobby, one countdown, identical deck conditions, authoritative result (no local winner). |
| Actual | _untested_ |
| Pass/fail | _ |
| Notes | |

### LP2-QA-002 — Android vs Android happy path

| | |
| --- | --- |
| Test ID | LP2-QA-002 |
| Devices | Android A, Android B |
| Accounts | A, B |
| Preconditions | Same as 001 |
| Steps | Same as 001 |
| Expected | Same as 001 |
| Actual | _untested_ |
| Pass/fail | _ |
| Notes | |

### LP2-QA-003 — iOS vs Android

| | |
| --- | --- |
| Test ID | LP2-QA-003 |
| Devices | iOS, Android |
| Accounts | A, B |
| Preconditions | Cross-platform builds |
| Steps | Full invite → lobby → ready → game → result |
| Expected | Parity; no platform-only channel leaks |
| Actual | _untested_ |
| Pass/fail | _ |
| Notes | |

### LP2-QA-004 — Same Wi-Fi

| | |
| --- | --- |
| Test ID | LP2-QA-004 |
| Devices | Any pair |
| Accounts | A, B |
| Preconditions | Shared LAN |
| Steps | Happy path |
| Expected | Stable subscribe; provisional opponent scores update |
| Actual | _untested_ |
| Pass/fail | _ |
| Notes | |

### LP2-QA-005 — Different networks

| | |
| --- | --- |
| Test ID | LP2-QA-005 |
| Devices | Any pair |
| Accounts | A, B |
| Preconditions | Distinct ISPs / hotspots |
| Steps | Happy path |
| Expected | Still settles; progress may lag but sequences reconcile |
| Actual | _untested_ |
| Pass/fail | _ |
| Notes | |

### LP2-QA-006 — Cellular vs Wi-Fi

| | |
| --- | --- |
| Test ID | LP2-QA-006 |
| Devices | Any pair |
| Accounts | A, B |
| Preconditions | One cellular, one Wi-Fi |
| Steps | Happy path + mid-match score glance |
| Expected | Timer server-anchored; reconnect labels advisory only |
| Actual | _untested_ |
| Pass/fail | _ |
| Notes | |

### LP2-QA-007 — Moderate latency

| | |
| --- | --- |
| Test ID | LP2-QA-007 |
| Devices | Any pair |
| Accounts | A, B |
| Preconditions | Network link conditioner ~150–300 ms |
| Steps | Ready + game progress |
| Expected | No duplicate channels; Ready remains server-persisted |
| Actual | _untested_ |
| Pass/fail | _ |
| Notes | |

### LP2-QA-008 — Packet loss

| | |
| --- | --- |
| Test ID | LP2-QA-008 |
| Devices | Any pair |
| Accounts | A, B |
| Preconditions | Simulated loss |
| Steps | Play through reconnecting banner |
| Expected | No auto-forfeit; snapshot reconcile restores state |
| Actual | _untested_ |
| Pass/fail | _ |
| Notes | |

### LP2-QA-009 — One player backgrounds

| | |
| --- | --- |
| Test ID | LP2-QA-009 |
| Devices | Any pair |
| Accounts | A, B |
| Preconditions | Match active |
| Steps | A backgrounds 20s then returns |
| Expected | Official timer continued; remaining time recalculated; no pause |
| Actual | _untested_ |
| Pass/fail | _ |
| Notes | |

### LP2-QA-010 — One player reconnects

| | |
| --- | --- |
| Test ID | LP2-QA-010 |
| Devices | Any pair |
| Accounts | A, B |
| Preconditions | Active match |
| Steps | Toggle airplane mode briefly on A |
| Expected | RECONNECTING UX; bounded retry; snapshot fetch; play continues if deadline remains |
| Actual | _untested_ |
| Pass/fail | _ |
| Notes | |

### LP2-QA-011 — Force-close

| | |
| --- | --- |
| Test ID | LP2-QA-011 |
| Devices | Any pair |
| Accounts | A, B |
| Preconditions | Active match |
| Steps | Force-close A mid-match; reopen app |
| Expected | Per documented process-death policy: **Phase 2 does not advertise a fake Resume**. Match may time out / settle server-side; Hub shows current status. |
| Actual | _untested_ |
| Pass/fail | _ |
| Notes | Documented limitation if local checkpoint restore is not shipped. |

### LP2-QA-012 — Forfeit

| | |
| --- | --- |
| Test ID | LP2-QA-012 |
| Devices | Any pair |
| Accounts | A, B |
| Preconditions | After countdown |
| Steps | A Leave → confirm Forfeit & Leave |
| Expected | Server forfeit; B sees victory by forfeit; A defeat |
| Actual | _untested_ |
| Pass/fail | _ |
| Notes | Background alone must not forfeit. |

### LP2-QA-013 — Timeout

| | |
| --- | --- |
| Test ID | LP2-QA-013 |
| Devices | Any pair |
| Accounts | A, B |
| Preconditions | Short config or wait full duration |
| Steps | Let gameplay deadline pass without completion |
| Expected | Authoritative timeout / settlement; no fabricated local loss before server |
| Actual | _untested_ |
| Pass/fail | _ |
| Notes | |

### LP2-QA-014 — Both finish simultaneously

| | |
| --- | --- |
| Test ID | LP2-QA-014 |
| Devices | Any pair |
| Accounts | A, B |
| Preconditions | Coordinated finish |
| Steps | Both complete within ~1s |
| Expected | Idempotent completion; one settlement; correct perspective |
| Actual | _untested_ |
| Pass/fail | _ |
| Notes | |

### LP2-QA-015 — One finishes early

| | |
| --- | --- |
| Test ID | LP2-QA-015 |
| Devices | Any pair |
| Accounts | A, B |
| Preconditions | Active |
| Steps | A finishes first |
| Expected | Waiting-for-opponent with provisional B score; then result when settled |
| Actual | _untested_ |
| Pass/fail | _ |
| Notes | |

### LP2-QA-016 — Push-opened invitation

| | |
| --- | --- |
| Test ID | LP2-QA-016 |
| Devices | Device with push |
| Accounts | B |
| Preconditions | Push token registered |
| Steps | Open LIVE_MATCH_INVITE_RECEIVED push after A invites |
| Expected | Auth restore → snapshot → current invite UI (or current state if already accepted/expired) |
| Actual | _untested_ |
| Pass/fail | _ |
| Notes | Stale push must not revive expired invite. |

### LP2-QA-017 — Account switching

| | |
| --- | --- |
| Test ID | LP2-QA-017 |
| Devices | One device |
| Accounts | A then C |
| Preconditions | A in lobby channel |
| Steps | Sign out / switch account to C |
| Expected | Channel removed; no A match state shown for C |
| Actual | _untested_ |
| Pass/fail | _ |
| Notes | |

### LP2-QA-018 — Long display names

| | |
| --- | --- |
| Test ID | LP2-QA-018 |
| Devices | Any |
| Accounts | Long-name profiles |
| Preconditions | Max-length display names |
| Steps | Hub, lobby, header, result |
| Expected | Truncation without layout break; a11y label intact |
| Actual | _untested_ |
| Pass/fail | _ |
| Notes | |

### LP2-QA-019 — Large text

| | |
| --- | --- |
| Test ID | LP2-QA-019 |
| Devices | iOS + Android |
| Accounts | Any |
| Preconditions | OS large accessibility text |
| Steps | Hub → invite → lobby → result |
| Expected | Readable; no critical clip of Ready / Forfeit |
| Actual | _untested_ |
| Pass/fail | _ |
| Notes | |

### LP2-QA-020 — VoiceOver

| | |
| --- | --- |
| Test ID | LP2-QA-020 |
| Devices | iOS |
| Accounts | Any |
| Preconditions | VoiceOver on |
| Steps | Ready, connection, result headlines |
| Expected | Ready/connection/outcome not color-only; countdown announcements controlled |
| Actual | _untested_ |
| Pass/fail | _ |
| Notes | |

### LP2-QA-021 — TalkBack

| | |
| --- | --- |
| Test ID | LP2-QA-021 |
| Devices | Android |
| Accounts | Any |
| Preconditions | TalkBack on |
| Steps | Same as 020 |
| Expected | Same as 020 |
| Actual | _untested_ |
| Pass/fail | _ |
| Notes | |

---

## Sign-off

| Area | Status |
| --- | --- |
| Automated Phase 2 self-tests | see CI / local run |
| Two-device physical matrix | **not executed in cloud agent environment** |
| Push delivery | environment-dependent |
