# Figma handoff

## Suggested page structure

1. `00 Cover`
2. `01 Gameplay — 12 Directions`
3. `02 Components`
4. `03 Tokens`
5. `04 Export Ready`

## Screen frames

Create twelve frames at 427 × 922 px and name them with the numbered theme names in `theme-manifest.json`. Place the matching `@1x.png` as the locked art layer. Use the `@2x` and `@3x` files only for export or high-density review.

## Component hierarchy

- `Gameplay/ScoreRail`
- `Gameplay/Lane`
  - Properties: `theme`, `laneNumber`, `score`, `cardCount`, `state`
  - States: `idle`, `selected`, `full`, `bust`
- `Gameplay/CardSlot`
  - States: `empty`, `occupied`
- `Gameplay/CardFace`
  - Properties: `rank`, `suit`, `size`
- `Gameplay/CurrentCard`
- `Controls/GameButton`
  - Properties: `action`, `state`
- `Controls/ThemeSwitcher`

## Auto-layout rules

- Standard card tracks: horizontal auto layout, five children, Fill container, 2 px gap.
- Glasshouse card tracks: vertical auto layout, five children, Fill container, 3 px gap.
- Cards and empty slots must use Fill container inside a fixed five-item track; never use content width.
- Preserve a 44 px minimum tap target even when the visible lane treatment is smaller.

## Theme assembly

Use the normalized lane rectangles from `theme-manifest.json`. Convert `x`, `y`, `width`, and `height` percentages against a 427 × 922 frame. The `x` and `y` values refer to the lane center. Apply the listed rotation after centering.

## Export naming

`NN-theme-name@1x.png`, `NN-theme-name@2x.png`, and `NN-theme-name@3x.png`.
