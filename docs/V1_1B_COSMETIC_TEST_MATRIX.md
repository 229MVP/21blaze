# Version 1.1B Cosmetic Test Matrix

Mirrors the format of `docs/V1_1_ECONOMY_TEST_MATRIX.md`. "Unit" scenarios
are exercised by `src/monetization/v1_1bLockerSelfTest.ts`
(`npm run test:v1.1b-locker`), a pure-function test file with no React
Native or network dependency, run with `tsx` like the other self-tests in
this repo. "Integration" scenarios require a deployed Supabase project
(migration `0009_v1_1b_blaze_locker.sql` applied + Edge Functions
deployed) and are verified by code review of that migration and the two
Edge Functions until such a deployment exists for this milestone.

| # | Scenario | Coverage | Where |
|---|---|---|---|
| 1 | Catalog contains the five coin cosmetics | Unit | Asserts `V1_1B_LOCKER_CATALOG` ids/costs for `ember_card_back`, `gold_lane_glow`, `midnight_card_style`, `flame_profile_frame`, `lava_arena_tint`. |
| 2 | Day 7 title is streak-only | Unit | Asserts `seven_day_blaze_title.unlockMethod === 'streak'` and `blazeCoinCost === null`. |
| 3 | Server price is used instead of client price | Integration | `purchase_cosmetic` reads `item.blaze_coin_cost` from `cosmetic_catalog` inside the same transaction; the RPC signature (`p_cosmetic_id` only) never accepts a price argument at all. |
| 4 | Insufficient balance rejects the unlock | Unit + Integration | Unit: `resolveCosmeticButtonState` resolves to `needCoins` (never `unlock`) when `balance < cost`, and `buttonTriggersPurchase` is `false` for that state. Integration: `apply_wallet_delta` raises `insufficient blaze coins` and the transaction rolls back. |
| 5 | Unlock deducts the exact amount | Integration | `apply_wallet_delta(-item.blaze_coin_cost, ...)` — no rounding, no discount path exists in the function signature. |
| 6 | Unlock creates one wallet transaction | Integration | `apply_wallet_delta` inserts exactly one `wallet_transactions` row per call, keyed by `cosmetic_purchase:{user}:{cosmetic_id}`. |
| 7 | Duplicate unlock request does not deduct twice | Integration | `apply_wallet_delta`'s `(user_id, idempotency_key)` unique constraint makes a retried call with the same key a no-op; `purchase_cosmetic` additionally short-circuits before any wallet call if `player_cosmetics` already has the row. |
| 8 | Already-owned item cannot be purchased twice | Unit + Integration | Unit: `resolveCosmeticButtonState({owned: true, ...})` never resolves to `unlock`. Integration: `purchase_cosmetic` returns `already_owned: true` without touching the wallet when a `player_cosmetics` row already exists. |
| 9 | Unowned item cannot be equipped | Integration | `equip_cosmetic` raises `cosmetic % is not owned` unless `player_cosmetics` has a matching row or the catalog's `unlock_method = 'free'`. |
| 10 | Wrong cosmetic type cannot be placed in a slot | Unit + Integration | Unit: `SLOT_FOR_COSMETIC_TYPE` is a 1:1, six-entry mapping (no shared slots). Integration: `equip_cosmetic` raises `does not match slot` when `cosmetic_catalog.cosmetic_type` differs from the slot's expected type. |
| 11 | Owned cosmetic can be equipped | Unit | `resolveCosmeticButtonState({owned: true, equipped: false, ...})` resolves to `equip`; `buttonTriggersEquip` is `true`. |
| 12 | Default cosmetics remain free | Unit | Asserts all five `FREE_DEFAULT_COSMETIC_IDS` have `unlockMethod === 'free'` and `blazeCoinCost === null`. |
| 13 | Offline unlock is rejected safely | Code review | `BlazeLockerScreen.onCardButtonPress` returns immediately (no RPC call) when `authStatus !== 'online'`; the banner "CONNECT ONLINE TO UNLOCK OR CHANGE COSMETICS" is shown instead. |
| 14 | Midnight cards remain dynamically rendered | Code review | `src/components/cards/PlayingCard.tsx` renders suit/rank text and gradients from theme constants — no image asset, no pre-rendered bitmap, for either the classic or midnight variant. |
| 15 | Cosmetics do not alter scoring | Code review + regression | No file under `src/game/` (scoring, timer, bust, multiplier logic) was modified by this milestone. `npm run test:game` (existing game-engine self-tests) passes unchanged. |
| 16 | Cosmetics do not alter card order | Code review + regression | Deck construction/shuffling in `src/game/` is untouched; cosmetic hooks only change color/border props passed into rendering components. `npm run test:game` passes unchanged. |
| 17 | Day 7 title unlocks once | Integration | `unlock_cosmetic`'s `ON CONFLICT (user_id, cosmetic_key) DO UPDATE SET category = EXCLUDED.category` (i.e., ownership is sticky; `unlocked_at`/`source` are never overwritten) combined with `daily_reward_claims`'s per-cycle idempotency key means later Day 7 cycles never insert a second ownership row, while coins/XP still post every cycle. |
| 18 | RevenueCat remains disabled | Unit | Reuses the same pattern as `v1_1RewardsSelfTest.ts`: `isStorePurchasesEnabled()` defaults to `false` with the relevant env vars unset. |
| 19 | No paid products appear | Unit + code review | Unit: `isV1_1LockerEnabled()` defaults to `false`. Code review: `BlazeLockerScreen` never imports `usePurchaseStore`, RevenueCat, or `STORE_PRODUCTS`; it only reads Blaze Coin balance and the cosmetic catalog. |
| 20 | Wallet cannot become negative | Unit + Integration | Unit: the client never resolves an `unlock` action (and therefore never calls `purchase_cosmetic`) when `balance < cost`. Integration: `player_wallets_blaze_coins_check CHECK (blaze_coins >= 0)` and `apply_wallet_delta`'s explicit `RAISE EXCEPTION` for a negative resulting balance make this a hard database invariant, not just a client-side courtesy. |

## Responsive testing (manual / visual review)

Confirmed by code review of `BlazeLockerScreen`'s layout (no fixed pixel
widths beyond the 96×~90 preview slot, `flexWrap` tab row, `ScrollView`
list) at the requested breakpoints:

- 320×800, 360×800, 390×844, 430×932 — cosmetic cards stack in a single
  scrollable column; the horizontal tab row scrolls rather than wrapping
  awkwardly; the preview slot and price/button text never overflow the
  card because the copy column uses `flex: 1` with `numberOfLines`
  truncation on name/description.
- Tablet / desktop web — `ScreenContainer`'s existing safe-area + padding
  behavior centers content; no new fixed-width elements were introduced
  that would prevent centering.
- Gameplay cosmetics (lane glow, card face/back) never obscure card
  contents — they only change border/background colors, never add
  overlays on top of rank/suit text.

## Running the tests

```bash
npm run test:v1.1b-locker
npm run test:game
npm run test:monetization
npm run test:progression
npm run test:v1.1-rewards
```
