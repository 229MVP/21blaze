# Version 1.1B Free Reward Catalog Plan

**Status: planning only. Nothing in this document is implemented in Version 1.1A.**

Blaze Coins already have a genuine spend sink today, independent of this plan — `useCosmeticStore.purchaseWithCoins` → `purchase-cosmetic` → `purchase_cosmetic_with_coins` RPC, backing the existing coin-priced catalog entries (Midnight Cards 3,000 / Ember Arena 5,000 / Hot Streak title 2,000 / Flame Profile Frame 2,500 — see `src/cosmetics/catalog.ts`). This plan is for the **additional, lightweight, code-driven** free-earnable set requested for a future 1.1B milestone, not a replacement for that sink.

## Planned rewards (5)

1. **Ember card back** — card-face cosmetic treatment.
2. **Gold lane glow** — lane-highlight visual treatment.
3. **Midnight card style** — card-face cosmetic treatment.
4. **Flame profile frame** — profile frame cosmetic.
5. **Lava arena tint** — arena background tint.

## Naming collision note for the 1.1B implementer

Two of the names above overlap with cosmetics that **already exist** in the current catalog (`src/cosmetics/catalog.ts`, `supabase/migrations/0006_progression_beta.sql`):

- `ember_card_back` already exists (level-5 free progression reward).
- `flame_profile_frame` already exists (coin-purchasable, 2,500 coins) — distinct from the level-40 `spark_profile_frame` / `blaze_profile_frame` rewards.

Before implementing 1.1B, confirm with design whether these two planned items are meant to be the **same** assets (in which case no new catalog entry is needed — just a new earn path, e.g. a mission or streak reward pointing at the existing `cosmetic_id`) or **visually distinct new assets** that need new, non-colliding catalog keys (e.g. `midnight_lane_glow`, `lava_arena_tint_v2`) to avoid clashing with the existing `ember_card_back` / `flame_profile_frame` records.

## Implementation shape (for 1.1B, not now)

Each reward would need:

- A `cosmetic_catalog` row (id, name, description, category, rarity, metadata) — same table already used by achievement/level/daily-streak cosmetics.
- A grant path: either a mission reward (`mission_templates.blaze_coin_reward` fields don't carry cosmetics today — would need a `cosmetic_id` column added to `mission_templates` and a small `claim_daily_mission_secure` extension), a coin-priced catalog entry (`purchaseSource: 'coins'`, reusing the existing `purchase-cosmetic` flow — the simplest option requiring **zero** new backend code), or a level/streak reward (reusing `level_reward_catalog` / `daily_reward_for_streak_day`, both of which already support attaching a `cosmetic_id`).
- Client rendering: confirm each cosmetic category (`card_theme`, `arena`, `profile_frame`) already has a working preview/equip surface (it does, via `PlayingCard` cosmetic props, arena background theming, and profile frame rendering) before promising it in any UI copy.

## Explicit non-goals (per the 1.1A feature freeze)

- No paid packages, no random rewards, no loot boxes, no consumable purchases.
- No new spend currency — everything above spends the existing Blaze Coins or is earned via existing free-progression mechanics.

## Day 7 daily-streak cosmetic

The daily streak's day-7 slot already grants a real, working cosmetic (`seven_day_blaze_title`, unlocked via `claim_daily_reward_secure` → `unlock_cosmetic`) — this is **not** one of the 5 items above and was not changed by this plan. It is a pre-existing Version 1.0/1.1A reward, not a 1.1B placeholder, and can safely continue to be advertised once `EXPO_PUBLIC_ENABLE_DAILY_REWARDS` is enabled.
