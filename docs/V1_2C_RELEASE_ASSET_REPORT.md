# Version 1.2C Release Asset Report

Every release asset touched by the Version 1.2 visual system, classified
per the required set: **Approved production asset**, **Production-ready
code-driven visual**, **Safe classic fallback**, **Unfinished
placeholder**, **Missing**, **Invalid**, **Oversized**, **Unused**.

Source review: `docs/V1_2B_ASSET_INVENTORY.md`, `docs/V1_2B_MISSING_ASSET_REPORT.md`,
`src/assets/manifest/visualAssetManifestData.ts` (17 entries),
`src/themes/themeRegistry.ts` (16 theme definitions), every `assets/themes/**`
directory, every Locker preview, every Ember theme component, and the
classic fallback path in `src/themes/defaultTheme.ts`.

## Classification

| Asset / visual | Classification | Notes |
|---|---|---|
| `classic_card_face_asset` (Classic card face) | Production-ready code-driven visual | Shipped since Version 1.0; renders via `PlayingCard`'s default branch. |
| `classic_card_back_asset` (Classic card back) | Production-ready code-driven visual | Shipped since Version 1.0. |
| `midnight_card_face_asset` (Midnight card style) | Production-ready code-driven visual | Shipped in Version 1.1B; near-black + high-contrast ivory/red. |
| `ember_card_back_asset` (Ember card back) | Production-ready code-driven visual | Shipped in Version 1.1B; charcoal/ember gradient + flame mark. |
| `classic_arena_home_asset` / `classic_arena_gameplay_asset` / `classic_arena_gameplay_subtle_asset` | **Approved production asset** | Real WebP photography, already shipped since Version 1.0/1.1, well within the size budget (10-17KB each). |
| `lava_arena_tint_asset` (Lava Arena) | Production-ready code-driven visual | Gradient overlay composited over the approved arena photography above. |
| `classic_lane_overlay_asset` / `gold_lane_overlay_asset` | Production-ready code-driven visual | Vector border/flash, by design (per the 1.2A handoff spec, lane overlays are lightweight code, not baked art). |
| `classic_board_overlay_asset` / `ember_board_overlay_asset` | Production-ready code-driven visual | `ThemedBoardEffectLayer`'s tinted burst — new registry entries this milestone, code-driven, zero bytes. |
| `classic_victory_overlay_asset` / `ember_victory_overlay_asset` | Production-ready code-driven visual | `ThemedVictoryEffect`'s tinted glow/sweep — same as above. |
| `classic_profile_frame_asset` / `flame_profile_frame_asset` | Production-ready code-driven visual | `ProfileFrameBadge` default/flame rings. |
| `ember_overlay_particle_asset` | **Approved production asset** (but **Unused** by the theme registry specifically) | Real WebP (26KB), used directly by `ThemedArenaBackground`'s ambient layer, not wired to any `ThemeDefinition.requiredAssets`. Not a broken/orphaned file — see `docs/V1_2B_ASSET_INVENTORY.md`. Kept because removing it would regress the existing ambient-ember visual on Home/Results. |
| Ember card face | **Missing** | No cosmetic/asset exists (see `docs/V1_2B_MISSING_ASSET_REPORT.md`). **Not exposed anywhere in the release UI** — `emberBlazeTheme`'s `cardFaceTheme` stays Classic, and the Locker's Ember collection preview never lists a card-face swatch that doesn't exist. |
| Classic fallback (`classicTheme`, `src/themes/defaultTheme.ts`) | **Safe classic fallback** | Universal terminal fallback for every category; verified to always resolve and never throw (`resolveThemeDefinition`, bounded-hop walk). |

## Unfinished placeholders found

**None.** Every asset in the manifest and theme registry renders a
complete, intentional visual — there is no code path that shows a
"missing image" icon, a gray box, a "coming soon" label, or dev-only text
to a release build. The one open collection slot (Ember card face) is
handled by omission (Classic renders instead), not by a visible
placeholder, satisfying the release-scope lock's "hide the related theme
option" requirement.

## Oversized / invalid assets found

**None.** `npm run validate:visual-assets` reports 0 errors. Its 500KB
per-file guideline is not exceeded by any asset (largest is 35KB,
`assets/effects/fire-stopwatch-512.webp`, unrelated to the theme
manifest). See `docs/V1_2C_ASSET_PERFORMANCE_REPORT.md` for full
measurements.

## Unused assets found

- `ember_overlay_particle_asset` — see table above; intentional, not dead
  code, documented rather than silently ignored.

## Disposition

No release-scope changes were required — nothing needed to be hidden or
swapped for a fallback beyond what was already true entering this
milestone (the Ember card face slot, which was never exposed in the first
place). The asset validator, run as part of this milestone's validation
pass, would fail loudly (non-zero exit) if a future change introduced a
broken required-asset reference, a duplicate id, or a dangling fallback —
this is a standing release gate, not a one-time manual check.
