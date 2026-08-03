# Version 1.2B Missing Asset Report

Every asset the Ember Blaze collection needs today is present and
code-driven (see `docs/V1_2B_ASSET_INVENTORY.md`). This report covers the
one genuinely missing piece plus the "future professional art" slots a
designer could later drop in to replace a working code-driven visual with
baked artwork — none of these block or degrade the current release; every
row below already has a safe, shipped fallback.

## 1. Ember Card Face (genuinely missing — no cosmetic exists)

| Field | Value |
|---|---|
| Asset id | `ember_card_face_asset` (not yet registered) |
| Intended component | `card_face_texture` background/frame layer, consumed by `PlayingCard`'s `faceVariant` prop (would add a third variant alongside `classic` / `midnight`) |
| Required filename | `assets/themes/ember/cards/card-face-background.webp` |
| Required format | WebP (PNG acceptable) — per `docs/V1_2A_ASSET_HANDOFF_SPEC.md` |
| Required dimensions | 240×340 @2x (source 480×680), per the handoff spec's `card_face_texture` row |
| Transparency | Not required (opaque background layer; rank/suit text renders on top) |
| Safe-area requirements | Outer 6% margin free of critical detail (corner rank/suit text zone) |
| Fallback currently used | **Classic Card Face** (`classic_card_face`) — the resolved theme's `cardFaceTheme` never falls back to Midnight or any other non-Classic style; it stays exactly what a player has equipped in that slot, independent of their card back/arena/lane/frame choices |
| Why it doesn't exist yet | No `ember_card_face` cosmetic was ever added to `src/cosmetics/lockerCatalog.ts` / the Version 1.1B database seed. Creating one would mean a new purchasable cosmetic, a new Blaze Coin price, and a new database row — explicitly out of scope for a visual-polish milestone (spec section 4: "Do not rename database cosmetic IDs merely to match the collection name" and the wider instruction not to add new purchasable content in this pass). |
| Disposition | Registered here as the one open collection slot. `emberBlazeTheme` (the Locker's "Ember Blaze Collection" preview) intentionally keeps `cardFaceTheme: classicTheme.cardFaceTheme` rather than claiming a piece that does not exist — see `src/themes/emberBlazeTheme.ts`'s doc comment. |

## 2. Future professional-art drop-in slots (all already have a shipped, polished code-driven fallback)

These are documented per `docs/V1_2A_ASSET_HANDOFF_SPEC.md`'s naming
convention so a designer can later replace any of them without touching
ownership or gameplay code (see `docs/V1_2B_DESIGNER_DROP_IN_GUIDE.md`).
None of these are placeholders in the "looks unfinished" sense — every one
renders a complete, intentional, already-shipped visual today.

| Suggested asset id | Intended component | Required dimensions | Transparency | Safe-area | Fallback in use today |
|---|---|---|---|---|---|
| `ember_card_frame` | Card-face frame/border overlay for a future dedicated Ember card face | 240×340 @2x | Yes (frame only, transparent center) | Outer 6% margin | N/A — see item 1 above; card face stays Classic |
| `ember_arena_background` | Dedicated Ember/Lava arena base photography (distinct from the shared `gameplay-embers.webp`) | 1080×2400 | No (opaque) | Top 12% / bottom 10% | Existing `classic_arena_gameplay_asset` + code-driven lava tint overlay |
| `ember_arena_foreground` | Optional lightweight foreground vignette | 1080×2400, transparent | Yes | N/A | None rendered (optional layer, currently omitted intentionally) |
| `ember_lane_idle` / `ember_lane_selected` / `ember_lane_exact_21` / `ember_lane_bust` | Static lane-state art (alternative to the animated gold border) | 200×140 @2x | Yes | Must not cover lane total text | Code-driven `ThemedLaneEffect` gold border + flash animation |
| `ember_effect_card_placed` / `ember_effect_exact_21` / `ember_effect_five_card_clear` / `ember_effect_bust` / `ember_effect_multiplier` / `ember_effect_match_complete` / `ember_effect_victory` | Sprite/sprite-sheet alternative to the code-driven burst overlays | ≤512×512, transparent | Yes | Must have a fully-transparent "at rest" frame | Code-driven `ThemedBoardEffectLayer` / `ThemedVictoryEffect` bursts, ember palette |
| `ember_profile_frame` | Static image alternative to the code-driven flame ring | 256×256, transparent center | Yes | Center ~70% transparent | Code-driven `ProfileFrameBadge` `flame` variant |
| `ember_locker_preview` | N/A — not needed | — | — | — | `CosmeticPreview` renders the real production component; no separate preview asset is ever required (see handoff spec) |

## Policy confirmation

- No random substitute art was generated for any row above.
- No third-party assets were downloaded.
- The app runs, and every screen renders a complete, intentional visual,
  with zero rows in this report blocking startup, gameplay, or the Locker.
- Nothing here was "faked" as art that exists — every fallback listed is
  the real, currently-shipped rendering path, not a stub.
