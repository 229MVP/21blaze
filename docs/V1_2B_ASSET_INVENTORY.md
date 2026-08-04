# Version 1.2B Asset Inventory

Audit date: this milestone. Scope: every asset the Ember Blaze collection
(spec section 3) touches, checked against `docs/V1_2A_ASSET_HANDOFF_SPEC.md`
and `docs/V1_2_VISUAL_PERFORMANCE_BUDGET.md`. Status values match the
required classification set exactly: **Present and valid**, **Present but
needs optimization**, **Present but incorrectly named**, **Present but
incorrect dimensions**, **Placeholder available**, **Missing**, **Invalid**,
**Oversized**, **Unused**.

No professional/approved art files exist anywhere under `assets/themes/`
today — `assets/themes/ember/` contains only a `.gitkeep` (verified with a
full filesystem search; see "Method" below). Every Ember visual shipped in
this milestone is therefore the **existing, working, code-driven Version
1.1B visual** (already reviewed and shipped), wrapped by the Version 1.2A
theme registry rather than newly-fabricated art.

## Method

```
find assets -type f | sort   # 122 files total, cross-checked against
                              # src/assets/manifest/visualAssetManifestData.ts
```

`assets/themes/{classic,ember,lava,midnight,future}/**` all contain only
`.gitkeep` placeholders (from the 1.2A folder scaffold) — zero real image
files. The 122 real files are: app icons, `assets/audio/*`,
`assets/animations/countdown-fire-ring/*` (unrelated to themes — gameplay
countdown), `assets/backgrounds/*`, `assets/effects/embers-overlay.webp`,
`assets/branding/*`, and `assets/icons/*` (unrelated UI icons).

## Ember collection components

| Component | Cosmetic / theme id | Status | Notes |
|---|---|---|---|
| Ember card face | *(none — no cosmetic exists)* | **Missing** | No `ember_card_face` cosmetic was ever created in Version 1.1B; `docs/V1_2B_MISSING_ASSET_REPORT.md` registers the intended slot. Card face stays Classic/Midnight only. |
| Ember card back | `ember_card_back` | **Present and valid** | Code-driven (`src/components/cards/CardBack.tsx`'s `variant="ember"` branch) — charcoal/ember gradient, orange border, flame mark, ember dots. Already shipped in Version 1.1B; now registered as `ember_card_back_asset` (code-driven) in the 1.2A/1.2B manifest. |
| Ember arena (Lava Arena) | `lava_arena_tint` | **Present and valid** | Code-driven overlay in `ThemedArenaBackground.tsx` (`isLava` branch: dark base gradient + lower lava-glow gradient) layered over the existing real `gameplay-embers.webp` / `home-lava-portrait.webp` background photography, which are themselves **Present and valid** (`classic_arena_gameplay_asset` / `classic_arena_home_asset`). |
| Gold/Ember lane effect | `gold_lane_glow` | **Present and valid** | Code-driven (`ThemedLaneEffect.tsx`'s `isGold` branch + `LaneBox`'s existing gold border) — no image file needed or expected per the handoff spec (lane overlays are lightweight vector/gradient by design). |
| Card-placement effect | n/a (event, not a cosmetic) | **Present and valid** | `ThemedBoardEffectLayer.tsx`, `card_placed` event, ember palette in this milestone's `EMBER_EFFECT_COLOR`. |
| Exact-21 effect | n/a | **Present and valid** | Same component, `exact_21` event. |
| Five-card-clear effect | n/a | **Present and valid** | Same component, `five_card_clear` event. |
| Bust effect | n/a | **Present and valid** | Same component, `bust` event. |
| Multiplier-up effect | n/a | **Present and valid** | Same component, `multiplier_up` event. |
| Match-complete effect | n/a | **Present and valid** | `ThemedVictoryEffect.tsx`, `standardWin` trigger, now theme-tinted (ember vs. classic palette) in this milestone. |
| Victory / high-score effect | n/a | **Present and valid** | Same component, `newHighScore` trigger. |
| Flame profile frame | `flame_profile_frame` | **Present and valid** | Code-driven (`ProfileFrameBadge.tsx`'s `flame` variant) — orange/gold ring, flame accents. |
| Ember player-title styling | `seven_day_blaze_title` | **Present and valid** | Code-driven (`PlayerTitleBadge.tsx`), unlocked via the existing 7-day streak, unrelated to Blaze Coins. |
| Locker preview art | n/a | **Present and valid** | `CosmeticPreview.tsx` renders the real production components above at Locker card size — by design there is no separate "preview-only" asset (see `V1_2A_ASSET_HANDOFF_SPEC.md`'s "Preview image requirements"). |
| Ember Blaze Collection preview | n/a (new, this milestone) | **Present and valid** | New `EmberCollectionPreview.tsx` in the Locker, built entirely from the same real components above. |
| `ember_board_effect` / `ember_victory_effect` theme rows | n/a (non-ownable) | **Present and valid** | New this milestone — derived, coordinated tint applied when 2+ real Ember pieces are equipped (see `docs/V1_2B_EMBER_COLLECTION_SPEC.md`). |

## Reused non-theme assets touched by this audit

| Asset id | File | Status |
|---|---|---|
| `classic_arena_home_asset` | `assets/backgrounds/home-lava-portrait.webp` | Present and valid (720×1600 @2x, ~1.6MB decoded estimate) |
| `classic_arena_gameplay_asset` | `assets/backgrounds/gameplay-embers.webp` | Present and valid (1080×2400 @3x) |
| `classic_arena_gameplay_subtle_asset` | `assets/backgrounds/gameplay-embers-subtle.webp` | Present and valid |
| `ember_overlay_particle_asset` | `assets/effects/embers-overlay.webp` | **Unused** (by the theme registry specifically) — flagged by `npm run validate:visual-assets`. Used directly by `ThemedArenaBackground`'s `ambientEffect` layer via `blazeAssets.emberOverlay`, not through any theme definition's `requiredAssets`. Documented here rather than silently ignored; no action needed — it is not dead code, just not registry-driven. |

No asset in this milestone is: incorrectly named, incorrect dimensions,
invalid, or oversized (the validator's 500KB/file guideline and the new
bytes-per-pixel heuristic both pass with only informational warnings — see
`docs/V1_2C_ASSET_PERFORMANCE_REPORT.md`).

## Conclusion

The Ember Blaze collection is production-ready using its existing,
already-shipped Version 1.1B code-driven visuals, now unified under one
theme registry entry (`emberBlazeTheme`, `src/themes/emberBlazeTheme.ts`)
and one coordinated board/victory-effect tint. Nothing in this milestone
required fabricating art; the only genuinely missing piece — a dedicated
Ember card face — is registered as a future asset slot in
`docs/V1_2B_MISSING_ASSET_REPORT.md` and never shown as broken or
unfinished (Classic card face renders in its place, which is itself a
polished, shipped visual).
