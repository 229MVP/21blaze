# Version 1.2B Visual Test Matrix

## Environment note

This cloud agent environment has no iOS/Android simulator or physical
device attached — the checks below were performed via (a) static layout
review of every affected component's style rules, (b) `npx expo export`
for both `ios` and `web` targets (bundling/asset-resolution correctness),
and (c) the automated self-tests
(`npm run test:v1.2b-ember-collection`). Anything that requires an actual
rendered frame on real hardware (visual regression, frame-rate, on-device
memory) is marked **Pending manual QA** below and is re-scoped into the
Version 1.2C TestFlight checklist (`docs/V1_2_TESTFLIGHT_CHECKLIST.md`)
rather than falsely claimed as verified here.

## Screen sizes

| Size | Method | Result |
|---|---|---|
| 320×800 | Style review — every themed component uses relative/flex layout (`StyleSheet.absoluteFill`, `flexWrap`, percentage-based `left`), no fixed widths beyond the existing `PlayingCard` size table (unchanged this milestone) | No new fixed-width elements introduced; `EmberCollectionPreview`'s piece grid uses `flexWrap: 'wrap'` and 66px cells, which wrap to 2 rows at this width by calculation (5 × 66px + gaps > 320px) | Pending manual QA (visual confirmation) |
| 360×800 / 390×844 / 430×932 | Same | Same reasoning; wider screens fit the same row without wrapping | Pending manual QA |
| Small / standard / large iPhone | Same as above (RN style layout is resolution-independent) | Pending manual QA |
| Tablet portrait/landscape | `ScreenContainer`/existing screens already support tablets (`supportsTablet: true` in `app.json`, unchanged); no themed component added a phone-only assumption | Pending manual QA |
| Desktop web | `npx expo export --platform web --clear` succeeds (see Version 1.2C validation log); `Platform.OS === 'web'` paths in `visualAssetLoader.ts` unaffected by this milestone | Verified (export) / Pending manual QA (visual) |

## Gameplay situations (code-review verified this milestone; full device pass in 1.2C checklist)

| Situation | Verification |
|---|---|
| Rapid placement | `ThemedBoardEffectLayer`'s `MAX_SIMULTANEOUS_EFFECTS = 3` queue cap (unchanged, re-verified) prevents unbounded growth; per-event dedupe re-tested per Ember event type in `v1_2bEmberCollectionSelfTest.ts` #10-13 |
| Four active lanes | No themed component reads lane count; effects are per-event, not per-lane-count |
| Exact 21 / five-card clear / bust | Durations re-tuned this milestone (`docs/V1_2B_EFFECT_TIMING_SPEC.md`); dedupe verified |
| Multiple effects close together | Queue cap + per-`eventId` dedupe (existing mechanism, unchanged) |
| Pause during an effect | Effects are pure `Animated`/`Reanimated` values on already-mounted components; a pause does not unmount `GameScreen`, so in-flight animations continue on their own timers exactly as before this milestone (no new pause-interaction code added) |
| Background during an effect | Same reasoning — no new AppState handling needed or added this milestone; existing gameplay AppState handling in `GameScreen.tsx` is unmodified |
| Resume | Same |
| Match completion / new high score | `ThemedVictoryEffect` re-tuned (palette + duration) this milestone; `trigger` still comes only from `ResultsScreen`'s already-computed `isNewHighScore`, never invented |
| Reduced Motion | Re-verified for both classic and ember palettes (new this milestone) — see effect timing spec |
| Offline startup | `useResolvedVisualTheme` unaffected by network state (reads from the already-hydrated `useCosmeticStore`); no new network calls added |
| Optional asset failure | New this milestone: `findThemeIdsRequiringAnyAsset` + `subscribeToAssetFailures` wiring (`src/cosmetics/useLockerCosmetics.ts`) — verified with a pure unit test (`v1_2bEmberCollectionSelfTest.ts` #4, #18) |

## Confirmed via automation this milestone

- No card clipping: `PlayingCard`'s size table is unchanged; no new width/height introduced.
- No unreadable ranks: card face/back rendering paths unchanged (Ember only affects card **back**, not face).
- No effect blocks touches: every themed overlay is `pointerEvents="none"` (verified by reading each component's root `View`/`Animated.View`).
- No lane layout shift: `ThemedLaneEffect` is `position: 'absolute'`, overlaid on top of `LaneBox`, never affecting its measured size.
- No repeated effect after rerender: per-`eventId` dedupe, re-verified per event type.
- No crash from missing art: `resolvePlayerVisualTheme` wrapped in try/catch (unchanged), plus the new asset-failure fallback path is exercised by a unit test.
- No web-native initialization error: `npx expo export --platform web --clear` passes; no new native-only API introduced (Reanimated/gesture-handler usage is identical to existing 1.2A components).

## Not yet claimed as verified

- On-device frame-rate under rapid effect bursts.
- Actual pixel-level arena cropping on a truly notched device.
- Real memory growth over ten consecutive Solo matches on a physical
  device (see `docs/V1_2C_ASSET_PERFORMANCE_REPORT.md` for the
  code-review-based memory/lifecycle audit and its own caveats).

These carry forward into `docs/V1_2_TESTFLIGHT_CHECKLIST.md` as required
manual test cases before the Version 1.2.0 build is submitted.
