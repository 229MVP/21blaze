# Production V1 Screenshot QA

Reference: Android screenshots supplied 2026-08-13.

## Fixed from source evidence

- P0: Production Live PvP no longer dereferences incomplete player/card snapshots; it shows a recoverable syncing state.
- P1: Classic cards now have an explicit opaque cream surface instead of Android transparency over the dark board.
- P1: Five cards are constrained to each lane using 25 x 38 dp cards and clipped lane content.
- P2: Live and practice layouts use matching compact lane-card dimensions.

## Verification

- Type checking and Production V1 regression suites pass.
- Local Expo web preview responds successfully.
- Browser screenshot capture could not run because the in-app Browser runtime was blocked by the Windows sandbox.

final result: blocked