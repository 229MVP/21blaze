# Version 1.1B Cosmetic System Audit

Audit performed before any Version 1.1B implementation work, against the
`feature/1.1-blaze-rewards` state merged into `main` (Version 1.1A complete,
Version 1.0 submitted to TestFlight).

## Summary

The repository already has a real, working, server-authoritative cosmetic
and wallet system from the 0.5B "Retention & Progression Beta" and
"Monetization Beta" work (migrations `0005_monetization_beta.sql` /
`0006_progression_beta.sql`). Version 1.1B extends this system rather than
duplicating it: the wallet, ownership table, and unlock helper are reused
unchanged; the catalog table is extended with the columns the new spec
requires (`cosmetic_type`, `unlock_method`, `blaze_coin_cost`,
`sort_order`); and two new RPCs (`purchase_cosmetic`, `equip_cosmetic`)
supersede an older, hardcoded-price purchase path.

## Component-by-component status (before 1.1B)

| Component | Status | Notes |
|---|---|---|
| `cosmetic_catalog` (table) | **Implemented but incomplete** | Existed since 0006 with `id, name, description, category, rarity, is_enabled, metadata, created_at`. Only contained the 10 achievement-tier (level/streak) rows — the 4 coin-priced items (`midnight_cards`, `ember_arena`, `hot_streak_title`, `flame_profile_frame`) were **never inserted into this table**; they lived only in the client-side `src/cosmetics/catalog.ts` list and a hardcoded `CASE` statement inside `purchase_cosmetic_with_coins`. No `unlock_method`, `blaze_coin_cost`, or `sort_order` columns existed. |
| `player_cosmetics` (table) | **Implemented and working** | Ownership ledger (`user_id, cosmetic_key, category, source, unlocked_at, equipped_at`). Reused as-is for 1.1B; only its `category` CHECK constraint needed widening to accept the new cosmetic types. |
| `player_equipped_cosmetics` | **Implemented and working** (as `equipped_cosmetics`) | One row per player: `card_theme, arena, profile_frame, player_title, victory_effect`. Reused as-is; extended with three new columns (`card_face`, `card_back`, `lane_effect`) rather than a second table, since arena/profile_frame/player_title are the same physical slot in both the old and new systems. |
| `wallet` / `wallet_transactions` | **Implemented and working** | `player_wallets` + `apply_wallet_delta` (idempotent, locks the row, rejects negative balances) are the single source of truth for Blaze Coins. Reused unchanged by `purchase_cosmetic`. |
| `purchase_cosmetic` RPC / Edge Function | **Partially implemented (repaired)** | Existed as `purchase_cosmetic_with_coins`: a `SECURITY DEFINER` function, but priced cosmetics via a hardcoded `CASE p_cosmetic_key ... price := 3000 ...` block instead of reading `cosmetic_catalog`. Functionally secure (server-side price, atomic, idempotent) but not table-driven, and had no concept of ownership-slot type checking. Version 1.1B adds a new `purchase_cosmetic(user, cosmetic_id)` function that reads the real price from `cosmetic_catalog` instead. |
| `equip_cosmetic` RPC / Edge Function | **Partially implemented (repaired)** | Existed as `equip_cosmetic_secure`, keyed by legacy `category` strings (`card_theme`, `arena`, `profile_frame`, `title`, `emote`, `victory_effect`) with a special-cased, never-actually-matching "free default" check (`p_cosmetic_key = 'default'`, which no real client catalog id ever equals — see Known Pre-Existing Issue below). Version 1.1B adds a new `equip_cosmetic(user, slot, cosmetic_id)` function keyed by the six explicit equipment slots and validated against `cosmetic_catalog.cosmetic_type`. |
| `BlazeShopScreen` | **Client-only / partially implemented** (as `BlazeStoreScreen`) | Already reachable in the shipped TestFlight build (`isMonetizationBetaEnabled()` defaults true; `isStorePurchasesEnabled()` defaults false so it renders as "BLAZE REWARDS"). Its "COIN COSMETICS" section is a genuine, working purchase flow today. Kept in place, unmodified in structure; two of its four coin items were re-priced (see Naming Collisions below) and the screen's purchase/equip calls now route through the new RPCs transparently. |
| `CosmeticInventoryScreen` | **Not implemented** | No dedicated inventory screen existed. `BlazeStoreScreen` shows owned/equipped state inline per row instead. Version 1.1B's `BlazeLockerScreen` adds the OWNED tab this audit found missing. |
| `PlayingCard` themes | **Implemented but partial** | Two independent `PlayingCard` components exist: `src/components/Card/PlayingCard.tsx` (theme-driven via `cardStyle`, used by `GameScreen`'s active-card stage and `ResultsScreen`/dev previews) and `src/components/cards/PlayingCard.tsx` (used by `LaneBox` for actual lane cards, with **no cosmetic hook-up at all** before this milestone). Version 1.1B adds `faceVariant`/`backVariant` props to the lane-card component and wires both renderers to the new per-slot card face/back cosmetics. |
| `CardBack` | **Client-only / not wired to cosmetics** | `src/components/cards/CardBack.tsx` existed with one fixed visual and no variant prop. No face-down rendering surface exists anywhere in shipped gameplay screens (`GameScreen` never renders a face-down card; only `BlazeUIKitPreviewScreen`, a dev-only screen, does). Version 1.1B adds an `ember` variant; the Ember Card Back cosmetic is visible today via the Locker preview and dev preview, and will apply automatically to any future face-down gameplay surface without further changes. |
| `LaneBox` | **Implemented and working (gameplay), not cosmetic-aware** | Already implements the exact "pulse when a card is placed" animation the Gold Lane Glow spec describes (`feedbackType === 'placed'` → `flashTone` sequence). Version 1.1B adds an optional `laneEffect` prop that swaps the idle/pulse border colors to gold and adds two small corner accents — it does not touch input handling, totals, or scoring. |
| `BlazeScreenBackground` | **Implemented, not cosmetic-aware** | The real background used by Home/Gameplay/Results (`src/components/layout/BlazeScreenBackground.tsx`, static `ImageBackground` + gradients). A *separate* component, `BlazeBackground` (used by `ScreenContainer`, i.e. Store/Settings/Progression/Daily screens), already read `equippedCosmetics.arena` for a live gradient tint. Version 1.1B adds a purely decorative, conditionally-rendered lava tint overlay to `BlazeScreenBackground` itself so Home/Gameplay/Results also reflect the new `lava_arena_tint` cosmetic, without altering the existing background images or layout. |
| Profile frames | **Not implemented visually** | `equipped.profileFrame` was tracked server-side and shown only as a text label (e.g. "DEFAULT FRAME") in `PlayerProgressionScreen`; no actual frame graphic existed anywhere. Version 1.1B adds a small, code-driven `ProfileFrameBadge` component and wires it into Home / Progression / Results. |
| Player titles | **Implemented (data), partial (display)** | `equipped.playerTitle` was already tracked, unlocked via the Day 7 daily-reward path, and shown as plain text on Home/Progression. Version 1.1B upgrades this to a small styled `PlayerTitleBadge` and wires it into Results as well. |
| Feature flags | **Implemented and working** | `EXPO_PUBLIC_ENABLE_STORE_PURCHASES` (default false) already gates all paid UI. `EXPO_PUBLIC_ENABLE_V1_1_LOCKER` (new, default false) added for this milestone, independent of purchases/RevenueCat. |

## Naming collisions found and resolved

Two of the five newly-specified item ids collided with pre-existing catalog
entries that were **not yet reachable by any real user** (both sit behind
disabled feature flags — `EXPO_PUBLIC_ENABLE_PROGRESSION_BETA` for level
rewards, and the coin price was simply a different, much higher beta
placeholder):

- **`ember_card_back`** previously granted for free at Level 5
  (`level_reward_catalog`, `LEVEL_REWARDS` in `src/progression/rewards.ts`).
  Version 1.1B redefines it as a 150-coin card back. The Level 5 reward slot
  no longer grants a cosmetic (`cosmetic_id` set to `NULL`); coins/XP at
  other levels are unaffected.
- **`flame_profile_frame`** previously coin-priced at 2,500 (client-only
  catalog + hardcoded RPC price, reachable via the shipped "BLAZE REWARDS"
  screen). Version 1.1B redefines its price to 400 coins. Any tester who
  already owns it keeps ownership (the ownership row is keyed by
  `cosmetic_key`, untouched by this migration).

Both changes are documented here and in `docs/V1_1B_COSMETIC_CATALOG.md`.
The three *other* pre-existing coin cosmetics (`midnight_cards`,
`ember_arena`, `hot_streak_title`) do not collide with any Version 1.1B id
and are migrated as-is (same id, same price) into the unified catalog so
`purchase_cosmetic` / `equip_cosmetic` become the single coin-purchase path
for old and new items alike.

## Known pre-existing issue (not touched by this milestone)

`equip_cosmetic_secure`'s free-default check compares the incoming
`p_cosmetic_key` to the literal strings `'classic'` / `'default'`, but the
real client catalog ids are `'classic_cards'` / `'default_arena'` /
`'default_frame'` — these never match, so equipping a *legacy* free default
by its real catalog id would raise "not owned" (in practice this path is
never hit because the UI never lets a user re-select the default). This
bug predates Version 1.1B, is unrelated to the new locker system (which
uses its own catalog ids consistently), and is left unchanged to avoid
scope creep and regression risk.

## Reuse decisions

- **Reused unchanged:** `player_wallets`, `wallet_transactions`,
  `apply_wallet_delta`, `ensure_player_wallet`, `player_cosmetics`,
  `unlock_cosmetic`, `seed_free_player_cosmetics`.
- **Extended, not duplicated:** `cosmetic_catalog` (new columns),
  `equipped_cosmetics` (three new columns), `BlazeStoreScreen` (kept as the
  paid-product shell; the same store methods it already called —
  `hydrateCosmetics`, `equipCosmetic`, `purchaseWithCoins` — are internally
  repointed at the new RPCs).
- **New:** `purchase_cosmetic`, `equip_cosmetic` RPCs; `BlazeLockerScreen`;
  `CosmeticPreview`, `CosmeticUnlockOverlay`, `ProfileFrameBadge`,
  `PlayerTitleBadge`, `ArenaPreviewPanel` components.
