# Version 1.2A Asset Handoff Specification

This is the contract for any artist/vendor delivering assets for Version
1.2B. Following it means a real asset can be dropped in without any
gameplay, ownership, or architecture change.

## File naming

- Lowercase, kebab-case only: `ember-card-back-face.webp`, never
  `EmberCardBack.webp` or `ember card back.png` (spaces and inconsistent
  casing break on case-sensitive iOS builds and are flagged by
  `npm run validate:visual-assets`).
- Prefix with the theme family folder name is implied by location, not
  repeated in the filename (`assets/themes/ember/card-back.webp`, not
  `assets/themes/ember/ember-card-back.webp`).
- No spaces, no uppercase, no punctuation besides `-` and `.`.

## Export formats

- **WebP preferred** for all raster art (smaller than PNG at equivalent
  quality; already verified working with this Expo SDK — every existing
  production texture in this repo is WebP).
- **PNG** acceptable when WebP isn't available from the source tool, or
  when true lossless transparency at small sizes is required (icons).
- No JPEG for anything with transparency. No GIF, TIFF, PSD, or other
  formats — `npm run validate:visual-assets` rejects unsupported
  extensions.
- No SVG for card face/back/arena art (raster only) — SVG remains fine
  for the existing small UI icon set (`assets/icons/*.svg`), unaffected
  by this spec.

## Required dimensions (logical layout is 405×720 portrait)

| Asset type | Recommended size | Notes |
|---|---|---|
| `card_face_texture` background/frame layer | 240×340 @2x (source at 480×680) | Leaves room for dynamic rank/suit text on top — see "Card-face layers" below. |
| `card_back_texture` | 240×340 @2x (480×680) | Same canvas as card face for drop-in consistency. |
| `arena_background` | 1080×2400 (portrait, matches existing `gameplay-embers.webp`) | Must cover a 19.5:9 tall phone without important content in the outer ~8% each side (see Safe zones). |
| `board_overlay` / `victory_overlay` | 512×512 or 512×1024, transparent PNG/WebP | Composited over gameplay; keep the effect area small enough to tile/position without visible seams. |
| `lane_overlay` | 200×140 @2x | Matches a single lane's approximate footprint; must remain legible at the smallest lane card size (36×52 logical px, see `LaneBox`'s `laneCardSize`). |
| `profile_frame` | 256×256, transparent center | The center ~70% must stay transparent for the player initial/avatar. |
| `particle_sprite` | ≤64×64 per particle, sprite-sheet if animated | Keep total sheet under the performance budget (see `docs/V1_2_VISUAL_PERFORMANCE_BUDGET.md`). |

## Safe zones

- **Card face/back:** keep the outer 6% margin free of critical detail —
  `PlayingCard`/`ThemedCardBack` render rank/suit corner text starting
  ~3–7% from each edge depending on size; a full-bleed background is
  fine, but do not put readability-critical art directly under the
  corner text positions.
- **Arena background:** keep the top ~12% and bottom ~10% (safe-area +
  UI chrome) free of must-see detail; `ScreenContainer`/`BlazeScreenBackground`
  already apply a gradient darkening those zones for text contrast, so
  art there will be partially obscured by design.
- **Lane overlay:** must not visually cover the lane total/label text in
  the top-left of each lane box.

## Transparency rules

- `card_face_texture`, `card_back_texture`, `lane_overlay`,
  `board_overlay`, `victory_overlay`, `profile_frame`, and
  `particle_sprite` all support (and normally require) an alpha channel.
- `arena_background` should be fully opaque — it is the bottom-most
  layer; any transparency there falls through to the flat background
  color, which is intentional only if that is the desired look.
- Avoid large fully-transparent regions in an otherwise opaque image —
  wasted memory for no visual benefit (see performance budget).

## Card-face layers

`PlayingCard` renders rank and suit as **dynamic React Native `Text`**,
never baked into the image — this must never change, for both
accessibility (screen readers read the actual card identity) and
small-size readability (baked text becomes illegible at 36×52 logical
px). A delivered card-face asset is a **background/frame layer only**:
rank/suit text renders on top of it at runtime, in the color the active
theme specifies (see `PlayingCard`'s `faceVariant` branch). If a face-card
illustration (J/Q/K art) is delivered, it must sit behind the corner
rank/suit text and not obscure it.

## Card-back layers

A card back may be a single static image (`ThemedCardBack` simply
displays it), or an image plus a small code-driven overlay (matching the
existing `ember_card_back`'s flame mark + ember dots, which stay
code-driven even after a static base image is added). Do not animate
every face-down card continuously — any back-of-card animation must be
one-shot (e.g. on deal) or purely a static texture.

## Arena composition

Delivered as up to four separate layers so `ThemedArenaBackground` can
composite them without a single oversized flattened image: (1) base
background, (2) an optional foreground overlay (e.g. the lava tint), and
(3) an optional ambient particle sprite sheet. The existing gradient
treatment (contrast darkening for text/card readability) is applied by
the app, not baked into delivered art.

## Board-effect sprite requirements

Short (≤500ms), small (≤512×512), transparent sprites or sprite sheets.
Must have a clear "at rest" (fully transparent/invisible) start and end
frame so `ThemedBoardEffectLayer` can fade them in/out without a visible
pop.

## Victory-effect requirements

Same size/duration constraints as board effects, but may include a
subtle full-width sweep layer (transparent PNG/WebP, ≤200px tall) in
addition to a small particle sprite. Must have a Reduced Motion-safe
still-frame equivalent (a single glow, no animation) — see
`ThemedVictoryEffect`'s existing Reduced Motion branch.

## Preview image requirements

The Locker's `CosmeticPreview` renders the real production component at
a small fixed size (see `src/components/cosmetics/CosmeticPreview.tsx`)
— no separate "preview-only" asset is needed; whatever asset the theme
registry resolves for a category is exactly what previews.

## Source-file requirements

Deliver one editable source file (Figma, PSD, or equivalent) per theme
family alongside the exported web-ready assets. Source files are never
committed to this repository — reference them from
`docs/V1_2A_ASSET_HANDOFF_SPEC.md`'s asset-tracking sheet (external, not
part of this repo) so a future re-export is possible without asking the
original artist to reconstruct the file.

## Asset replacement process (stable ownership, changeable art)

1. Export the new asset per the naming/format rules above into the
   matching `assets/themes/<family>/<category>/` folder.
2. Add exactly one new entry to
   `src/assets/manifest/visualAssetManifestData.ts` (pure metadata) **and**
   the matching `require(...)` in `src/assets/manifest/visualAssetManifest.ts`.
3. Update only that theme's `requiredAssets` array in
   `src/themes/themeRegistry.ts` (and flip `isCodeDriven` off / attach the
   new asset id in the relevant `Themed*` component's variant branch).
4. **Never change the `themeId`** — it is identical to the
   `src/cosmetics/lockerCatalog.ts` cosmetic id, and every player's
   ownership row is keyed by that id. Swapping a code-driven gradient for
   professional art is purely a rendering change; no re-grant, no
   database migration, no client re-purchase is ever required.
5. Run `npm run validate:visual-assets` before committing.
