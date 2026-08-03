# Version 1.2A Theme Architecture

## Goal

Prepare the app for professional card artwork, card backs, arena
backgrounds, lane effects, board effects, and victory effects — without
changing any gameplay rule, redesigning a production screen, or
replacing existing visuals before real art exists.

## Layers

```
src/themes/types.ts                  → ThemeCategory, ThemeDefinition, VisualTheme, PlayerVisualLoadout
src/themes/themeRegistry.ts          → per-category ThemeDefinition rows + resolveThemeDefinition()
src/themes/defaultTheme.ts           → classicTheme (the universal fallback VisualTheme)
src/themes/resolvePlayerVisualTheme.ts → resolvePlayerVisualTheme() / memoizedResolvePlayerVisualTheme()

src/assets/manifest/types.ts                → VisualAssetEntry, VisualAssetType, isAssetSupportedOnPlatform()
src/assets/manifest/visualAssetManifestData.ts → pure metadata (no requires — Node/tsx-safe)
src/assets/manifest/visualAssetManifest.ts     → RN-facing manifest (attaches real require() sources)
src/assets/manifest/validateManifest.ts        → shared pure validators (duplicate ids, missing fallbacks)

src/services/visualAssetLoader.ts    → preload/cache/fallback for manifest assets
src/services/visualEventBus.ts       → typed pub/sub for board/victory visual events

src/components/cards/ThemedCardBack.tsx
src/components/themes/ThemedArenaBackground.tsx
src/components/themes/ThemedLaneEffect.tsx
src/components/themes/ThemedBoardEffectLayer.tsx
src/components/themes/ThemedVictoryEffect.tsx

src/hooks/useBoardEffectEventBridge.ts  → translates useGameStore.lastMoveEvent into visual events
src/cosmetics/useLockerCosmetics.ts     → useResolvedVisualTheme() + the existing per-slot selector hooks (now theme-registry-backed)
```

## Two ID spaces, one identity

- **`ThemeCategory`** — the 8 rendering categories: `card_face`,
  `card_back`, `arena`, `lane_effect`, `board_effect`, `victory_effect`,
  `profile_frame`, `player_title`.
- **`ThemeDefinition.themeId`** — one row per equippable visual style
  scoped to exactly one category. For the six Version 1.1B cosmetics and
  the five free defaults, `themeId` is **identical** to the
  `src/cosmetics/lockerCatalog.ts` cosmetic id (`cosmeticId` mirrors it).
  This is deliberate: ownership records, purchase/equip RPCs, and
  analytics all key off the cosmetic id, and the theme registry never
  introduces a second id space for the same thing.
- **`VisualTheme`** — the single composite object
  `resolvePlayerVisualTheme()` returns for one player's loadout. Every
  field (`cardFaceTheme`, `cardBackTheme`, …) is a `ThemeDefinition.themeId`
  string, never a raw cosmetic id — renderers consume `VisualTheme` and
  never need to know about ownership or ids at all.

`board_effect` and `victory_effect` have exactly one registry row each
today (`classic_board_effect`, `classic_victory_effect`) with
`cosmeticId: null` — nothing is ownable/purchasable in those two
categories yet. They exist so 1.2B can add an ownable board/victory
effect cosmetic later without any architecture change.

## Resolution algorithm (`resolvePlayerVisualTheme`)

1. Read the six equipped ids from `useCosmeticStore().equippedCosmetics`.
2. For each category, if the equipped id is null, empty, unowned (checked
   against `ownedIds ∪ freeIds`, never trusted for anything
   server-authoritative), or in the caller-supplied
   `unavailableThemeIds` set (asset load failures), resolve to that
   category's classic id instead.
3. Otherwise call `resolveThemeDefinition(category, id)`, which walks the
   definition's `fallbackThemeId` chain (bounded to 8 hops, defensive
   against a hypothetical cyclic entry) until it finds an `isEnabled`
   definition, and returns the classic definition if nothing resolves.
4. Union all eight categories' `requiredAssets` into one list.
5. Return one frozen-shape `VisualTheme` object. The whole function is
   wrapped in a `try/catch` — any unexpected error returns `classicTheme`
   directly, so resolution can never crash the app.
6. `memoizedResolvePlayerVisualTheme()` caches the last result keyed by a
   serialized `(loadout, ownedIds, unavailableThemeIds)` — repeated calls
   with the same inputs (e.g. from every card's render) are a no-op after
   the first.

**Ownership boundary:** this function only ever reads cached ownership
for rendering. Every state-changing action (purchase, equip) still goes
through the existing, unmodified, server-authoritative `purchase_cosmetic`
/ `equip_cosmetic` RPCs (Version 1.1B) — nothing in `src/themes/` writes
to the database or the wallet.

## Classic fallback guarantee

`classicTheme` (`src/themes/defaultTheme.ts`) is built directly from the
registry's own classic rows, so it is provably in sync with them (no
hand-duplicated data to drift). Every other theme's `fallbackThemeId`
ultimately points at a classic row, and every classic row's
`fallbackThemeId` equals its own `themeId` (a stable "self-fallback" that
terminates resolution). The result: **it is architecturally impossible**
for `resolvePlayerVisualTheme` to return something that doesn't already
work today, because "doesn't resolve" always means "classic."

## Where this is (and isn't) wired into production screens

| Surface | Wired in 1.2A? | Notes |
|---|---|---|
| `useActiveCardFaceVariant` / `useActiveCardBackVariant` / `useActiveLaneEffect` / `useIsLavaArenaTintActive` / `useActiveProfileFrame` | **Yes** | Same function signatures as Version 1.1B, now internally derived from `resolvePlayerVisualTheme` — no call site changed, no visual output changed for the classic case. |
| `CosmeticPreview.tsx` (Blaze Locker) | **Yes** | Resolves through `resolveThemeDefinition` instead of raw id comparisons (Version 1.2A §19). |
| `GameScreen` board effects | **Additive, off by default** | `ThemedBoardEffectLayer` + `useBoardEffectEventBridge` are mounted, but render nothing unless `EXPO_PUBLIC_ENABLE_BOARD_EFFECTS=true`. |
| `ResultsScreen` victory effect | **Additive, off by default** | `ThemedVictoryEffect` is mounted with the real `isNewHighScore` state (never a fabricated "standard win" for a score-based solo session), but renders nothing unless `EXPO_PUBLIC_ENABLE_VICTORY_EFFECTS=true`. |
| `ThemedArenaBackground` | **Not wired into `BlazeScreenBackground`/`BlazeBackground` yet** | Both existing production background components keep working exactly as before. `ThemedArenaBackground` is new, additive, and used today only by the Theme Preview screen — this is intentional per "do not replace all existing visuals yet." |

This is a deliberate, low-risk integration strategy: the architecture is
complete and testable end-to-end today, while the two genuinely new
visual categories (board/victory effects) are inert by default and the
arena composition layer is proven in isolation before 1.2B decides how
(and whether) to fold it into the production background components.
