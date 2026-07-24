# Audio & Haptics Test Matrix

Use this matrix on real devices. Do **not** mark native audio/haptics as passed from browser-only testing.

Placeholder WAVs under `assets/audio/` are original synthesized cues (documented in `assets/audio/README.md`). Replace with final mix when available; keep `soundManifest.ts` keys stable.

## Environments

| Platform | Device / build | Build profile | Tester | Date |
|---|---|---|---|---|
| Android | _TBD_ | `preview` (APK) | | |
| iOS | _TBD_ | `preview` (internal) | | |
| Web | Browser | `expo start --web` | | |

## Sound matrix

| Sound key | Trigger | Expected | Actual | Volume OK | Duplicate? | SFX on | SFX off | Background | Pass/Fail | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| `buttonTap` | Shared `BlazeButton` press | One short click | | | | Plays | Silent | Stops/no play | | |
| `cardDeal` | New `activeCard` id | One deal cue | | | | Plays | Silent | Stops | | |
| `cardPlaced` | `lastMoveEvent.type === placed` | One place cue | | | | Plays | Silent | Stops | | |
| `laneClear` | Exact 21 / five-card clear | One clear cue | | | | Plays | Silent | Stops | | |
| `bust` | Real bust move | One bust cue | | | | Plays | Silent | Stops | | |
| `countdownTick` | Countdown 3 / 2 / 1 | One tick each | | | | Plays | Silent | Stops | | |
| `countdownGo` | Countdown `0` / BLAZE | One go cue | | | | Plays | Silent | Stops | | |
| `multiplierIncrease` | Multiplier rises | One rise cue | | | | Plays | Silent | Stops | | |
| `finalSecondsWarning` | Enter ≤10s once/match | One warning | | | | Plays | Silent | Stops | | No repeat every tick |
| `newHighScore` | Results high-score once | One fanfare | | | | Plays | Silent | Stops | | Deduped by matchId |

## Haptics matrix

| Haptic | Trigger | Expected (native) | Web | Haptics on | Haptics off | Pass/Fail | Notes |
|---|---|---|---|---|---|---|---|
| `buttonPressed` | Button press | Selection | No-op | Fires | Silent | | |
| `laneSelected` | Lane tap | Selection | No-op | Fires | Silent | | |
| `cardPlaced` | Successful place | Light impact | No-op | Fires | Silent | | |
| `laneCleared` | Clear | Success notification | No-op | Fires | Silent | | |
| `bust` | Bust | Error notification | No-op | Fires | Silent | | |
| `multiplierRaised` | Multiplier up | Medium impact | No-op | Fires | Silent | | |
| `countdownTick` | 3/2/1 | Light impact | No-op | Fires | Silent | | |
| `countdownGo` | BLAZE | Heavy impact | No-op | Fires | Silent | | |
| `warning` | Final 10s | Warning notification | No-op | Fires | Silent | | Once/match |
| `highScore` | New high score | Success notification | No-op | Fires | Silent | | Once/result |

## Background / AppState

| Case | Expected | Pass/Fail | Notes |
|---|---|---|---|
| Solo match running → app background | Game pauses; SFX stop/deactivate | | Existing Solo pause preserved |
| Return to foreground | Audio available again; match stays paused | | Do not auto-resume Solo |
| Toggle Sound Effects off mid-cue | Active SFX stop; future cues silent | | |
| Toggle Haptics off | Immediate stop of future haptics | | |

## Sign-off

| Platform | Audio | Haptics | Settings | AppState | Signed |
|---|---|---|---|---|---|
| Android device | Pending | Pending | Pending | Pending | |
| iOS device | Pending / blocked | Pending / blocked | Pending / blocked | Pending / blocked | |
| Web fallback | Safe silent/partial | No-op | Pending | Pending | |
