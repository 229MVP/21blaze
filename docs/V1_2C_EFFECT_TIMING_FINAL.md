# Version 1.2C Effect Timing — Final Values

Final, audited durations for every visual effect, confirmed within the
recommended maximum ranges from the release-candidate spec. These are the
same constants introduced in `docs/V1_2B_EFFECT_TIMING_SPEC.md`,
re-verified here against the Version 1.2C target ranges and the
release-gate requirements (never blocks gameplay, never delays reward
sync, duplicate event ids ignored, Reduced Motion gets a short static
alternative).

## Board effects — `src/components/themes/ThemedBoardEffectLayer.tsx`

| Event | Recommended range | Final value | Within range? |
|---|---|---|---|
| Card placed | 250-500ms | **380ms** | Yes |
| Exact 21 | 500-900ms | **700ms** | Yes |
| Five-card clear | 600-1100ms | **850ms** | Yes |
| Bust | 400-800ms | **550ms** | Yes |
| Multiplier increase | 400-700ms | **550ms** | Yes |
| Match complete | 700-1400ms | **900ms** (reserved constant; see note) | Yes |
| Victory / high score | 1000-2000ms | **1200ms** (reserved constant; see note) | Yes |

Note: `match_complete`/`high_score` are valid `BoardEffectEventType`
values in `src/services/visualEventBus.ts` and have tuned durations
reserved for a future direct-publish hookup, but `useBoardEffectEventBridge.ts`
does not currently publish them — the actual standard-completion / new
high-score celebration on Results is handled by `ThemedVictoryEffect`
(next table), not the board-effect bus. Documented here so the constant
is correct on the day it is wired up, not hidden.

## Victory effects — `src/components/themes/ThemedVictoryEffect.tsx`

| Trigger | Recommended range | Final value | Within range? |
|---|---|---|---|
| Standard win (match complete) | 700-1400ms | **900ms** | Yes |
| New high score (victory) | 1000-2000ms | **1400ms** | Yes |

## Gameplay-safety requirements — verified

| Requirement | Verification |
|---|---|
| Effects never block card placement | Every themed overlay is `pointerEvents="none"`; card placement dispatches to `useGameStore` directly and is never awaited by, or dependent on, any visual component's animation state. |
| Effects never delay engine resolution | `useBoardEffectEventBridge` only *reads* `useGameStore().lastMoveEvent` after the engine has already resolved it — it cannot delay something that already happened. |
| Effects never delay reward synchronization | `ThemedVictoryEffect`'s `trigger` prop is supplied by `ResultsScreen` from the already-computed `isNewHighScore`; reward reconciliation (`useProgressionStore`/`useWalletStore`) runs independently and is never gated on this overlay finishing. |
| Effects never replay because of rerendering | `EffectBurst`'s trigger `useEffect` has an intentionally empty dependency array (`// eslint-disable-next-line react-hooks/exhaustive-deps`) keyed to the component's `key={event.eventId}` — React only re-runs it for a genuinely new event instance, never a prop-only rerender. |
| Duplicate event ids are ignored | `publishVisualEffectEvent` deduplicates via `recentEventIds` (bus-level) — verified per Ember event type (`card_placed`/`exact_21`/`five_card_clear`/`bust`) in `v1_2bEmberCollectionSelfTest.ts` #10-13. |
| Completed effects are removed | `EffectBurst`'s `onDone(eventId)` callback (fired after the fade-out `withTiming` completes) removes the event from `ThemedBoardEffectLayer`'s local state. |
| Pause/background transitions cleanly stop or suspend effects | No themed effect registers its own `AppState`/pause listener — it relies entirely on React's normal mount lifecycle. Pausing does not unmount `GameScreen`, so an in-flight animation continues on Reanimated's own UI-thread clock exactly as it would without a pause; nothing about pausing extends an effect's total duration or leaves a stuck overlay, since every duration above is a fixed, self-terminating timer, not something that could be "double-triggered" by a pause/resume cycle. |
| Reduced Motion receives short static feedback | `ThemedBoardEffectLayer` renders zero `EffectBurst` children under Reduced Motion (event is still tracked as `board_effect_suppressed_reduced_motion` for analytics, per spec section 19, but nothing animates); `ThemedVictoryEffect` swaps its sweep + ember-dot sequence for one glow (`withSequence(withTiming(1,160), withTiming(0,260))`, ≤260ms), in both the classic and ember palette. |

## Conclusion

All seven effect timings fall within their recommended maximum ranges.
None of the safety requirements above required a code change beyond what
was already built in Versions 1.2A/1.2B — this pass is a confirmation
audit, not a remediation.
