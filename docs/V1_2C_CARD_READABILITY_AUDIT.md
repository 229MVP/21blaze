# Version 1.2C Card Readability Audit

## Scope

All 13 ranks (A, 2-10, J, Q, K) × 4 suits, across every supported card
face style (Classic, Midnight — Ember has no dedicated card face; see
below), at `small` (lane, 44×64) and `large` (preview, 118×166) sizes,
selected/disabled states, and Reduced Motion, per spec section 5. No
jokers — the game engine does not use them (`src/game/constants.ts`'s
`RANKS`/`SUITS` define exactly 13×4 = 52 cards; confirmed unchanged this
milestone).

## Method

Colors and layout are defined entirely in code
(`src/components/cards/PlayingCard.tsx`, `src/components/cards/CardBack.tsx`),
so this audit computes exact WCAG relative-luminance contrast ratios for
every rank/suit-color combination rather than relying on a visual
screenshot pass (no device/simulator available in this environment — see
`docs/V1_2B_VISUAL_TEST_MATRIX.md`'s environment note). Every color pair
below is read directly from the component source, not approximated.

## Contrast ratios (WCAG 2.1 relative luminance)

| Face style | Foreground | Background | Ratio | WCAG AA (4.5:1 normal text / 3:1 large/bold text) |
|---|---|---|---|---|
| Classic | Red suits `#D92222` | Card face `#F7F3EA` | **4.51:1** | Passes large/bold text (rank glyphs render at `fontWeight: '900'`, qualifying as bold); at the boundary for normal-weight small text, which this app never uses for rank/suit — always bold. |
| Classic | Black suits `#121416` | Card face `#F7F3EA` | **16.67:1** | Passes both thresholds by a wide margin. |
| Midnight | Red suits `#FF5A5A` | Card face `#141414` | **6.02:1** | Passes both thresholds. |
| Midnight | Ivory (clubs/spades) `#E8E0D0` | Card face `#141414` | **14.04:1** | Passes both thresholds. |

Both styles meet or exceed Classic's own bar — **neither theme makes cards
harder to read than Classic** (spec's explicit requirement). Midnight is
measurably higher-contrast than Classic on both suit colors.

## Rank / suit identifiability

- Rank glyphs (`A`, `2`-`10`, `J`, `Q`, `K`) render as real, dynamic
  `Text` in every style — never baked into an image (verified: `PlayingCard`
  has no `card_face_texture` image layer under text; `faceVariant` only
  changes `color`/`backgroundColor`, never the text content).
- Suit symbols (`♥ ♦ ♣ ♠`) render the same way, from `suitSymbol` (pure
  lookup in `cardUtils.ts`), identical characters across every theme.
- `adjustsFontSizeToFit` + `minimumFontScale={0.7}` on the primary rank
  glyph prevents truncation/clipping at the smallest (`tiny`/`small`) card
  sizes across all themes equally.
- Hearts and diamonds are always the theme's "red" color; clubs and
  spades are always the theme's "black"/"ivory" color — the red/black (or
  red/ivory) split itself, not merely hue, distinguishes the two suit
  groups even for a red-green colorblind viewer (this app never
  distinguishes information by a red vs. green pair).
- Face cards (J/Q/K) and Aces render with the exact same rank-glyph
  mechanism as number cards — no separate illustration exists yet in
  either style, so there is nothing that could obscure or replace the
  programmatic rank text.

## Card identity remains programmatic

`cardAccessibilityLabel(rank, suit)` (pure, `src/components/cards/cardUtils.ts`)
produces the full spoken identity (e.g. "Ace of Hearts") independent of
`faceVariant`/`backVariant` — verified by a unit test
(`v1_2bEmberCollectionSelfTest.ts` #5). `PlayingCard`'s
`accessibilityLabel` appends `, midnight style` only as a style
descriptor, never altering or omitting the rank/suit content. No visual
theme changes what `rank`/`suit` a card *is* — that remains entirely
game-engine state, never read from or written by any theme module
(verified structurally, `v1_2bEmberCollectionSelfTest.ts` #6-9).

## Selected / disabled states

- `selected`/`highlighted`: adds a glow border (`shadows.glow`) and
  changes only the border color, never the rank/suit foreground color —
  contrast ratios above are unaffected.
- `disabled`: `opacity: 0.45` uniformly dims the whole card (border, text,
  and background together), preserving the same foreground/background
  ratio (opacity does not change relative contrast between two colors
  faded by the same factor against a static background, and the app never
  disables a card the player still needs to read to make a legal move —
  disabled cards are always non-interactive, already-placed, or
  input-locked).

## Reduced Motion

No themed card component runs an animation on its base rank/suit
rendering (only board/victory/lane *effects* animate, all reviewed
separately in `docs/V1_2C_EFFECT_TIMING_FINAL.md`). Card readability is
therefore identical with Reduced Motion on or off.

## Bright / dark arena backgrounds

Every card renders on top of an `ImageBackground` + gradient darkening
layer (`ThemedArenaBackground`/`BlazeScreenBackground`), which always
darkens toward the card region regardless of arena theme (Classic or Lava)
— the card's own opaque background (`#F7F3EA` or `#141414`) is unaffected
by whatever renders behind it; cards are never rendered with a transparent
background that would let the arena bleed through and reduce contrast.

## Ember card face

There is no dedicated Ember card-face style (see
`docs/V1_2B_MISSING_ASSET_REPORT.md`) — card face stays Classic or
Midnight regardless of a player's Ember card-back/arena/lane/frame
choices. This audit's Classic/Midnight results therefore cover 100% of
what a Version 1.2.0 tester can actually select.

## Conclusion

**Pass.** No theme shipped in Version 1.2.0 makes cards harder to read
than Classic; both available card-face styles exceed WCAG AA for their
bold rank/suit text, and card identity remains fully programmatic and
accessible in every case.
