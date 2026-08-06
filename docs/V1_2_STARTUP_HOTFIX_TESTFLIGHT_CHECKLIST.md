# Version 1.2.0 Startup Hotfix — TestFlight Verification Plan

## Build configuration for the first hotfix upload

Marketing version stays **1.2.0**. The next TestFlight upload must use a
new iOS build number via the existing EAS `autoIncrement` strategy (do
not reuse a previously uploaded number). The `testflight` EAS profile is
now configured for a **Classic-theme isolation build**:

```
EXPO_PUBLIC_ENABLE_V1_2_VISUAL_SYSTEM=false
EXPO_PUBLIC_ENABLE_BOARD_EFFECTS=false
EXPO_PUBLIC_ENABLE_VICTORY_EFFECTS=false
```

`EXPO_PUBLIC_ENABLE_V1_1_LOCKER`, `EXPO_PUBLIC_ENABLE_V1_1_REWARDS`,
`EXPO_PUBLIC_ENABLE_DAILY_REWARDS`, and `EXPO_PUBLIC_ENABLE_DAILY_MISSIONS`
are left **unchanged** (still enabled) per the hotfix brief's explicit
scope — only the visual-system flags are isolated for this build. No
Version 1.2 code or ownership data is removed; only rendering behavior
changes while these flags are off.

## Manual verification (requires an actual TestFlight install)

- [ ] **App opens to a visible screen within a few seconds** — never a
      sustained black screen. If somehow still black, note how long
      before anything appears (should be at most ~8s, per the startup
      watchdog) and whether it ever recovers.
- [ ] **Home screen renders** with the Classic theme (card back, arena,
      lane effects all Classic-styled) even though cosmetic ownership
      (if any was previously granted) is preserved.
- [ ] **Solo Play works end-to-end** — deal, place cards, bust/clear,
      timer, score, Results screen.
- [ ] **Blaze Locker opens** and shows correct ownership/equipped state
      and correct Blaze Coin balance (rendering stays Classic; ownership
      data underneath is untouched).
- [ ] **Force-quit and relaunch** — confirms the fix is not a one-time
      fluke of a warm process.
- [ ] **Airplane mode at launch** — app still reaches the Home screen
      (offline/local mode), Solo Play still works.
- [ ] **If a crash recovery screen ever appears** ("21 BLAZE COULDN'T
      START"): confirm both "TRY AGAIN" and "START WITH CLASSIC THEME"
      actually return to a visible, working Home screen, and that
      wallet/XP/high score/ownership are unchanged before and after.
- [ ] **Diagnostics**: on the recovery screen (if reached), tap "SHOW
      DIAGNOSTICS" and confirm a `LAST STARTUP STEP: ...` line appears
      (any non-empty stage name is a pass — this proves the diagnostic
      pipeline itself works, independent of whether an error occurred).

## Interpreting the result

- **If this Classic-isolation build launches successfully**: the visual
  startup path is confirmed as the failing area (per the hotfix brief).
  Do not re-enable `EXPO_PUBLIC_ENABLE_V1_2_VISUAL_SYSTEM` /
  `EXPO_PUBLIC_ENABLE_BOARD_EFFECTS` / `EXPO_PUBLIC_ENABLE_VICTORY_EFFECTS`
  for a future TestFlight build until the exact cause inside the visual
  system is identified (e.g. via a crash log from this build, since the
  black screen should no longer hide it — the new root `ErrorBoundary`
  will surface any remaining render-time error as a visible recovery
  screen instead) and is fixed and physically tested.
- **If this build still fails to launch**: the failure is NOT specific to
  the visual system — capture the device crash log (Xcode → Devices &
  Simulators → View Device Logs, or TestFlight crash reports) and check
  it against `docs/V1_2_STARTUP_BLACK_SCREEN_REPORT.md`'s findings table;
  the new root `ErrorBoundary` and startup diagnostics should make any
  remaining failure visible and diagnosable rather than a silent black
  screen.

## Re-enabling the visual system (future build, after this hotfix is verified)

1. Confirm the Classic-isolation build above launches successfully on
   real devices.
2. Obtain and review an actual crash log or reproduction from the
   original failing 1.2.0 build, or from a subsequent build with the
   visual system re-enabled but the rest of this hotfix's safety nets in
   place (the root `ErrorBoundary` should now surface the real error
   instead of a black screen).
3. Fix the specific cause found.
4. Re-enable `EXPO_PUBLIC_ENABLE_V1_2_VISUAL_SYSTEM` /
   `EXPO_PUBLIC_ENABLE_BOARD_EFFECTS` / `EXPO_PUBLIC_ENABLE_VICTORY_EFFECTS`
   in the `testflight` profile only after steps 1-3 are complete, and
   physically test the resulting build on a real device before wider
   distribution.
