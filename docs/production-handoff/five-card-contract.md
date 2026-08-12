# Five-card lane contract

Every lane exposes exactly five visible slots at the assigned phone size. The implementation uses `grid-template-columns: repeat(5, minmax(0, 1fr))`, so all five slots divide the available lane width without horizontal overflow.

## Reference viewport

- Logical export: 427 × 922 px
- Source export: 853 × 1844 px
- Large export: 1280 × 2766 px
- Lane placement units: percentages of the full app viewport
- Slot count: 5
- Minimum interactive lane target: 44 × 44 CSS px
- Horizontal slot gap: 2 CSS px
- Card aspect ratio: 0.69

## Stress state

Lane 1 begins with `A♥, 2♠, 3♦, 4♣, 8♥`, totaling 18. This deliberately fills all five slots while preserving the reference score. Lane 2 begins at 7, Lane 3 at 0, and Lane 4 at 15.

## Fit behavior

- Wide rails and chevrons use five equal horizontal columns.
- Radial, square, hexagonal, comic, reactor, deco, mecha, and aurora lanes use five equal horizontal columns inside their bounded panels.
- Glasshouse Ember uses five equal vertical rows because its assigned lanes are tall towers.
- Empty capacity remains visible as outlined slots.
- A sixth card is never added; tapping a full lane returns a full-capacity status instead.

## Responsive rule

The lanes are positioned and sized with normalized percentages, while each card track uses `minmax(0, 1fr)`. The combination prevents content-based expansion and keeps the fifth slot inside the assigned geometry on both the iPhone and Pixel prototype presets.
