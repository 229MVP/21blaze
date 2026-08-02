# Version 1.1 Feature Audit — 21 Blaze

**Purpose:** Ground-truth audit of the actual repository state before building Version 1.1A "Rewards and Economy Foundation." Nothing here is assumed from a prior prompt or spec — every row was verified by reading the real client and server code.

**Branch:** `feature/1.1-blaze-rewards`
**Date:** 2026-08-02

Status legend:

| Status | Meaning |
|---|---|
| **Implemented and working** | Code exists end-to-end and the design is sound; not yet exercised against a live deployed backend |
| **Implemented but untested** | Code exists end-to-end; remote deployment / device testing not confirmed |
| **Partially implemented** | Some of the flow exists; a real gap remains |
| **Client-only** | UI/state exists; no server counterpart |
| **Backend-only** | Server exists; no client consumer |
| **Disabled** | Code exists but is switched off by feature flags in every current build profile |
| **Not implemented** | No code found |

---

## Player progression (XP / levels)

**Status: Implemented but untested; Disabled in every current build profile.**

- Schema: `public.player_progression`, `public.progression_transactions` (append-only ledger, globally unique `idempotency_key`) — `supabase/migrations/0006_progression_beta.sql`.
- Server: `grant_player_xp(...)` — idempotent XP grant with automatic level-up, XP carry-over, level cap at 50, and level-reward fan-out. Called from `submit-match` via `grantMatchXp()` (`supabase/functions/_shared/progression.ts`) for every non-quit Solo/Casual/Ranked match (Solo = 50 XP flat).
- Client: `src/progression/levelEngine.ts` (pure XP math mirror), `src/store/useProgressionStore.ts`, `src/services/progressionService.ts` (typed response parsing), `PlayerProgressionScreen.tsx`.
- Gate: `isProgressionBetaEnabled()` → `EXPO_PUBLIC_ENABLE_PROGRESSION_BETA` — **`false` in development, preview, testflight, and production.** The Home "LVL" badge, XP bar, and `PlayerProgressionScreen` are all unreachable today.
- Not changed by this milestone. Version 1.1A intentionally keeps this flag as-is; enabling full XP/level UI exposure is a separate readiness decision.

## Blaze Coins / wallet ledger

**Status: Implemented and working (Version 1.0 formula); Version 1.1A adds a new, additive formula.**

- Schema: `public.player_wallets`, `public.wallet_transactions` (append-only, `UNIQUE(user_id, idempotency_key)`) — `0005_monetization_beta.sql`.
- Authority: `apply_wallet_delta(user_id, amount, type, source_key, idempotency_key, metadata)` is the **only** way any balance changes; it is `SECURITY DEFINER`, revoked from `PUBLIC`/`anon`, granted to `service_role` only.
- Version 1.0 Solo formula (unchanged, still active when `EXPO_PUBLIC_ENABLE_V1_1_REWARDS=false`): `claim_solo_match_coins` → `calculate_solo_match_coins(score, isFirstOfDay)` = 25 base + score tiers (+10/+15/+25) + 50 first-of-day bonus, sourced from `verified_scores` only (client `score` param ignored since `0007_rc_solo_coin_verified.sql`).
- Version 1.1A formula (new, additive, gated by `EXPO_PUBLIC_ENABLE_V1_1_REWARDS`): `claim_v1_1_match_reward` — see [`V1_1_REWARDS_SPEC.md`](./V1_1_REWARDS_SPEC.md).
- Client mirror: `src/store/useWalletStore.ts`, `src/config/economyConfig.ts` (new).
- Client `balance` is always a **read reflection** of a server response; no code path sets it from an unconfirmed value.

## Match verification

**Status: Implemented and working.**

- `submit-match` Edge Function replays the client's move log against the server-recomputed deck (`supabase/functions/_shared/game/{gameEngine,replayMatch}.ts`) using the match's stored `seed`. Score, lanes cleared, cards played, busts, and `timeRemainingSeconds` are all **recomputed server-side** — nothing from the client is trusted except the move sequence itself, which is itself replayed and validated (monotonic `elapsedMilliseconds`, legal lane placements, terminal-state check).
- `timeExpired` completions get an additional real-wall-clock sanity check against `online_matches.started_at` before being accepted.
- Verified rows land in `public.verified_scores`, one row per `match_id` (idempotent — resubmission returns the existing row).
- Version 1.1A reuses `verified_scores.time_remaining_seconds` plus real wall-clock time (`online_matches.started_at` to now) to derive active-play time, rather than trusting any new client-submitted duration.

