# Version 1.1B — Blaze Locker Spec

## Goal

Make Blaze Coins useful through earnable, code-driven cosmetic unlocks.
No paid purchases, no RevenueCat initialization, no new gameplay modes, no
change to scoring/timers/card order/match verification/XP/wallet reward
amounts.

## Feature flags

- `EXPO_PUBLIC_ENABLE_STORE_PURCHASES` — unchanged, stays `false` in every
  build profile. Purchases.configure is never called while this is false
  (`src/monetization/revenueCatClient.ts`).
- `EXPO_PUBLIC_ENABLE_V1_1_LOCKER` — new, defaults `false`. When `false`,
  `BlazeLockerScreen` is not registered in the navigator
  (`src/navigation/AppNavigator.tsx`), the "BLAZE LOCKER" Home button is
  not rendered, and every equipped-cosmetic visual selector hook in
  `src/cosmetics/useLockerCosmetics.ts` returns the Version 1.0 default
  regardless of what is stored server-side.

## Screens and navigation

- `src/screens/BlazeLockerScreen.tsx` (new) — Blaze Coin balance, tabs
  (FEATURED / CARDS / ARENA / PROFILE / OWNED), cosmetic cards, purchase
  confirmation modal, unlock celebration overlay.
- `src/screens/BlazeStoreScreen.tsx` (existing "BLAZE REWARDS" screen) is
  **not deleted or hidden**; it remains the paid-product shell (kept
  unavailable while `EXPO_PUBLIC_ENABLE_STORE_PURCHASES` is false) and its
  existing "COIN COSMETICS" section continues to work, now routed through
  the same new `purchase_cosmetic` / `equip_cosmetic` RPCs as the Locker.
- Home: "BLAZE LOCKER" button placed directly after "SOLO PLAY" (Solo Play
  is never pushed below the fold), before Live Duel/Ranked/Rewards. A
  small badge dot appears when a new cosmetic was just unlocked, a Day 7
  streak title is claimable, or the player can currently afford at least
  one locked item — computed live from the wallet/catalog/ownership state,
  never a stale or fabricated balance (`useLockerBadgeVisible`).

## Cosmetic cards

Each card shows: a real-component preview (`CosmeticPreview`), name,
description, type, rarity, Blaze Coin cost, owned/equipped state, and
unlock source. The button never sends a request from merely rendering,
selecting, or previewing a card — only an explicit tap on an `unlock`- or
`equip`-resolved button does. Button copy is derived from
`resolveCosmeticButtonState` / `cosmeticButtonLabel`
(`src/cosmetics/lockerCatalog.ts`):

- Not owned, affordable → `UNLOCK — {cost} COINS`
- Not owned, unaffordable → `NEED {missing} MORE COINS` (disabled)
- Owned, unequipped → `EQUIP`
- Owned, equipped → `EQUIPPED` (disabled)
- Streak-only, not owned → `COMPLETE A 7-DAY STREAK` (disabled)

## Purchase confirmation

Tapping `UNLOCK — {cost} COINS` opens `ConfirmationModal` with
"UNLOCK COSMETIC? — Unlock {name} for {cost} Blaze Coins?" and CANCEL/UNLOCK
actions. Only after `purchase_cosmetic` returns success does the client
update the balance, mark ownership, and show `CosmeticUnlockOverlay`. No
optimistic deduction and no success state before server confirmation.

## Loadout store (`src/store/useCosmeticStore.ts`)

State: `catalog` (server-driven, cached across offline periods),
`ownedCosmetics`, `equippedCosmetics` (extended with `cardFace`,
`cardBack`, `laneEffect`), `selectedPreviewId`, `isLoading`,
`purchaseStatus`, `equipStatus`, `error`, `pendingUnlock`.

Actions: `hydrateCosmetics`, `loadCatalog`, `purchaseWithCoins`,
`equipCosmetic`, `selectPreview`, `refreshOwnership`, `clearError`, plus
`restoreStoreOwnership` (unchanged, used by the RevenueCat restore flow)
and `acknowledgeUnlock`.

