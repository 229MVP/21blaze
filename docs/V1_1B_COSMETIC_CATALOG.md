# Version 1.1B Cosmetic Catalog

All cosmetics below are **code-driven** — React Native views, gradients,
and `react-native-svg`/`expo-linear-gradient` primitives only. No remote
images, no downloaded third-party assets, no sprite sheets. Every visual
can be swapped for a future artist-created asset by changing only the
rendering component (`CardBack`, `PlayingCard`, `LaneBox`,
`BlazeScreenBackground`, `ProfileFrameBadge`) — the cosmetic id, catalog
row, ownership record, and equip slot never need to change.

## Catalog fields (`public.cosmetic_catalog`)

| Field | Type | Notes |
|---|---|---|
| `id` | `text` primary key | Stable identifier, never renamed once shipped. |
| `name` | `text` | Display name. |
| `description` | `text` | Shown on the Locker cosmetic card. |
| `cosmetic_type` | `text` | One of `card_face`, `card_back`, `arena`, `profile_frame`, `player_title`, `lane_effect` (plus legacy `card_theme`/`title`/`emote`/`victory_effect` for pre-1.1B rows). |
| `rarity` | `text` | `common` / `uncommon` / `rare` / `epic` / `legendary`. |
| `unlock_method` | `text` | `free`, `blaze_coins`, `streak`, or `level`. |
| `blaze_coin_cost` | `integer \| null` | Required iff `unlock_method = 'blaze_coins'`, enforced by a CHECK constraint. |
| `is_enabled` | `boolean` | Locker/Store hide disabled rows. |
| `sort_order` | `integer` | Display ordering. |
| `created_at` | `timestamptz` | |

`category` (the pre-1.1B column) is retained and left `NULL` for new rows;
it is not read by the new RPCs.

## Equipment slots (`public.equipped_cosmetics`)

| Slot | Column | Cosmetic type |
|---|---|---|
| `cardFaceId` | `card_face` | `card_face` |
| `cardBackId` | `card_back` | `card_back` |
| `arenaId` | `arena` | `arena` |
| `profileFrameId` | `profile_frame` | `profile_frame` |
| `playerTitleId` | `player_title` | `player_title` |
| `laneEffectId` | `lane_effect` | `lane_effect` |

`arena` and `profile_frame` are the same physical columns used by the
pre-1.1B system (no duplicate slot); `card_face`, `card_back`, and
`lane_effect` are new columns.

## Free defaults (always owned, never require an unlock action)

| Id | Type | Visual |
|---|---|---|
| `classic_card_face` | `card_face` | The existing default card face (unchanged rendering). |
| `classic_card_back` | `card_back` | The existing default card back (unchanged rendering). |
| `classic_arena` | `arena` | The existing default background (unchanged rendering). |
| `default_profile_frame` | `profile_frame` | Plain ring, no flame accents. |
| `no_title` | `player_title` | No title displayed below the player name. |

## Version 1.1B earnable cosmetics

### `ember_card_back` — Ember Card Back
- **Type:** `card_back` · **Rarity:** uncommon · **Unlock:** 150 Blaze Coins
- **Visual:** Deep charcoal → ember-red gradient (`#241008` → `#5A1A00`),
  thin orange border, a centered flame mark, two small ember dots.
- **Implementation:** `src/components/cards/CardBack.tsx` (`variant="ember"`).
- **Equip slot:** `cardBackId`.
- **Note:** Redefined from a pre-existing, unreached Level 5 free reward —
  see `docs/V1_1B_COSMETIC_AUDIT.md`.

### `gold_lane_glow` — Gold Lane Glow
- **Type:** `lane_effect` · **Rarity:** rare · **Unlock:** 250 Blaze Coins
- **Visual:** Gold-orange lane border, two small top corner accents, and a
  brief gold pulse (reusing the lane's existing "card placed" animation,
  retinted) instead of a new, separate animation loop.
- **Implementation:** `src/components/game/LaneBox.tsx` (`laneEffect` prop).
- **Equip slot:** `laneEffectId`.
- **Gameplay guarantee:** Never touches `onPress`, lane totals, or scoring
  — purely a border/accent color swap layered on the existing animation.

### `midnight_card_style` — Midnight Card Style
- **Type:** `card_face` · **Rarity:** rare · **Unlock:** 350 Blaze Coins
- **Visual:** Near-black card background (`#141414`), thin gold border,
  bright red hearts/diamonds (`#FF5A5A`), pale ivory clubs/spades
  (`#E8E0D0`) for accessible contrast against the dark face.
