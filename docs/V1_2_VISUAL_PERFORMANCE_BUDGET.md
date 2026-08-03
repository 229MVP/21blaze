# Version 1.2 Visual Performance Budget

## Guidelines

- Avoid single full-screen PNGs above reasonable mobile dimensions — for
  a 405×720 logical portrait layout, a source at 1080×2400 (the existing
  `gameplay-embers.webp`, @3x-equivalent for the tallest common device
  class) is the practical ceiling; do not deliver 4K+ source art expecting
  the app to downscale it at runtime.
- Prefer WebP; PNG only when required (see `docs/V1_2A_ASSET_HANDOFF_SPEC.md`).
- Avoid uncompressed multi-megabyte textures — every asset in this
  manifest today is under 40KB on disk (see measurements below); treat
  **500KB per asset** as a hard review trigger (`npm run
  validate:visual-assets` warns above this threshold) and **150KB** as
  the target ceiling for a single arena/card texture.
- Do not preload every future theme at startup — `visualAssetLoader.ts`
  only ever preloads the ids in the *currently resolved* theme's
  `requiredAssets` (`usePreloadEquippedVisualTheme`, wired into
  `HomeScreen`), never the full manifest.
- Lazy-load Locker previews — `CosmeticPreview` renders on-demand as each
  Locker card scrolls into view (React Native's default `ScrollView`
  children are already mounted lazily relative to initial layout; no
  additional windowing was added since the Locker catalog is small,
  currently 11 items).
- Limit simultaneous particles — `ThemedBoardEffectLayer` caps active
  effects at 3; `ThemedVictoryEffect`'s ember burst is capped at 6 dots,
  only for the `newHighScore` trigger.
- Avoid full-screen blur animations — none exist in this codebase; do not
  introduce one without re-measuring on a real device first (RN blur
  views are comparatively expensive on Android).
- Avoid repeated image decoding — `visualAssetLoader.ts` caches load
  status per asset id and de-duplicates concurrent requests via an
  in-flight promise map; the same asset is never decoded twice
  concurrently.
- Avoid unnecessary transparency in large images — `arena_background`
  entries are intentionally opaque; only overlay/particle/frame layers
  use alpha.

## Measured existing asset sizes (as of Version 1.2A)

All figures from the actual files in `assets/` at the time of this audit.
The **largest** assets in the repository, by file size:

| File | Size | Dimensions | Used for |
|---|---|---|---|
| `assets/icon.png` | 388KB | app icon (not runtime-loaded) | iOS/Android app icon only — never decoded during gameplay. |
| `assets/branding/21-blaze-logo-512.png` | 96KB | 512×512 | Home logo (`blazeAssets.logoMain`). |
| `assets/android-icon-foreground.png` | 80KB | Android adaptive icon | Not runtime-loaded. |
| `assets/effects/fire-stopwatch-512.webp` | 36KB | 512×512 | Timer warning icon. |
| `assets/animations/countdown-fire-ring/frame-*.webp` | ~24–32KB each (60 frames) | countdown animation frames | Only used during the pre-match countdown; not part of any theme. |
| `assets/effects/embers-overlay.webp` | 28KB | 1024×2048 | Ambient ember particle overlay (`ember_overlay_particle_asset` in the new manifest). |
| `assets/backgrounds/home-lava-portrait.webp` | 17KB | 720×1600 | Home arena background (`classic_arena_home_asset`). |
| `assets/backgrounds/gameplay-embers.webp` | 12KB | 1080×2400 | Gameplay arena background (`classic_arena_gameplay_asset`). |
| `assets/backgrounds/gameplay-embers-subtle.webp` | 10KB | 1080×2400 | Subtle gameplay variant (`classic_arena_gameplay_subtle_asset`). |

**Conclusion: no current asset is a performance risk.** Every gameplay
texture is well under the 150KB target, and the largest file (`icon.png`)
is never loaded at runtime — it's consumed at build time for the native
app icon only. `npm run validate:visual-assets` will flag any future
addition over 500KB automatically.

## Estimated decoded (in-memory) sizes

Decoded RGBA memory is `width × height × 4 bytes`, independent of the
compressed file size on disk — this is the number that matters for
device memory pressure, not the WebP/PNG file size:

| Asset | Decoded estimate |
|---|---|
| `classic_arena_gameplay_asset` (1080×2400) | ~10.4MB |
| `classic_arena_gameplay_subtle_asset` (1080×2400) | ~10.4MB |
| `ember_overlay_particle_asset` (1024×2048) | ~8.4MB |
| `classic_arena_home_asset` (720×1600) | ~4.6MB |

These four together (~34MB decoded) are the full existing background
budget, and only ONE arena background is ever mounted at a time (Home,
Gameplay, or Results each show one `BlazeScreenBackground`, never more
than one simultaneously) — actual peak usage is closer to
10–15MB for backgrounds at any given moment, well within a modern
mobile device's budget. `visualAssetManifestData.ts`'s
`estimatedMemoryBytes` field carries this same calculation per entry so
future 1.2B additions can be reviewed against the same yardstick before
they're added.

## Reporting

Run `npm run validate:visual-assets` to get an up-to-date report — it
warns on any asset over 500KB on disk and flags any filename that
doesn't follow the lowercase-kebab-case convention required for
iOS/case-sensitive-filesystem safety.

## Non-destructive policy

This audit did **not** compress, resize, or otherwise alter any existing
approved art — every measurement above is read-only. Any future
compression pass must preserve an original, uncompressed source copy
outside this repository (per `docs/V1_2A_ASSET_HANDOFF_SPEC.md`'s
"Source-file requirements").
