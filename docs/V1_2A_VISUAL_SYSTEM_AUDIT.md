# Version 1.2A Visual System Audit

Audit performed at the start of Version 1.2A, against the Version 1.1C
state merged into `main`. Classifications: **Reusable**, **Reusable with
cleanup**, **Hardcoded**, **Duplicated**, **Missing**, **Performance
risk**. Nothing below is assumed to exist without being read directly
from the repository.

## Summary

Version 1.1B/1.1C already built a real, working, code-driven cosmetic
system (catalog, ownership, equip slots, and five small themed visual
components). It is a solid foundation but was built directly into
gameplay components with hardcoded, per-cosmetic `if` branches rather
than a general theme model — exactly the gap Version 1.2A closes. No
professional art pipeline, asset manifest, or developer preview tooling
existed before this milestone.

## Component-by-component status

| Component | Status | Notes |
|---|---|---|
| `PlayingCard` (`src/components/cards/PlayingCard.tsx`) | **Reusable with cleanup** | The real gameplay card renderer (used by `LaneBox`). Already supports a `faceVariant: 'classic' \| 'midnight'` prop with hardcoded color branching — works, but is not driven by a theme object and only knows about one non-classic style. Rank/suit are dynamic `Text`, not baked images — good accessibility/readability foundation to preserve. |
| `Card/PlayingCard.tsx` (a **second**, older card renderer) | **Duplicated** | Used only by `GameScreen`'s active-card stage, `ResultsScreen`/dev previews, and driven by `cardStyle: string` + `paletteForCardTheme()`. This is a pre-existing architectural duplication (documented in `docs/V1_1B_COSMETIC_AUDIT.md`), not something 1.2A should silently merge (`Do not replace all existing visuals yet`) — but the new theme registry's `resolvePlayerVisualTheme()` is designed so both renderers can eventually read from the same resolved theme without a forced rewrite. |
| `CardBack` (`src/components/cards/CardBack.tsx`) | **Reusable with cleanup** | Supports `variant: 'classic' \| 'ember'`, both code-driven gradients. Same "hardcoded per-variant branch" pattern as `PlayingCard` — becomes the seed for `ThemedCardBack`. |
| `LaneBox` (`src/components/game/LaneBox.tsx`) | **Reusable with cleanup** | Already implements idle/selected/danger/cleared panel variants, a `feedbackType`-driven flash-color animation (`placed`/`cleared21`/`clearedFiveCard`/`bust`), and a `laneEffect: 'gold_lane_glow' \| null` prop with hardcoded gold color constants + two corner-accent `View`s. This is effectively the lane-effect system already, just not phrased as reusable states. `ThemedLaneEffect` wraps this existing behavior in a themed, stateful surface instead of replacing it. |
| Gameplay board (`GameScreen.tsx`) | **Reusable** | Lays out `LaneBox`es and the active-card stage; reads `useActiveCardTheme()` / `useActiveCardFaceVariant()` / `useActiveLaneEffect()` selector hooks (from `src/cosmetics/useLockerCosmetics.ts`). Not touched by 1.2A beyond optionally layering `ThemedBoardEffectLayer`. |
| Gameplay background / Home background / Results background (`BlazeScreenBackground.tsx`) | **Reusable with cleanup** | Static `ImageBackground` (per-variant PNG/WebP) + gradient, already has a conditional, purely decorative `lava_arena_tint` overlay gated by `useIsLavaArenaTintActive()`. This is the seed for `ThemedArenaBackground`'s "optional foreground overlay" layer. A **separate**, gradient-only `BlazeBackground.tsx` (used by `ScreenContainer`, i.e. Store/Settings/Progression/Daily screens) also reads `equippedCosmetics.arena` for a live tint — two different arena-reactive components for two different screen families, both to be reused (not merged) by the new registry. |
| Card-clear animations | **Reusable** | `LaneBox`'s `flashTone` (Reanimated `withSequence`) already animates on `cleared21` / `clearedFiveCard`. No dedicated separate component exists — this logic becomes one of the event handlers `ThemedBoardEffectLayer` can (optionally) also react to. |
| Bust effects | **Reusable** | Same `flashTone` mechanism, red-shake variant on `bust`. Reused as-is. |
| Multiplier effects | **Missing (visual)** | `useSoloGameFeedback.ts` plays audio/haptics on a multiplier increase but there is no dedicated visual effect. `multiplier_up` is a supported `ThemedBoardEffectLayer` event type specifically to fill this gap in 1.2B, not 1.2A. |
| Victory effects | **Missing** | No dedicated "you won" visual component exists anywhere. `ResultsScreen` shows a static hero title/score; the only "celebration" primitive is `BlazeBackground`'s ambient ember particles (always-on, not victory-specific) and a high-score audio/haptic cue. `ThemedVictoryEffect` is new. |
| Cosmetic catalog (`src/cosmetics/lockerCatalog.ts`) | **Reusable** | Pure, typed, already the single source of truth for the 6 Version 1.1B cosmetics + 5 free defaults. Directly reused as the seed data for theme registry entries — ids are not renamed. |
| Cosmetic ownership (`player_cosmetics` table, `useCosmeticStore.ownedCosmetics`) | **Reusable** | Server-authoritative; the new `resolvePlayerVisualTheme()` reads this client-cached ownership array for **rendering** only, exactly as instructed ("Rendering may use cached confirmed ownership… Do not trust client ownership for server actions") — no server logic changes. |
| Equipped cosmetics (`useCosmeticStore.equippedCosmetics`) | **Reusable** | Already the single source of the six equip-slot ids consumed by the small `useLockerCosmetics.ts` selector hooks. The new theme registry consumes the same store rather than adding a parallel equip state. |
| Asset loading / preloading | **Missing** | No preloading exists anywhere — every `require(...)` is resolved by Metro at bundle time and decoded on first render. Fine for the current handful of small assets (see performance budget doc), but there is no mechanism to preload an equipped theme's assets ahead of a screen transition. `visualAssetLoader.ts` is new. |
| Reduced Motion | **Reusable** | `useReducedMotionSetting()` (`src/hooks/useReducedMotionSetting.ts`) already combines the player's in-app preference with the OS accessibility setting and is consumed correctly by `BlazeBackground`'s embers and `CosmeticUnlockOverlay`. All new themed components reuse this same hook — no second Reduced Motion source is introduced. |
| Accessibility | **Reusable with cleanup** | Card `accessibilityLabel`s already include rank/suit/style text independent of visual style (e.g. `"7 of hearts, midnight style"`); `LaneBox`'s decorative gold corner accents are already `accessibilityElementsHidden`. This pattern is preserved and extended, not replaced. |
| Existing theme tokens (`src/theme/uiKit.ts`, `src/theme/colors.ts`, `src/theme/typography.ts`) | **Reusable** | Flat, well-organized color/spacing/radius/shadow tokens already exist in two parallel shapes (`theme/colors.ts` flat, `theme/uiKit.ts` nested) for historical reasons (documented in earlier milestones). The new `src/themes/*` model is additive and does not touch either. |
| Existing SVG assets (`assets/icons/*.svg`) | **Reusable** | Small, static UI icons (back, close, chevron, flame states, trophy, etc.), rendered via `SvgRoot`/`CardSuit`. Unrelated to card/arena art; untouched by 1.2A. |
| Existing PNG/WebP assets (`assets/backgrounds`, `assets/branding`, `assets/effects`, `assets/animations`) | **Reusable** | All small (largest is 388KB `icon.png`, most under 40KB — see `docs/V1_2_VISUAL_PERFORMANCE_BUDGET.md`), already referenced through one centralized static-require registry, `src/assets/blazeAssets.ts`. This is exactly the "static references, not dynamic string requires" pattern Version 1.2A's asset manifest formalizes and extends — not replaced. |
| Existing gradients | **Reusable** | `expo-linear-gradient` is already the standard for all code-driven visuals (`CardBack`, `BlazeBackground`, `ArenaPreviewPanel`, `ProfileFrameBadge`). The new themed components continue using it for the "classic" fallback and any code-driven theme layers. |
| Existing animation libraries | **Reusable** | `react-native-reanimated` (v4) is already used throughout (`LaneBox`, `BlazeBackground`, `CosmeticUnlockOverlay`, `WhatsNewOverlay`) with `useReducedMotionSetting` gating. `ThemedBoardEffectLayer` / `ThemedVictoryEffect` reuse the same library — no second animation system introduced. |
| Locker cosmetic previews (`CosmeticPreview.tsx`, `ArenaPreviewPanel.tsx`, `ProfileFrameBadge.tsx`, `PlayerTitleBadge.tsx`) | **Reusable with cleanup** | Built directly against `cosmeticId`/`cosmeticType` strings with internal `if (cosmeticId === '...')` branches. Version 1.2A repoints these to resolve through the theme registry (`resolvePlayerVisualTheme`-derived per-item lookups) instead of hardcoded id comparisons, without changing what they render today. |
| Developer preview tooling | **Missing** | `src/screens/dev/BlazeUIKitPreviewScreen.tsx` exists (general UI-kit gallery, `__DEV__`-gated) but has no cosmetic/theme-specific preview. `ThemePreviewScreen.tsx` is new. |

## Explicit non-assumptions

Per the instruction "do not assume earlier requested systems exist,"
this audit confirms directly from source (not from prior milestone
reports) that: there is no existing `src/themes/` directory, no asset
manifest, no visual event bus, no board/victory effect components, and
no asset validation script anywhere in the repository before this
milestone.