- **Implementation:** `src/components/cards/PlayingCard.tsx`
  (`faceVariant="midnight"`), also mapped onto the legacy
  `Card/PlayingCard.tsx` theme system via `useActiveCardTheme()` so the
  active-card stage on `GameScreen` reflects it too.
- **Equip slot:** `cardFaceId`.

### `flame_profile_frame` — Flame Profile Frame
- **Type:** `profile_frame` · **Rarity:** epic · **Unlock:** 400 Blaze Coins
- **Visual:** Orange-to-gold gradient ring, two small flame accents at the
  top corners, dark inner circle.
- **Implementation:** `src/components/cosmetics/ProfileFrameBadge.tsx`
  (`variant="flame"`).
- **Equip slot:** `profileFrameId`.
- **Applied on:** Home profile row, Progression profile card, Results
  (when equipped). Live Lobby is not yet reachable in this build
  (`EXPO_PUBLIC_ENABLE_LIVE_DUEL` defaults false) — the component is ready
  to drop in once that surface ships.
- **Note:** Redefined from a pre-existing 2,500-coin beta price — see
  `docs/V1_1B_COSMETIC_AUDIT.md`.

### `lava_arena_tint` — Lava Arena
- **Type:** `arena` · **Rarity:** epic · **Unlock:** 500 Blaze Coins
- **Visual:** Near-black background, a controlled deep-red/lava gradient
  near the bottom, a few static ember dots. No particle engine.
- **Implementation:** `src/components/layout/BlazeScreenBackground.tsx`
  (conditional overlay `LinearGradient`, purely decorative,
  `pointerEvents="none"`).
- **Equip slot:** `arenaId`.
- **Applied on:** Home, Gameplay, Results (all three already render inside
  `BlazeScreenBackground`).

### `seven_day_blaze_title` — Seven Day Blaze
- **Type:** `player_title` · **Rarity:** legendary · **Unlock:** 7-day
  daily-reward streak (not purchasable with coins)
- **Visual:** Small orange-gold pill badge below the player name reading
  "SEVEN DAY BLAZE" (`src/components/cosmetics/PlayerTitleBadge.tsx`).
  Does not imply staff/moderator/administrator status.
- **Implementation:** Unlocked server-side by the pre-existing
  `claim_daily_reward_secure` function when the streak reaches day 7
  (unchanged call site; only the catalog row's `cosmetic_type` was set to
  `player_title` for slot matching). Idempotent via `unlock_cosmetic`'s
  `ON CONFLICT (user_id, cosmetic_key) DO NOTHING`-equivalent upsert —
  future Day 7 cycles never duplicate ownership, though coins/XP are still
  granted every cycle.
- **Equip slot:** `playerTitleId`.

## Pre-existing coin cosmetics (unchanged ids/prices, migrated into the unified catalog)

| Id | Type | Cost | Notes |
|---|---|---|---|
| `midnight_cards` | `card_face` | 3,000 | Full legacy "card theme"; unaffected by `midnight_card_style`. |
| `ember_arena` | `arena` | 5,000 | |
| `hot_streak_title` | `player_title` | 2,000 | |

## Security summary

- `purchase_cosmetic(user_id, cosmetic_id)` reads `blaze_coin_cost` fresh
  from `cosmetic_catalog` inside the same transaction — the client never
  sends a price. Already-owned purchases short-circuit before any wallet
  mutation. The underlying `apply_wallet_delta` call locks the wallet row,
  is idempotent per `(user_id, idempotency_key)`, and raises on a
  resulting negative balance.
- `equip_cosmetic(user_id, slot, cosmetic_id)` validates the cosmetic
  exists, that its `cosmetic_type` matches the requested slot, and that
  the player owns it (or that it is a `free`-unlock default) before
  writing to `equipped_cosmetics`.
- Both functions verify `auth.uid()` matches `p_user_id` when called by an
  authenticated session; `purchase_cosmetic` is additionally restricted to
  `service_role` only (invoked exclusively via the `purchase-cosmetic`
  Edge Function, after that function independently verifies the caller's
  JWT).

## Offline behavior

- Cached catalog/ownership/equipped state continues to render.
- The Locker shows "CONNECT ONLINE TO UNLOCK OR CHANGE COSMETICS" and
  disables purchase/equip actions while `authStatus !== 'online'`.
- No ownership is ever granted locally; all writes go through the server.

## Future professional asset replacement points

Replacing any of these code-driven visuals with artist-created assets
requires touching only the rendering component listed above — the
cosmetic `id`, catalog row, ownership records, and equip slot mapping do
not change, so no data migration or re-grant is ever needed.
