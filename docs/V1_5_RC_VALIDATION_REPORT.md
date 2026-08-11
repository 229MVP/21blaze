# Version 1.5 RC Validation Report

**Branch:** `cursor/v1-5-rc-validation-1a6b`  
**Source:** `origin/cursor/v1-5-shared-staging-qa-builds-1a6b` @ `68e816e`  
**Report date:** 2026-08-11

## Current decision

### `RC QA IN PROGRESS — HUMAN EVIDENCE REQUIRED`

The automated RC baseline and both installable internal builds are ready.
Physical two-device testing has not been executed, staging match creation remains
off, and no physical result is inferred from automated evidence.

## Automated baseline

| Gate | Result |
|------|--------|
| Shared staging migration head | PASS — `20260811140153_enqueue_player_notification_drop_7arg_overload` |
| Staging API privilege verification | PASS — prior shared-staging gate |
| TypeScript | PASS |
| Expo dependency compatibility | PASS |
| Expo Doctor | PASS — 20/20 |
| Core regression self-tests | PASS |
| Live PvP phase 1, 2, 3, and release tests | PASS |
| Visual assets | PASS |
| Direct `expo-constants` dependency | FIXED and verified |
| Database advisors | NOT EXECUTED — secure DB password required |

## Internal builds

| Platform | Build ID | Version | Result |
|----------|----------|---------|--------|
| Android | `efe8bfe8-2d8e-4376-81d8-5b74fad9bf41` | 1.5.0 / 902 | FINISHED — installable APK |
| iOS | `25ac6125-bec1-48eb-8a28-8b7a9dd20bf5` | 1.5.0 / 909 | FINISHED — Ad Hoc IPA |

Both builds use the `live-pvp-qa` internal profile and expire on 2026-11-09.
Artifact URLs remain outside committed documentation.

## Flag state

| Control | State |
|---------|-------|
| Shared staging `live_pvp_creation_enabled` | OFF |
| QA client Live PvP | ON in `live-pvp-qa` build only |
| TestFlight Live PvP | OFF |
| Production Live PvP | OFF |

## Physical test state

| Item | State |
|------|-------|
| Two physical devices | NOT RECORDED |
| Distinct participant accounts | NOT EXECUTED |
| Unrelated-account denial | NOT EXECUTED |
| Complete normal match | NOT EXECUTED |
| Disconnect/reconnect both devices | NOT EXECUTED |
| Checkpoint recovery | NOT EXECUTED |
| Hidden-state isolation | NOT EXECUTED |
| Exactly-once finalization/rewards | NOT EXECUTED |
| Forfeit/timeout path | NOT EXECUTED |

Use `docs/V1_5_TWO_DEVICE_TEST_MATRIX.md` for the physical session and
`docs/V1_5_RC_DEFECT_LOG.md` for failures.

## Remaining human actions

1. Install the completed internal builds on two physical devices.
2. Prepare three sanitized staging accounts: two participants and one unrelated account.
3. Enable shared-staging match creation only for the test window.
4. Execute and evidence the full two-device matrix.
5. Disable staging match creation after the session unless another session follows immediately.
6. Run database advisors through a secure local database-password prompt before production sign-off.

Production flags must remain off throughout RC validation.