## Daily rewards (7-day streak)

**Status: Implemented but untested; Disabled in every current build profile.**

- Schema: `daily_reward_claims` (`UNIQUE(idempotency_key)`), streak fields on `player_progression`.
- Server: `claim_daily_reward_secure` — server time (`now()`) only; 20-hour minimum interval between claims; 48-hour streak-continuation window; deterministic 7-day cycle. Fully idempotent via an explicit or auto-derived idempotency key.
- Calendar (`daily_reward_for_streak_day`, updated by this milestone — see below): now 20/25/30/40/50/60/100 Blaze Coins, day 7 also unlocks the existing `seven_day_blaze_title` cosmetic.
- Client: `daily-reward` Edge Function wrapper (`status`/`claim`/`history`), `src/services/progressionService.ts`, `src/store/useProgressionStore.ts`, `DailyRewardScreen.tsx`.
- Gate: `isDailyRewardsEnabled()` — previously required `isProgressionBetaEnabled()`; **this milestone changes it to require the new `isV1_1RewardsEnabled()` master flag instead**, decoupling "daily login rewards" from the separate XP/level UI exposure decision. Still `false` by default everywhere.

## Daily missions

**Status: Implemented but untested; Disabled in every current build profile.**

- Schema: `mission_templates` (originally 9 seeded templates: 3 participation, 4 skill, 2 mode). Compared against the exact Version 1.1A pool: `clear_ten_lanes` and `hit_five_exact_21` already matched exactly; `reach_x3_three_times` already matched exactly; `complete_two_solo_matches` (target 2) and `get_three_five_card_clears` (target 3) were off by one from the requested "3 Solo matches" / "2 five-card clears" — **this milestone's migration updates both targets in place**; "complete one match with fewer than three busts" did not exist as a mission type at all — **this milestone adds it** (`low_busts` mission type, new `complete_low_bust_match` template), which required adding a `busts` parameter to `apply_mission_progress_from_match` (backward compatible — new trailing parameter with a default) and threading the real bust count through `submit-match`. `player_daily_missions`, `mission_progress_events` (idempotent per `player_mission_id` + `match_id`) unchanged.
- Server: `assign_daily_missions_secure` (deterministic 1 participation + 1 skill + 1 mode assignment per UTC day, hashed per user so it doesn't reroll), `apply_mission_progress_from_match` (idempotent progress from a verified match summary), `claim_daily_mission_secure` (claim-once, `claimed_at` guard).
- Client: `daily-missions` Edge Function wrapper, `progressionService.ts`, `useProgressionStore.ts`, `DailyMissionsScreen.tsx`.
- `submit-match` already calls `applyMissionProgressFromMatch` automatically for every non-quit match — this is **not** re-triggered by the new Version 1.1A match-reward flow (which only handles coins/reads back XP), avoiding any duplicate progress application.
- Gate: same as daily rewards — now requires `isV1_1RewardsEnabled()`.

## Level rewards

**Status: Implemented but untested; Disabled (follows progression beta, unchanged by this milestone).**

- `level_reward_catalog` + `player_level_rewards` (once-per-level ledger) + `grant_level_reward_secure`, invoked automatically from inside `grant_player_xp` whenever a level is crossed.

## Cosmetic inventory / equipped cosmetics

**Status: Implemented and working**, independent of the purchase flag freeze.

- `public.cosmetic_catalog`, `player_cosmetics`, `equipped_cosmetics` (referenced by `equip-cosmetic`/`purchase-cosmetic` Edge Functions).
- `useCosmeticStore.purchaseWithCoins` → `purchase-cosmetic` → `purchase_cosmetic_with_coins` RPC is a genuine, already-working coin spend sink (Midnight Cards 3,000 / Ember Arena 5,000 / Hot Streak title 2,000 / Flame Profile Frame 2,500), rendered in the ads-first "BLAZE REWARDS" screen regardless of the purchase flag.
- Achievement-tier free cosmetics (level 3/5/10/15/25/30/40/50 titles/frames/card-backs, plus the day-7 `seven_day_blaze_title`) exist in the catalog and are unlocked correctly by `grant_level_reward_secure` / `claim_daily_reward_secure`, but are unreachable while progression stays disabled (see above).

## AdMob / rewarded ads / interstitial ads

**Status: Implemented and working (interstitial); Implemented but intentionally inert (rewarded currency).**

- `src/monetization/interstitialAdService.ts` — Solo-only, 3-matches-since-last-ad, 10-minute cooldown, 3-per-session **and** 3-per-UTC-day cap (persisted via `hydrateInterstitialCaps()`, called at `App.tsx` startup), never during the player's first app session. Unchanged by this milestone.
- `src/monetization/rewardedAdService.ts` — ad SDK/unit loading is enabled (`EXPO_PUBLIC_ENABLE_REWARDED_ADS=true` in every profile), but the only client entry point (`ResultsScreen`'s "DOUBLE REWARD" button) is gated by `isRewardedCurrencyEnabled()`, which is `false` everywhere because AdMob server-side verification does not exist. **Exact blocker:** `supabase/functions/claim-ad-reward/index.ts` trusts the client-supplied `clientRewardId` and local `EARNED_REWARD` callback; there is no AdMob SSV webhook validating a real ad was watched. Unchanged by this milestone — see [`V1_1_REWARDS_SPEC.md`](./V1_1_REWARDS_SPEC.md) §Rewarded ads.
- `EXPO_PUBLIC_ADMOB_USE_TEST_ADS` forces Google sample test ad units for development/preview/testflight; production expects real unit IDs via EAS secrets (not yet supplied — documented pre-existing blocker).

## Supabase migrations

**Status: Present locally (8 files); remote deployment status unverified from this environment.**

`0001_online_leaderboard.sql` … `0007_rc_solo_coin_verified.sql` existed before this milestone. **New in this milestone:** `0008_v1_1_rewards_economy.sql` (updated daily reward calendar + the additive Version 1.1A match-reward function/table). The Supabase MCP connection available in this sandbox points to an unrelated project (a sports/fantasy platform, confirmed by `list_tables`/`get_project_url`), so none of these migrations can be or were applied from this environment. See [`V1_1_BACKEND_DEPLOYMENT_CHECKLIST.md`](./V1_1_BACKEND_DEPLOYMENT_CHECKLIST.md).

## Supabase Edge Functions

**Status: Present locally; remote deployment status unverified.**

Existing: `claim-match-coins`, `submit-match`, `daily-reward`, `daily-missions`, `claim-ad-reward`, `purchase-cosmetic`, `equip-cosmetic`, `sync-entitlements`, `revenuecat-webhook`, Live/Ranked/Quick-Match functions. **New in this milestone:** `claim-match-rewards` (Version 1.1A single secure match reward endpoint).

## Feature flags

**Status: Implemented and working; new flags added by this milestone.**

`src/config/featureFlags.ts` — pure, environment-agnostic (no RN import), safe to call anywhere including plain Node self-tests. All flags default to `false` when unset (`envFlag` fails safe). New in this milestone: `isV1_1RewardsEnabled()` (`EXPO_PUBLIC_ENABLE_V1_1_REWARDS`). Changed: `isDailyRewardsEnabled()` / `isDailyMissionsEnabled()` now require the new flag instead of `isProgressionBetaEnabled()`. `isRewardedAdsEnabled`, `isInterstitialAdsEnabled`, `isStorePurchasesEnabled` confirmed unchanged and correctly composed.

## Analytics

**Status: Implemented and working (in-memory sink only, no third-party SDK).**

`src/monetization/analytics.ts` — `trackEvent(name, payload)` accepts any event name (typed arrays exist for documentation, e.g. `PROGRESSION_ANALYTICS_EVENTS`). New in this milestone: `V1_1_REWARDS_ANALYTICS_EVENTS` and the actual `trackEvent(...)` call sites in `useWalletStore.claimV1_1Reward` and the Results rewarded-ad handler.
