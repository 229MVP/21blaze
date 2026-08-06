# Version 1.2C Release-Candidate QA Audit

Consolidated audit covering spec sections 4, 8-21 — Ember collection
completion, memory/lifecycle, Locker polish, reward/ownership regression,
purchases-disabled confirmation, ads regression, Reduced Motion,
accessibility, device layout, fresh-install, upgrade, developer tools,
analytics, and the TestFlight/EAS environment. Where a check requires a
physical device this environment cannot provide, that is stated
explicitly rather than claimed as verified — those items carry forward
into `docs/V1_2_TESTFLIGHT_CHECKLIST.md` as required manual test cases.

## 4. Ember collection completion

All seven listed components audited:

| Component | Status |
|---|---|
| `ember_card_face` | No such cosmetic exists — never exposed (see `docs/V1_2C_RELEASE_ASSET_REPORT.md`). |
| `ember_card_back` | Shipped, code-driven, unchanged ownership id. |
| `lava_arena_tint` | Shipped, code-driven, unchanged ownership id. |
| `gold_lane_glow` | Shipped, code-driven, unchanged ownership id. |
| `flame_profile_frame` | Shipped, code-driven, unchanged ownership id. |
| `seven_day_blaze_title` | Shipped, streak-earned, unchanged ownership id. |
| Card-placement / exact-21 / five-card-clear / bust / multiplier / match-complete / high-score effects | Tinted per coordinated-loadout rule (`resolveEmberFamilyEffectThemes`), durations finalized in `docs/V1_2C_EFFECT_TIMING_FINAL.md`. |

