# Version 1.2B Ember Blaze Collection Spec

## Theme definition

`emberBlazeTheme` — `src/themes/emberBlazeTheme.ts`. A static, **display-only**
composite `VisualTheme` used by the Locker's collection preview and the
developer Theme Preview screen's "Ember vs. Classic" comparison. It is
**never** what a real player's loadout resolves to — that always comes from
`resolvePlayerVisualTheme()`, driven by their own independently-equipped
per-slot cosmetics (see "Coordinated effects", below).

| Field | Value |
|---|---|
| `themeId` | `ember_blaze` |
| `cardFaceTheme` | `classic_card_face` (no Ember card-face cosmetic exists — see `docs/V1_2B_MISSING_ASSET_REPORT.md`) |
| `cardBackTheme` | `ember_card_back` |
| `arenaTheme` | `lava_arena_tint` |
| `laneTheme` | `gold_lane_glow` |
| `boardEffectTheme` | `ember_board_effect` (new, non-ownable) |
| `victoryEffectTheme` | `ember_victory_effect` (new, non-ownable) |
| `profileFrameTheme` | `flame_profile_frame` |
| `playerTitleTheme` | `seven_day_blaze_title` |

## Cosmetic ID mapping (unchanged from Version 1.1B)

| Collection component | Cosmetic id | Blaze Coin cost | Unlock method |
|---|---|---|---|
| Ember card back | `ember_card_back` | 150 | Blaze Coins |
| Gold lane glow | `gold_lane_glow` | 250 | Blaze Coins |
| Lava arena | `lava_arena_tint` | 500 | Blaze Coins |
| Flame profile frame | `flame_profile_frame` | 400 | Blaze Coins |
| Seven Day Blaze title | `seven_day_blaze_title` | — | 7-day daily streak |

None of these ids, prices, or unlock methods changed in this milestone —
verified by `src/themes/v1_2bEmberCollectionSelfTest.ts` scenario 17.

## Coordinated board/victory effects (new mechanism this milestone)

`board_effect` and `victory_effect` have no cosmetic of their own — nothing
is separately purchasable for them (spec section 4 lists them as
collection *components*, not new store items). Instead,
`resolveEmberFamilyEffectThemes()` (`src/themes/resolvePlayerVisualTheme.ts`)
derives them from how many of the four equippable Ember pieces
(`ember_card_back`, `lava_arena_tint`, `gold_lane_glow`,
`flame_profile_frame`) are **currently resolved** into the player's other
slots:

- **0–1 pieces equipped:** `boardEffectTheme` / `victoryEffectTheme` stay
  `classic_board_effect` / `classic_victory_effect` (neutral gold palette).
- **2+ pieces equipped (`EMBER_COORDINATION_THRESHOLD`):** both resolve to
  `ember_board_effect` / `ember_victory_effect` (saturated orange/red
  palette), and the resolved theme's `themeId` becomes `'ember_blaze'`.

This makes the collection feel like "one coordinated theme" (spec section
4) without a seventh purchase or a second ownership system — it only reads
already-resolved, already-ownership-checked theme ids. An unowned or
asset-failed piece never counts toward the threshold (it has already fallen
back to classic before this calculation runs).

## Visual language

| Element | Classic | Ember Blaze |
|---|---|---|
| Card-placement/exact-21/bust/multiplier board flashes | Neutral gold (`#C9A227` family) | Saturated orange/red (`#FF8A00`/`#FF3426` family) |
| Victory glow | `#E0C478` (soft gold) | `#FF6500` (ember orange) |
| Victory ember burst dots | `#E0C478` | `#FFB629` |
| Lane border | Neutral orange (`colors.border.orange`) | Gold (`#FFC94A`), brighter flash (`#FFE18C`) |
| Card back | Classic diamond motif | Charcoal/ember gradient, orange border, flame mark |
| Arena | Flat gradient darkening | + lower lava-glow gradient (`rgba(120,16,4,...)` → `rgba(20,4,2,...)`) |
| Profile frame | Neutral ring | Orange-to-gold ring with flame accents |

Every palette keeps cards, lane totals, the timer, and the score at or
above the existing Classic contrast — none of these effects render behind
or through card/text content (`pointerEvents="none"`, `accessibilityElementsHidden`
throughout every themed overlay).

## Non-negotiables preserved

- Ownership resolution unchanged: `resolvePlayerVisualTheme` still requires
  `ownedIds.has(id) || freeIds.has(id)` before any category resolves to a
  non-classic theme.
- No gameplay value (card identity, deck order, score, timer, rewards) is
  ever read by, or influences, anything in `src/themes/` — verified
  structurally in `v1_2bEmberCollectionSelfTest.ts` scenarios 6-9.
- RevenueCat/paid purchases untouched — the collection is 100%
  Blaze-Coin/streak earnable, exactly as Version 1.1B shipped it.
