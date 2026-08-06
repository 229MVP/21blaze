# Version 1.2B Designer Drop-In Guide

How to replace any of this milestone's code-driven Ember Blaze visuals
with approved professional art, without touching ownership, gameplay, or
architecture code. This extends the general process in
`docs/V1_2A_ASSET_HANDOFF_SPEC.md`'s "Asset replacement process" with the
exact checklist requested for this milestone.

## Step-by-step

1. **Export** the approved file using the documented filename from
   `docs/V1_2A_ASSET_HANDOFF_SPEC.md` (naming/format/dimensions) and
   `docs/V1_2B_MISSING_ASSET_REPORT.md` (the specific Ember asset id you
   are filling in).
2. **Place it** in the correct theme folder:
   `assets/themes/ember/<category>/<filename>` (e.g.
   `assets/themes/ember/cards/card-face-background.webp`). The folder
   scaffold already exists (`assets/themes/ember/.gitkeep`).
3. **Register or replace the static manifest reference**:
   - Add one entry to `src/assets/manifest/visualAssetManifestData.ts`
     (pure metadata: `id`, `type`, `isCodeDriven: false`, real `width` /
     `height` / `scale` / `aspectRatio`, `estimatedMemoryBytes`, an
     appropriate `preloadPriority`, `fallbackAssetId` pointing at the
     existing classic asset).
   - Add the matching `require('../../../assets/themes/ember/...')` to
     `ASSET_SOURCES` in `src/assets/manifest/visualAssetManifest.ts`, on
     one line (the validator's require-scanner is line-based).
   - Update the relevant `ThemeDefinition.requiredAssets` array in
     `src/themes/themeRegistry.ts` — never change the `themeId` itself.
4. **Run the asset validator**: `npm run validate:visual-assets`. Fix any
   error before proceeding (a warning about file size/aspect ratio is
   worth a second look but does not block).
5. **Open ThemePreviewScreen** (requires a dev build with
   `EXPO_PUBLIC_ENABLE_THEME_PREVIEW_DEV=true`; navigate via Settings →
   Developer → "OPEN THEME PREVIEW"). Use the "LOAD EMBER BLAZE" quick
   button in the "EMBER COLLECTION" section to see the new asset alongside
   every other piece at once.
6. **Check card readability** — compare the new art against Classic at
   both `small` (lane) and `large` (preview) `PlayingCard`/`ThemedCardBack`
   sizes in the CARD FACE / CARD BACK sections. Rank and suit text must
   stay legible; see `docs/V1_2C_CARD_READABILITY_AUDIT.md` for the full
   ranks × suits matrix this eventually needs to pass.
7. **Check arena cropping** — the ARENA BACKGROUND section renders the
   same `cropMode="cover"` used in gameplay; verify no important content
   sits in the outer safe-zone margins from the handoff spec.
8. **Check transparency** — toggle the "DARK OVERLAY" / "LIGHT OVERLAY"
   swatches in the ACCESSIBILITY / OVERLAY TOGGLES section to confirm the
   new asset reads correctly against both backdrops if it has any alpha.
9. **Check Reduced Motion** — flip the Reduced Motion switch in the same
   section and re-trigger the board/victory effects; confirm the static
   fallback still communicates the same information.
10. **Confirm classic fallback** — use the new "SIMULATE MISSING/FAILED
    ASSET" toggle in the ASSET STATUS (DEV) section; the new asset's
    category must render Classic with zero crash or blank space.
11. **Run exports**: `npx expo export --platform ios --clear` and
    `npx expo export --platform web --clear` must both succeed.
12. **Commit the asset and manifest update together** — one commit, so a
    future `git bisect`/revert never leaves a manifest entry pointing at a
    missing file or vice versa.

## Remaining Ember collection assets open for a future drop-in

See `docs/V1_2B_MISSING_ASSET_REPORT.md`, section 2, for the full table
(ids, dimensions, transparency, current fallback). In priority order for a
future milestone:

1. `ember_card_frame` (the one collection component with no cosmetic yet —
   would require a product/pricing decision before art, not just an asset
   drop-in; see the missing-asset report's explanation).
2. `ember_arena_background` / `ember_arena_foreground`.
3. `ember_lane_idle` / `ember_lane_selected` / `ember_lane_exact_21` /
   `ember_lane_bust`.
4. `ember_effect_card_placed` / `ember_effect_exact_21` /
   `ember_effect_five_card_clear` / `ember_effect_bust` /
   `ember_effect_multiplier` / `ember_effect_match_complete` /
   `ember_effect_victory`.
5. `ember_profile_frame`.

`ember_locker_preview` is intentionally not on this list — Locker previews
render the real production component directly and never need a separate
preview-only asset (see the handoff spec's "Preview image requirements").