Shared visual language confirmed: every Ember-tinted surface uses the
orange/gold/red/charcoal family (`#FF8A00`/`#FFB629`/`#FF3426`/`#241008`
range) — verified by reading each component's palette constants
(`ThemedBoardEffectLayer.EMBER_EFFECT_COLOR`, `ThemedVictoryEffect.PALETTE.ember`,
`ThemedLaneEffect`'s gold constants, `CardBack`'s ember gradient,
`ProfileFrameBadge`'s flame variant). No effect renders behind or through
card/lane-total/timer/score text (`pointerEvents="none"` +
`accessibilityElementsHidden` throughout, and every overlay is a semi-
transparent tint layered above content, never a full-opacity fill). No
unfinished asset appears (confirmed in the release asset report).
Ownership ids unchanged (unit-tested, `v1_2bEmberCollectionSelfTest.ts` #17).

## 8. Memory and lifecycle

Code-review audit (no physical device in this environment — see
environment note in `docs/V1_2B_VISUAL_TEST_MATRIX.md`):

| Risk | Finding |
|---|---|
| Increasing memory usage across repeated matches | `loadVisualAsset` caches by id and never re-downloads/redecodes a previously-loaded asset; `ThemedBoardEffectLayer`'s effect queue is capped at 3 and every completed burst is removed from state (no unbounded array growth). |
| Listener leaks | Every `subscribeToVisualEffects` / `subscribeToAssetFailures` call site returns and calls its unsubscribe function in a `useEffect` cleanup (`ThemedBoardEffectLayer`, `useResolvedVisualTheme`) — verified by reading each hook's `return () => ...` / `return subscribeTo...(...)` pattern. |
| Timers that remain active | All effect timing uses Reanimated's `withTiming`/`withSequence` (UI-thread animations with a fixed end, not `setInterval`); the one plain JS timer (`EmberCollectionPreview`'s `setTimeout` resetting its local preview-trigger state) is a single one-shot 1600ms timer per tap, not recurring. |
| Animation objects retained after completion | Reanimated shared values are owned by the component instance and garbage-collected when it unmounts (`EffectBurst` unmounts via `removeEffect` after `onDone`); nothing stores a shared value or animation reference outside component scope. |
| Duplicate preload requests | `loadVisualAsset`'s `inFlightById` map coalesces concurrent requests for the same id into one promise; the three preload tiers (launch/before-gameplay/lazy) all funnel through the same cache. |
| Native crashes | No new native module or native API was introduced this milestone (Reanimated/`expo-asset`/`expo-linear-gradient` usage is identical in kind to what 1.1B/1.2A already shipped). |
| Input delay / frame-rate deterioration | All new animations run on Reanimated's UI thread (`useSharedValue`/`withTiming`), the same mechanism already used by every pre-existing themed component — no new JS-thread-blocking work was added. |
| Zustand selector loops | `useResolvedVisualTheme`'s new `useEffect` (fallback-tracking) reads `equipped`/`theme` and writes only a `ref` plus an analytics call — it never calls a Zustand setter, so it cannot create a store-update render loop. |

**Pending manual QA:** an actual 10-consecutive-Solo-match device run with
a memory profiler attached (Xcode Instruments / Android Studio Profiler)
before store submission — added to the TestFlight checklist.

## 9. Locker polish

| Requirement | Status |
|---|---|
| Real Blaze Coin balance | `useWalletStore`'s server-hydrated `balance`, unchanged this milestone. |
| Correct ownership / equipped states | `useCosmeticStore`'s `ownedCosmetics`/`equippedCosmetics`, unchanged. |
| Correct prices / unlock method | `V1_1B_LOCKER_CATALOG`, unchanged (verified, `v1_2bEmberCollectionSelfTest.ts` #17). |
| Correct theme previews | `CosmeticPreview` + new `EmberCollectionPreview`, both real components. |
| Classic cosmetics remain free | `FREE_DEFAULT_COSMETIC_IDS`, unchanged. |
| Unowned cosmetics cannot be equipped | `resolveCosmeticButtonState`'s `owned` gate, unchanged; server-side `equip_cosmetic` RPC remains the actual authority. |
| Insufficient balance is clear | `needCoins` button state + `RewardedCoinButton`, unchanged. |
| Unlock confirmation before spending | `ConfirmationModal`, unchanged. |
| Wallet updates only after server confirmation | `purchaseWithCoins` awaits `purchaseCosmeticWithCoins` (Supabase RPC) before updating local state, unchanged. |
| Unlock celebration once | `CosmeticUnlockOverlay` + `pendingUnlock`/`acknowledgeUnlock`, unchanged. |
| Offline unlocks blocked | `!isOnline` disables all card buttons + shows the offline banner, unchanged. |
| Cached equipped cosmetics render offline | `useResolvedVisualTheme` reads only the already-hydrated Zustand store — no network dependency to render. |
| Tabs fit on small screens | Horizontal `ScrollView` tab row, unchanged; `EmberCollectionPreview`'s piece grid uses `flexWrap`. |
| No autoplaying heavy effects while scrolling | `EmberCollectionPreview`'s effect preview requires an explicit "PREVIEW EFFECTS" tap; individual cosmetic previews (`CosmeticPreview`) are static renders, not animations, even for `card_back`/`lane_effect`/`arena`. |

## 10. Reward and ownership regression

No file under `src/monetization/` (rewards/wallet/missions/streak logic),
`src/store/useWalletStore.ts`, `src/store/useProgressionStore.ts`, or any
`supabase/migrations/*` was touched in Versions 1.2A/1.2B/1.2C. The theme
system's structural isolation (no import from game/wallet/reward modules)
is unit-tested (`v1_2bEmberCollectionSelfTest.ts` #6-9). Existing
Version 1.1 test suites (`test:v1.1-rewards`, `test:v1.1b-locker`,
`test:v1.1c-ads`, `test:progression`) all pass unchanged (see validation
log). No wallet, cosmetic, progression, high-score, or settings reset was
introduced.

## 11. Purchases remain disabled

- `EXPO_PUBLIC_ENABLE_STORE_PURCHASES=false` in the `testflight` profile
  (`eas.json`) — confirmed present.
- `configureRevenueCat()` (`src/monetization/revenueCatClient.ts`) is
  gated at its first line by `isStorePurchasesEnabled()`, which requires
  both `isMonetizationBetaEnabled()` **and** the purchases flag — with
  the flag false, `Purchases.configure` is never called, no API key is
  ever read, and a missing/absent key is never treated as an error (the
  function simply returns `false`).
- No RevenueCat Test Store key (`EXPO_PUBLIC_REVENUECAT_API_KEY` /
  `_IOS_API_KEY` / `_ANDROID_API_KEY`) appears anywhere in the
  `testflight` env block.
- Paywalls, Restore Purchases, and paid-pack UI all sit behind the same
  `isStorePurchasesEnabled()` gate (`BlazeStoreScreen`,
  `PurchaseDiagnosticsScreen`'s own `isPurchaseDiagnosticsEnabled()` gate) —
  unchanged this milestone.
- RevenueCat packages (`react-native-purchases`,
  `react-native-purchases-ui`) remain in `package.json`, untouched.

## 12. Ads regression

- Interstitial policy (`src/monetization/interstitialPolicy.ts`, fully
  unit-tested, untouched this milestone): Solo-mode-eligible-matches
  gate, `matchesRequired: 3`, `minIntervalMs: 10 * 60 * 1000` (10 min),
  `maxPerUtcDay: 3`, blocked during `countdown`/`gameplay`/`pause`/`results`/etc.,
  never on the first app session.
- `testflight` profile sets `EXPO_PUBLIC_ADMOB_USE_TEST_ADS=true` and
  `app.json`'s `GADApplicationIdentifier` is Google's public sample App
  ID (`ca-app-pub-3940256099942544~1458002511`) — a real production ad
  unit ID is never used while this flag is true (see
  `src/monetization/adUnitResolution.ts`, unit-tested in
  `v1_1cAdsSelfTest.ts`, untouched this milestone).
- Rewarded ads: optional, explicit-tap only (`RewardedCoinButton`), and
  `EXPO_PUBLIC_ENABLE_REWARDED_CURRENCY=false` in every profile — a
  rewarded-ad completion alone never grants production currency without
  server-side verification (unchanged).
- No ad frequency constant changed in this milestone (file untouched;
  `git diff` for `src/monetization/interstitialPolicy.ts` between the
  1.1C tag and this branch is empty).

## 13. Reduced Motion

Every animated visual effect introduced or touched across 1.2A/1.2B/1.2C
checks `useReducedMotionSetting()` and substitutes a short, static
alternative:

| Effect | Reduced Motion alternative |
|---|---|
| Card placement / exact 21 / five-card clear / bust / multiplier (board effects) | No `EffectBurst` renders at all (`ThemedBoardEffectLayer`); event still fires (tracked as `board_effect_suppressed_reduced_motion`), gameplay state itself already communicates the outcome (lane total, score, engine-driven card removal). |
| Match complete / high score (victory) | Single ≤260ms non-moving glow, no sweep, no ember dots (`ThemedVictoryEffect`). |
| Locker previews | No previews animate on their own; the one interactive animation (`EmberCollectionPreview`'s effect preview) reuses `ThemedVictoryEffect`, inheriting the same Reduced Motion branch. |
| Unlock celebration | `CosmeticUnlockOverlay`, unchanged from Version 1.1B (not part of this milestone's scope; already respects the setting). |
| Background ambient effects | `ThemedArenaBackground`'s `showAmbient = ambientEffect && !reduceMotion` — the ember-overlay ambient layer never renders under Reduced Motion. |
| Lane state flashes | `ThemedLaneEffect`'s flash `useEffect` sets `flash.value = 0` immediately under Reduced Motion instead of running the pulse sequence. |

Gameplay information remains equally understandable in every case above —
none of these effects are the *only* signal for a state change (see
Accessibility, next).

## 14. Accessibility

| Surface | Status |
|---|---|
| Card labels | `cardAccessibilityLabel` (pure, unit-tested) — full rank+suit spoken identity, independent of theme. |
| Lane totals / states | `LaneBox`'s existing accessibility labels (unchanged); `ThemedLaneEffect` is `accessibilityElementsHidden` (purely decorative, never the only signal — lane total text and card count are always present). |
| Cosmetic cards | `BlazeLockerScreen`'s `CosmeticCard` has a full `accessibilityLabel` summary (name, type, rarity, cost, owned/equipped/locked) — unchanged; `EmberCollectionPreview`'s pieces have an equivalent label (`"<name>, owned/not yet owned. View in Locker."`). |
| Coin balance | `accessibilityLabel="<n> Blaze Coins"`, unchanged. |
| Unlock confirmation | `ConfirmationModal`, unchanged, standard modal semantics. |
| Equipped state | Spoken as part of the `CosmeticCard` summary label, and visually as an "EQUIPPED" tag — never color-only. |
| Locker tabs | `accessibilityLabel` per tab (`"<TAB> tab, selected"` when active), unchanged. |
| Theme previews | `CosmeticPreview`'s `accessibilityRole="image"` + `"Preview of <name>"` label, unchanged. |
| Reduced Motion | System `AccessibilityInfo.isReduceMotionEnabled()` (`useReducedMotionSetting`) is the source of truth in every branch above, not a separate app-only toggle disconnected from the OS setting (though Settings also exposes an explicit in-app override, unchanged since 1.1B). |
| High contrast | Every new/tinted overlay was measured or reasoned against its background per `docs/V1_2C_CARD_READABILITY_AUDIT.md`; none reduce card/score/timer text contrast (effects are additive tints on top of, never a color change of, that text). |
| Touch targets | No themed overlay is interactive (`pointerEvents="none"` throughout) and none resize any existing button/touch target; `EmberCollectionPreview`'s piece cells and "PREVIEW EFFECTS" button use the same `Pressable`/`BlazeButton` primitives as the rest of the Locker, unchanged minimum sizing. |
| Decorative particles hidden from screen readers | `accessibilityElementsHidden` + `importantForAccessibility="no-hide-descendants"` on every `ThemedBoardEffectLayer`/`ThemedVictoryEffect`/`ThemedLaneEffect` root view. |
| No gameplay state communicated only by color/animation/glow/sound/haptics | Every event this audit covers (card placed, exact 21, five-card clear, bust, multiplier, match complete, high score) is also reflected in text/number state the player already reads (lane total, score, multiplier badge, Results copy) — the visual/audio/haptic layer is always a *supplement*, never the sole signal, and none of that changed this milestone. |

## 15. Device layout audit

See `docs/V1_2B_VISUAL_TEST_MATRIX.md` for the full size/situation matrix
and its environment caveat. Summary: no themed component added a fixed
width/height assumption incompatible with any existing screen size; the
one new UI surface (`EmberCollectionPreview`) uses `flexWrap` and
percentage/relative sizing throughout.

## 16. Fresh-install test

Code-review trace of the launch path (`App.tsx` → auth/consent → Home):
consent flow, Solo Play, Classic theme rendering, and Locker loading are
all unchanged code paths this milestone did not touch structurally (only
extended). `usePreloadEquippedVisualTheme`/`usePreloadLockerPreviewAssets`
are fire-and-forget and never block any of these paths (verified by code
review — no `await` at any call site). No paid UI, missing-asset error,
dev preview, localhost/Metro dependency, or RevenueCat warning is
reachable in a `testflight`-profile build (dev-only surfaces gated by
`__DEV__`/`isThemePreviewDevEnabled()`; RevenueCat never initializes with
purchases disabled). **Pending manual QA**: an actual fresh-install run on
a clean device/simulator — added to the TestFlight checklist.

## 17. Upgrade test

No migration in this milestone alters or drops any existing column, row,
or AsyncStorage key from Version 1.1 (no new `supabase/migrations/*.sql`
file was added in 1.2A/1.2B/1.2C — the theme/asset/effect system is
entirely client-side and reads existing `ownedCosmetics`/`equippedCosmetics`/
wallet/progression state as-is). The only new persisted key is
`21blaze.whatsNewSeen.v1.2` (`src/services/whatsNewService.ts`) — a
brand-new key, so it does not collide with or overwrite the existing
`21blaze.whatsNewSeen.v1.1` key from Version 1.1C; a player who already
saw the 1.1 message will see the 1.2 message exactly once on upgrade, and
every other preference (Reduced Motion, sound/haptics, high scores, coins,
XP, streak, missions, cosmetic ownership, equipped cosmetics, auth
session) is read from its existing, untouched storage location.
**Pending manual QA**: an actual upgrade-over-existing-install run — added
to the TestFlight checklist.

## 18. Developer tools

| Tool | Gate | Reachable in a release build? |
|---|---|---|
| `ThemePreviewScreen` | `isThemePreviewDevEnabled()` (`__DEV__` AND explicit env flag) + `__DEV__` again at navigator registration | No |
| Asset-status labels | Inside `ThemePreviewScreen` only | No (same gate) |
| Force-effect / force-unlock / free-wallet-grant buttons | **Do not exist in this codebase** — no such controls were ever built; nothing to gate. | N/A |
| Missing-asset simulation | Inside `ThemePreviewScreen` only (`simulateMissingAsset` toggle) | No (same gate) |
| Consent-reset tool ("RESET AD CONSENT (DEV)") | `__DEV__` | No |
| Ad-debug tools | **None exist beyond the consent-reset row above.** | N/A |
| RevenueCat diagnostics (`PurchaseDiagnosticsScreen`) | `isPurchaseDiagnosticsEnabled()` — explicitly `false` when `isProductionBuild()` or purchases disabled | No (testflight sets `EXPO_PUBLIC_APP_ENV=preview` and purchases disabled, so this evaluates `false`) |
| Mock reward screens | **Do not exist in this codebase.** | N/A |

## 19. Analytics

All eight required events exist and are wired to real, safe payloads
(`src/monetization/analytics.ts`'s `V1_2_VISUAL_ANALYTICS_EVENTS`):

| Event | Fired from | Payload |
|---|---|---|
| `theme_selected` | `useCosmeticStore.equipCosmetic` (success path) | `{ cosmeticId, slot }` — public catalog ids only |
| `theme_asset_load_failed` | `visualAssetLoader.markFailed` | `{ assetId }` |
| `visual_fallback_used` | `useResolvedVisualTheme` (deduped per fallback signature) | `{ category, equippedId, resolvedId }` |
| `cosmetic_preview_started` | `BlazeLockerScreen.onPreview`, `EmberCollectionPreview.onPreviewEffects` | `{ cosmeticId, cosmeticType }` |
| `cosmetic_equipped` | `useCosmeticStore.equipCosmetic` (pre-existing, Version 1.1B) | `{ cosmeticId, slot }` |
| `board_effect_displayed` | `ThemedBoardEffectLayer` (event received, motion not reduced) | `{ eventType, themeContext }` |
| `board_effect_suppressed_reduced_motion` | `ThemedBoardEffectLayer` (event received, motion reduced) | `{ eventType }` |
| `version_1_2_whats_new_viewed` | `WhatsNewOverlay` | `{}` |

No event above logs an access token, raw user id, wallet row, card/move
history, asset binary, ad callback payload, or secret — every value is a
public catalog/registry id or event-type string.

## 20. TestFlight environment (`eas.json`, `testflight` profile)

> **Superseded by the Version 1.2.0 startup hotfix.** The table below
> reflects the configuration at the end of Version 1.2C. Following the
> TestFlight startup black-screen, `EXPO_PUBLIC_ENABLE_V1_2_VISUAL_SYSTEM`,
> `EXPO_PUBLIC_ENABLE_BOARD_EFFECTS`, and `EXPO_PUBLIC_ENABLE_VICTORY_EFFECTS`
> were reverted to `false` in the `testflight` profile as a Classic-theme
> isolation build — see `docs/V1_2_STARTUP_BLACK_SCREEN_REPORT.md` and
> `docs/V1_2_STARTUP_HOTFIX_TESTFLIGHT_CHECKLIST.md` for the current state
> and re-enable plan.

| Required status | Configured value |
|---|---|
| Version 1.2 rewards enabled | `EXPO_PUBLIC_ENABLE_V1_1_REWARDS=true`, `EXPO_PUBLIC_ENABLE_DAILY_REWARDS=true`, `EXPO_PUBLIC_ENABLE_DAILY_MISSIONS=true` |
| Blaze Locker enabled | `EXPO_PUBLIC_ENABLE_V1_1_LOCKER=true` |
| Visual theme system enabled | `EXPO_PUBLIC_ENABLE_V1_2_VISUAL_SYSTEM=true` |
| Board effects enabled | `EXPO_PUBLIC_ENABLE_BOARD_EFFECTS=true` |
| Victory effects enabled | `EXPO_PUBLIC_ENABLE_VICTORY_EFFECTS=true` |
| Purchases disabled | `EXPO_PUBLIC_ENABLE_STORE_PURCHASES=false` |
| RevenueCat not initialized | Follows from the above (see section 11) |
| Test ads enabled | `EXPO_PUBLIC_ADMOB_USE_TEST_ADS=true` |
| No production ad IDs used in test mode | Confirmed — `isAdMobTestModeForced()` forces Google sample units regardless of configured production ids (unchanged, unit-tested) |
| No RevenueCat Test Store key | Confirmed absent from the `testflight` env block |
| No service-role key | Confirmed absent — this repo never embeds a Supabase service-role key client-side (only the public anon key, via `EXPO_PUBLIC_SUPABASE_ANON_KEY`, unrelated to this profile block) |
| No localhost URL | Confirmed absent from `eas.json` and `app.json` |
| No development-client configuration | Confirmed — `testflight` profile has no `developmentClient` key at all (only `development` does, `true`, which is correct and unrelated) |
| No Metro dependency | `distribution: "store"` builds a standalone bundle; no `expo-dev-client`/Metro runtime is required at runtime for a store-distributed build (the packages remain installed for the `development` profile only, unchanged) |
| `EXPO_PUBLIC_ENABLE_THEME_PREVIEW_DEV` stays disabled for testers | `false` |

No secret value is printed by this document — every row above reports
presence/configuration status only.

## 21. EAS TestFlight profile (`eas.json`)

```json
"testflight": {
  "distribution": "store",
  "environment": "preview",
  "autoIncrement": true,
  "ios": { "simulator": false }
}
```

Matches the required shape exactly. `developmentClient` is not set
(absent, not `false` — confirmed by inspecting the full profile block).
Android preview APK configuration (`preview`/`development` profiles) was
not altered. `distribution: "store"` + `ios.simulator: false` produces an
iOS archive suitable for App Store Connect / TestFlight upload once an
actual `eas build --profile testflight` is run (out of scope for this
audit — no build was created).