Duplicate-request guards use module-level `let`/`Set` variables (never
placed inside Zustand state, per the existing `useWalletStore` pattern) so
a second tap while a purchase/equip is in flight is a no-op. `loadCatalog`
never throws — a failed fetch simply keeps whichever catalog snapshot
(static fallback on first launch, or the last successful fetch) is
already cached, which is what makes the offline behavior below possible
without any extra plumbing.

## Offline behavior

- Previously confirmed equipped cosmetics keep rendering from the cached
  `equippedCosmetics` state.
- The catalog shows cached data (falls back to the static
  `V1_1B_LOCKER_CATALOG` mirror on a cold, offline first launch).
- `BlazeLockerScreen` shows "CONNECT ONLINE TO UNLOCK OR CHANGE COSMETICS"
  and disables purchase/equip taps while `useAuthStore().authStatus !==
  'online'` (the same online/offline signal already used by
  `DailyRewardScreen`).
- No ownership is ever granted client-side; all writes are server RPCs.
- Solo gameplay remains fully available offline regardless of Locker
  state.

## Applying cosmetics to production UI

| Surface | Cosmetics applied |
|---|---|
| Home | Profile frame, player title (existing `progressionEnabled` gate), Locker badge |
| Gameplay (`GameScreen`) | Card face + card back (lane cards via `cards/PlayingCard`, active-card stage via `Card/PlayingCard`), lane effect, arena tint (`BlazeScreenBackground`) |
| Results | Profile frame, player title (when equipped), arena tint |

None of these touch score, card order, card values, the timer, the
multiplier, bust protection, matchmaking, ranking, or reward amounts —
every visual hook is a pure rendering selector
(`src/cosmetics/useLockerCosmetics.ts`) layered on top of existing
components; no gameplay logic file was modified.

## Daily streak integration

Day 7 of the existing daily streak calendar already granted
`seven_day_blaze_title` via `claim_daily_reward_secure` →
`unlock_cosmetic` (idempotent, server-timestamped, no device-time
dependency). Version 1.1B:

- Sets that catalog row's `cosmetic_type` to `player_title` so it matches
  the new `playerTitleId` equip slot.
- Adds `unlockedCosmetic` to the client claim result and fires
  `seven_day_title_unlocked` + refreshes Locker ownership when it fires.
- Confirms the calendar already displays "Day 7 unlocks: Seven Day Blaze"
  in `DailyRewardScreen` (pre-existing, unmodified).

## Analytics

`src/monetization/analytics.ts` adds `V1_1B_LOCKER_ANALYTICS_EVENTS`:
`blaze_locker_viewed`, `cosmetic_previewed`, `cosmetic_unlock_started`,
`cosmetic_unlock_completed`, `cosmetic_unlock_failed`,
`cosmetic_equipped`, `insufficient_coins_shown`,
`seven_day_title_unlocked`. Payloads carry only cosmetic ids, coin
amounts, and slot/type strings — never tokens, raw UUIDs, wallet records,
or database responses.

## Accessibility

- Each cosmetic card has a single `accessibilityLabel` summarizing name,
  type, rarity, cost, and owned/equipped state.
- Decorative elements (ember dots, gold lane corner accents, flame profile
  accents, arena embers) are marked
  `accessibilityElementsHidden`/`importantForAccessibility="no-hide-descendants"`.
- The purchase confirmation and unlock celebration are both real `Modal`s
  with `accessibilityViewIsModal`.
- `CosmeticUnlockOverlay` respects the existing `useReducedMotionSetting()`
  hook (skips scale/opacity animation when enabled).
- Midnight Card Style uses `#FF5A5A` / `#E8E0D0` text on a `#141414`
  background for accessible contrast at small lane-card sizes.

## Performance

- No new animation loops: Gold Lane Glow reuses `LaneBox`'s existing
  `feedbackType === 'placed'` pulse instead of adding a second one; the
  Lava Arena tint is a static gradient (no `withRepeat`).
- `loadCatalog` de-dupes concurrent calls via a module-level in-flight
  promise; `purchaseWithCoins`/`equipCosmetic` de-dupe via module-level
  in-flight trackers, not Zustand state.
- `CosmeticPreview` renders the same small, memoized production
  components already used elsewhere (`PlayingCard`, `LaneBox`) — no
  second card-rendering engine.
