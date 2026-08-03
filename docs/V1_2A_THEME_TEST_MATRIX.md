# Version 1.2A Theme Test Matrix

Mirrors the format of `docs/V1_1B_COSMETIC_TEST_MATRIX.md` /
`docs/V1_1C_ADS_AUDIT.md`. "Unit" scenarios are exercised by
`src/themes/v1_2aVisualThemeSelfTest.ts`
(`npm run test:v1.2a-visual-theme`), a pure-function test file with no
React Native dependency. "Code review" scenarios require the RN runtime
(Reduced Motion via `AccessibilityInfo`, actual asset decoding) and are
verified by reading the implementation, matching this repo's established
self-test convention.

| # | Scenario | Coverage | Where |
|---|---|---|---|
| 1 | Classic theme always resolves | Unit | `classicTheme.isEnabled === true`, `fallbackThemeId === null`, and `resolveThemeDefinition` returns an enabled definition for all 8 categories with no input. |
| 2 | Missing card-face theme falls back to classic | Unit | `resolveThemeDefinition('card_face', 'does_not_exist')` returns the classic definition. |
| 3 | Missing arena falls back to classic | Unit | Same check for `arena`. |
| 4 | Disabled theme cannot be selected | Unit + code review | Unit: confirms the shipped registry has zero disabled rows today. Code review: `resolveThemeDefinition`'s loop only returns a candidate when `candidate.isEnabled`, otherwise continues down the fallback chain. |
| 5 | Unowned cosmetic is not resolved as equipped | Unit | `resolvePlayerVisualTheme` with `ownedIds: new Set()` and a non-free equipped id resolves to classic for that category. |
| 6 | Owned cosmetic resolves correctly | Unit | Same call with the id present in `ownedIds` resolves to the real theme. |
| 7 | Theme resolution does not alter gameplay state | Unit | Calling `resolvePlayerVisualTheme` twice with frozen inputs returns byte-identical output and never mutates the input loadout/Set. |
| 8 | Board effects deduplicate event IDs | Unit | `publishVisualEffectEvent` called twice with the same `eventId` delivers to subscribers only once. |
| 9 | Reduced Motion suppresses heavy effects | Code review | `ThemedBoardEffectLayer` renders no effect bursts when `useReducedMotionSetting()` is true; `ThemedVictoryEffect` substitutes a single static glow for its sweep + ember burst. |
| 10 | Asset manifest rejects duplicate IDs | Unit | `findDuplicateAssetIds` (shared by the validation script and the test) flags an injected duplicate and confirms the real manifest has none. |
| 11 | Asset manifest rejects missing fallback IDs | Unit | `findMissingFallbackReferences` flags an injected dangling `fallbackAssetId` and confirms the real manifest has none. |
| 12 | Preview screen is unavailable in production | Unit | `isThemePreviewDevEnabled()` returns `false` when the RN/Metro `__DEV__` global is absent (the exact condition true in any non-dev JS context), regardless of the feature flag's value. |
| 13 | Asset loading failure does not block gameplay | Code review | Every branch of `loadVisualAsset()` resolves to `'loaded'`/`'failed'`, never throws; every call site is fire-and-forget (`void preloadThemeAssets(...)`). |
| 14 | Web skips unsupported native visual code | Unit | `isAssetSupportedOnPlatform()` correctly reports `false` for a platform-restricted entry and confirms every asset shipped today supports web. |
| 15 | RevenueCat remains disabled | Unit | Reuses the established pattern: `isStorePurchasesEnabled()` defaults to `false` with the relevant env vars unset. |
| 16 | Existing cosmetic IDs remain unchanged | Unit | Asserts the exact Version 1.1B cosmetic id list is unchanged (no additions/removals) and that every theme definition's `cosmeticId` still points at a real catalog id. |

## Performance / manual test scenarios (Version 1.2A §22)

Verified by code review + `npm run validate:visual-assets` (asset-size
reporting) rather than an automated harness, consistent with this
repo's existing manual-test documentation pattern
(`docs/V1_1B_COSMETIC_TEST_MATRIX.md` "Responsive testing"):

| Scenario | How it's addressed |
|---|---|
| Rapid card placements | `ThemedBoardEffectLayer` caps simultaneous effects at 3 and drops the oldest rather than growing an unbounded queue. |
| Multiple lane clears | Same cap; `publishVisualEffectEvent` dedupes by `eventId` so a rerender never republishes the same clear. |
| Repeated bust effects | Same mechanism; bust effects are removed automatically after their fixed 420ms duration. |
| Low-memory reload | No new persistent caches beyond `visualAssetLoader`'s `Map<string, AssetLoadStatus>`, which holds only status strings, never image bytes or native objects. |
| Background and resume | No new `AppState` listeners were added; existing preload calls are idempotent (`loadVisualAsset` short-circuits on `'loaded'`/`'failed'`/in-flight). |
| Theme switching | `memoizedResolvePlayerVisualTheme` recomputes only when the loadout/ownership actually changes (serialized key comparison). |
| Locker preview scrolling | `CosmeticPreview` renders the same small production components as gameplay — no separate heavyweight preview renderer. |
| Reduced Motion | Every animated `Themed*` component reads the same `useReducedMotionSetting()` hook already used by `BlazeBackground`/`CosmeticUnlockOverlay`. |
| Offline startup | Asset preloading never blocks: `usePreloadEquippedVisualTheme` fires a `void`-returned promise from a `useEffect`, never awaited before render. |
| Missing optional asset | `loadVisualAsset` resolves to `'failed'` instead of throwing; `resolvePlayerVisualTheme` accepts an `unavailableThemeIds` set to fall back to classic for a category whose asset failed. |
| Corrupt theme registry entry | `resolveThemeDefinition`'s fallback walk is bounded (8 hops) and defends against a cyclic chain; `resolvePlayerVisualTheme`'s outer `try/catch` returns `classicTheme` on any unexpected error. |
| Disabled theme | Covered by scenario 4 above. |
| Web rendering | `adUnitResolution`-style platform gating pattern reused via `isAssetSupportedOnPlatform`; no themed component calls a native-only API — all are pure View/Text/LinearGradient/Reanimated, already proven to work on web by the existing `BlazeBackground`/`CosmeticUnlockOverlay`. |

## Running the tests

```bash
npm run test:v1.2a-visual-theme
npm run validate:visual-assets
npm run test:game
npm run test:monetization
npm run test:v1.1b-locker
npm run test:v1.1c-ads
```
