# Theme asset folders

Prepared in Version 1.2A as the landing structure for professional theme
art delivered in Version 1.2B. **No existing production assets were moved
here** — `assets/backgrounds/`, `assets/effects/`, `assets/branding/`, and
`assets/animations/` remain exactly where they are, still referenced by
`src/assets/blazeAssets.ts` and `src/assets/manifest/visualAssetManifest.ts`
unchanged.

## Layout

```
assets/themes/
  classic/
    cards/           card_face_texture assets for the classic theme
    card-backs/       card_back_texture assets for the classic theme
    arenas/          arena_background assets for the classic theme
    lanes/           lane_overlay assets for the classic theme
    board-effects/   board_overlay / particle_sprite assets
    victory-effects/ victory_overlay assets
    profile/         profile_frame assets
  ember/             future "Ember" family assets (currently code-driven only)
  midnight/          future "Midnight" family assets (currently code-driven only)
  lava/              future "Lava" family assets (currently code-driven only)
  future/            reserved for a theme family not yet named
assets/shared/
  icons/             cross-theme icon assets
  particles/         reusable particle sprite sheets
  textures/           reusable base textures (noise, grain, gradients-as-image)
  placeholders/       safe fallback art used when a real asset is missing
```

## How to add a new asset in Version 1.2B

1. Place the exported file in the matching category folder above,
   following `docs/V1_2A_ASSET_HANDOFF_SPEC.md` (naming, dimensions, safe
   zones, formats).
2. Add exactly one new entry to
   `src/assets/manifest/visualAssetManifest.ts` with a literal
   `require('../../../assets/themes/.../file.webp')` — never a
   dynamically-built path.
3. If the asset replaces a currently code-driven visual (e.g. swapping
   `ember_card_back`'s gradient for real art), update only that theme's
   `requiredAssets` list in `src/themes/themeRegistry.ts`. The theme's
   `themeId` (and therefore every player's ownership record) never
   changes — see "Asset replacement process" in
   `docs/V1_2A_ASSET_HANDOFF_SPEC.md`.
4. Run `npm run validate:visual-assets` before committing.

## Migration notes

No file paths changed in Version 1.2A. This structure is additive.
