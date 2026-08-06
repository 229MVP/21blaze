# Version 1.2B Effect Timing Spec

Initial timing pass for the Ember Blaze collection's board/victory
effects, set within the ranges later re-audited and finalized in
`docs/V1_2C_EFFECT_TIMING_FINAL.md`. All durations below are the **total
on-screen time** of the decorative overlay; none of them are awaited by
any gameplay, reward, or navigation code path.

## Board effects (`ThemedBoardEffectLayer.tsx`, `EFFECT_DURATION_MS`)

| Event | Duration | Notes |
|---|---|---|
| `card_placed` | 380ms | Short lane pulse; fades in over 90ms, out over the remainder. |
| `exact_21` | 700ms | Brighter, longer highlight than a plain placement. |
| `five_card_clear` | 850ms | Longest board flash — gives the clear sweep room to read. |
| `bust` | 550ms | Fast-in (90ms), same fade-out curve as the rest. |
| `multiplier_up` | 550ms | Matches bust's weight — both are "state changed" moments. |
| `streak_increased` | 550ms | Reserved for a future streak-visual hookup; not currently published by `useBoardEffectEventBridge`. |
| `match_complete` | 900ms | Reserved; not currently published via the board-effect bus (handled by `ThemedVictoryEffect` on Results instead). |
| `high_score` | 1200ms | Reserved; same note as above. |

## Victory effects (`ThemedVictoryEffect.tsx`, `SWEEP_DURATION_MS`)

| Trigger | Duration | Notes |
|---|---|---|
| `standardWin` | 900ms | Board glow (180ms in, remainder fading out) + horizontal sweep. |
| `newHighScore` | 1400ms | Same shape, longer, plus 6 rising ember dots staggered by 30ms each. |

## Mechanism guarantees (unchanged from Version 1.2A, re-verified this milestone)

- Every burst is removed from state automatically after its own duration
  completes (`onDone(eventId)` / the trigger effect's cleanup) — nothing
  needs a second interaction to disappear.
- Duplicate `eventId`s are ignored at the bus level
  (`publishVisualEffectEvent`), so a re-render can never replay the same
  occurrence — verified per-event-type in
  `v1_2bEmberCollectionSelfTest.ts` scenarios 10-13.
- A capped queue (`MAX_SIMULTANEOUS_EFFECTS = 3`) drops the oldest burst
  rather than growing unboundedly during a rapid sequence (e.g. cascading
  clears).
- Under Reduced Motion, `ThemedBoardEffectLayer` renders zero `EffectBurst`
  children and `ThemedVictoryEffect` swaps its sweep + ember dots for one
  brief (≤260ms) non-moving glow — in both classic and Ember palettes.
- Effects are `pointerEvents="none"` and hidden from screen readers
  (`accessibilityElementsHidden` / `importantForAccessibility="no-hide-descendants"`)
  throughout.
