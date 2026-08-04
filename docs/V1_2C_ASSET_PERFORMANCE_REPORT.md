# Version 1.2C Asset Performance Report

Every asset in `src/assets/manifest/visualAssetManifestData.ts` (17
entries after Version 1.2B), measured directly from disk/metadata — no
estimates presented as measurements without a real source number.

## Real (non-code-driven) image assets

| Asset id | Filename | Pixel dimensions | File size (disk) | Decoded-memory estimate (w×h×4 bytes) | Transparency | Preloaded | Optional | Critical bundle asset | Layer | Fallback |
|---|---|---|---|---|---|---|---|---|---|---|
| `classic_arena_home_asset` | `assets/backgrounds/home-lava-portrait.webp` | 720×1600 | 16.9KB | ~4.4MB | No | Yes (`critical`) | No | Yes (Home background) | Background | none (terminal classic) |
| `classic_arena_gameplay_asset` | `assets/backgrounds/gameplay-embers.webp` | 1080×2400 | 12.2KB | ~9.9MB | No | Yes (`critical`) | No | Yes (Gameplay/Results background) | Background | none (terminal classic) |
| `classic_arena_gameplay_subtle_asset` | `assets/backgrounds/gameplay-embers-subtle.webp` | 1080×2400 | 10.3KB | ~9.9MB | No | Yes (`high`) | Yes | No | Background (alt variant) | `classic_arena_gameplay_asset` |
| `ember_overlay_particle_asset` | `assets/effects/embers-overlay.webp` | 1024×2048 | 25.3KB | ~8.0MB | Yes | No (`low`, lazy) | Yes | No | Foreground/ambient sprite | none |

All four are compressed WebP on disk (10-26KB) with a much larger
*decoded* in-memory footprint once GPU-uploaded as raw RGBA (4-10MB each)
— this is an inherent property of any full-screen bitmap at these pixel
dimensions, not something Version 1.2 introduced or made worse (all four
files and their dimensions are unchanged from Version 1.0/1.1B). No new
full-resolution background or sprite was added in Version 1.2A/1.2B/1.2C.

## Code-driven visuals (zero decoded-image memory; `estimatedMemoryBytes: 0`)

| Asset id | Type | Preloaded | Optional | Critical | Fallback |
|---|---|---|---|---|---|
| `classic_card_face_asset` | card_face_texture | Yes (`critical`) | No | Yes | none |
| `classic_card_back_asset` | card_back_texture | Yes (`critical`) | No | Yes | none |
| `midnight_card_face_asset` | card_face_texture | Yes (`normal`) | Yes | No | `classic_card_face_asset` |
| `ember_card_back_asset` | card_back_texture | Yes (`normal`) | Yes | No | `classic_card_back_asset` |
| `classic_lane_overlay_asset` | lane_overlay | Yes (`critical`) | No | Yes | none |
| `gold_lane_overlay_asset` | lane_overlay | Yes (`normal`) | Yes | No | `classic_lane_overlay_asset` |
| `classic_profile_frame_asset` | profile_frame | Yes (`critical`) | No | Yes | none |
| `flame_profile_frame_asset` | profile_frame | Yes (`normal`) | Yes | No | `classic_profile_frame_asset` |
| `classic_board_overlay_asset` | board_overlay | Yes (`critical`) | No | Yes | none |
| `ember_board_overlay_asset` (new, 1.2B) | board_overlay | No (`low`) | Yes | No | `classic_board_overlay_asset` |
| `classic_victory_overlay_asset` | victory_overlay | Yes (`high`) | No | Yes | none |
| `ember_victory_overlay_asset` (new, 1.2B) | victory_overlay | No (`low`) | Yes | No | `classic_victory_overlay_asset` |
| `lava_arena_tint_asset` | arena_background | Yes (`normal`) | Yes | No | `classic_arena_gameplay_asset` |

These are `View`/`LinearGradient`/`Text` compositions with no bitmap —
their "load" is instantaneous (`loadVisualAsset` resolves them to
`'loaded'` synchronously without touching `expo-asset`) and their
`estimatedMemoryBytes` is genuinely `0`, not an approximation.

## UI element assets (unrelated to the theme manifest, for completeness)

`assets/icons/*.svg` (14 files, vector, negligible decoded size) and
`assets/branding/*` are unaffected by this milestone and outside the
theme manifest's scope.

## Preload-tier confirmation (Version 1.2B mechanism, re-verified this milestone)

- **Launch** (`usePreloadEquippedVisualTheme`, mounted on Home): only
  `critical`/`high` priority ids among the equipped theme's
  `requiredAssets` — never every theme, never `low`/`normal` priority
  items like an unowned Ember piece.
- **Before gameplay** (`usePreloadGameplayCriticalVisualAssets`, mounted
  on `GameScreen`): the full equipped-theme `requiredAssets` set; ids
  already loaded by the launch tier are skipped (`statusById` cache hit)
  — never a duplicate request.
- **Lazy** (`usePreloadLockerPreviewAssets`, mounted on
  `BlazeLockerScreen`): every catalog entry's theme definition's
  `requiredAssets`, owned or not — only while the Locker is actually open.

## Anti-patterns checked and confirmed absent

| Anti-pattern | Status |
|---|---|
| Multiple full-resolution arena backgrounds in memory simultaneously | Not present — Home and Gameplay/Results never mount at the same time (stack navigation unmounts the previous screen), and Classic vs. Lava never both render a *second* full-res background (the lava tint is a code-driven gradient overlay on the existing photography, not a second image). |
| Animated GIFs | None anywhere in `assets/` — the codebase uses WebP for photography and Reanimated/`View` composition for motion. |
| Uncompressed frame sequences | None for theme assets — `assets/animations/countdown-fire-ring/*` is an unrelated, pre-existing gameplay countdown asset, already WebP-compressed per frame, untouched by this milestone. |
| Giant transparent PNGs | None — the one asset with transparency (`ember_overlay_particle_asset`) is 25.3KB, well under the 500KB guideline, and is not a "giant" file by any measure. |
| Repeated image decoding on every render | `loadVisualAsset` caches by id (`statusById`/`inFlightById` maps) — a given asset is downloaded/decoded at most once per app session regardless of how many components request it. |
| Continuous full-screen particle loops | `ThemedArenaBackground`'s ambient layer is a single static `Image`, not a looping particle system; board/victory effects are one-shot, bounded-duration bursts (see `docs/V1_2C_EFFECT_TIMING_FINAL.md`), never continuous. |
| Loading every theme at startup | Only the equipped theme's critical/high assets load at launch (see preload tiers above); unequipped themes' assets only load lazily when the Locker is opened. |

## Validator confirmation

`npm run validate:visual-assets` — 0 errors. 5 informational warnings (all
reviewed in `docs/V1_2B_ASSET_INVENTORY.md`): a low bytes-per-pixel ratio
on the four real WebP files (consistent with WebP's strong compression on
gradient-heavy photography, not evidence of a problem) and the
`ember_overlay_particle_asset` "unused by registry" note explained above.
None indicate an oversized, invalid, or broken asset.

## Optimization decision

**No optimization was necessary or performed this milestone.** All four
real image files are already well under the 500KB guideline (10-26KB
each); no approved source artwork was changed, destructively or
otherwise, per the release-candidate instruction to keep source files
unchanged and only optimize exported app assets when actually needed.
