# Version 1.1A "Blaze Rewards" — Rewards and Economy Foundation Spec

**Branch:** `feature/1.1-blaze-rewards`
**Scope:** foundation only — server economy, one secure match-reward flow, Results/Home surface, feature flags. Multiplayer, tournaments, paid currency, and loot boxes are explicitly out of scope. Purchases remain disabled (`EXPO_PUBLIC_ENABLE_STORE_PURCHASES=false`).

See [`V1_1_FEATURE_AUDIT.md`](./V1_1_FEATURE_AUDIT.md) for what already existed before this milestone.

---

## 1. Reward sources

| Source | Amount | Idempotency key | Notes |
|---|---|---|---|
| Solo match completion | 10 Blaze Coins | `v1_1_match_coins:{matchId}` | Any non-quit completed Solo match |
| First Solo match of the UTC day | +20 Blaze Coins | `v1_1_first_day:{matchId}` | Detected by absence of a `v1_1_first_day` wallet transaction today (UTC) |
| Active completed-match play | 1 coin / full active minute, capped at 20/day | `v1_1_active_time:{matchId}` | See §3 |
| Solo match XP | 50 XP (unchanged from 1.0) | `progression:solo:{matchId}` (existing key, granted once by `submit-match`) | Read back, never re-granted, by the new flow |
| Daily login streak | 20/25/30/40/50/60/100 coins (day 1–7); day 7 also grants `seven_day_blaze_title` | existing `claim_daily_reward_secure` scheme | Server time only; unchanged mechanism, updated calendar |
| Daily missions | 25 (easy) / 35 (medium) / 50 (hard) XP+coins per the seeded template | existing `claim_daily_mission_secure` scheme | See §2 |

All coin sources above route through `apply_wallet_delta`, which is `SECURITY DEFINER`, revoked from `PUBLIC`/`anon`, and the sole writer of `player_wallets`/`wallet_transactions`.

## 2. Daily missions

Three UTC-daily missions: 1 participation + 1 skill + 1 mode, deterministically hashed per user/day (no rerolls). Pool aligned to the Version 1.1A spec in `supabase/migrations/0008_v1_1_rewards_economy.sql`:

- Participation: *Complete 3 Solo Matches* (updated from 2), *Play 5 Matches*, *Play a Live Duel*
- Skill: *Clear 10 Lanes*, *Hit Exact 21 ×5*, *Five-Card Clears ×2* (updated from 3), *Reach ×3 Three Times*, *Reach ×5 Once*, **new** *Clean Match* (fewer than 3 busts)
- Mode: *Complete 2 Solo Matches*, *Complete 2 Casual Duels*, *Complete 1 Ranked Match*

Reward tiers already match the requested 25/35/50 Easy/Medium/Hard split via each template's `xp_reward`/`blaze_coin_reward`. Progress is applied from `submit-match`'s verified match summary (`apply_mission_progress_from_match`), which is idempotent per `(player_mission_id, match_id)`. Claiming is a separate, once-only step (`claim_daily_mission_secure`, guarded by `claimed_at`).

**Multiplayer-gated missions:** `requires_live_duel` / `requires_ranked` templates are excluded from assignment whenever Live Duel / Ranked are disabled (`assign_daily_missions_secure(p_allow_live_duel, p_allow_ranked, ...)`), consistent with "do not assign multiplayer missions while multiplayer is disabled."

## 3. Active-play-time coins

Server-derived, never client-trusted:

```
replay_derived_seconds = 120 - verified_scores.time_remaining_seconds   -- excludes countdown & pause by construction
wall_clock_seconds     = min(now() - online_matches.started_at, 120)   -- real elapsed time, independent bound
active_seconds         = min(replay_derived_seconds, wall_clock_seconds)
active_minutes         = floor(active_seconds / 60)
active_coins           = min(active_minutes, 20 - coins_already_granted_today)
```

- `time_remaining_seconds` comes from the fully server-replayed match (see [`V1_1_FEATURE_AUDIT.md`](./V1_1_FEATURE_AUDIT.md) §Match verification) — it only advances while the in-game timer is running, so it structurally excludes countdown, pause, and menu time.
- The wall-clock minimum additionally bounds the result by real elapsed time, so a client cannot inflate `active_seconds` by submitting a padded `elapsedMilliseconds` sequence — the server-observed `started_at` timestamp caps it regardless.
- `coins_already_granted_today` is the sum of the user's `v1_1_active_time` wallet transactions for the current UTC day, so the 20/day cap holds across multiple matches.

Invalid, abandoned, and rejected matches never reach `verified_scores`, so they cannot produce any of the above (`claim_v1_1_match_reward` requires the match status to be `'completed'` and a `verified_scores` row to exist).

## 4. Match reward flow

One endpoint, `claim-match-rewards` → `claim_v1_1_match_reward(user_id, match_id)`:

1. Authenticate (`requireAuthedUser`).
2. If a `match_v1_1_rewards` row already exists for this `match_id`, return it verbatim (idempotent retry — no recomputation, no double effects).
3. Lock and verify match ownership + `status = 'completed'`.
4. Load the (already server-verified) `verified_scores` row.
5. Quit matches (`game_over_reason = 'quit'`) record an all-zero row and return zero — matches "invalid/abandoned/rejected matches grant no rewards."
6. Otherwise compute match coins, first-of-day bonus, and active-time coins per §1/§3.
7. Grant each as an independently idempotent `apply_wallet_delta` call.
8. Read back (never re-grant) the XP already recorded by `submit-match`'s automatic `grant_player_xp` call for this match.
9. Persist one `match_v1_1_rewards` row and return the itemized summary + new wallet balance.

The client (`src/store/useWalletStore.ts` → `claimV1_1Reward`) sends only `matchId`; every amount is computed server-side.

## 5. Results screen behavior (behind `EXPO_PUBLIC_ENABLE_V1_1_REWARDS`)

States: `SYNCING REWARDS…` → `REWARDS VERIFIED` (itemized rows, each only shown if > 0) / `LOCAL MATCH — NO ONLINE REWARDS` / `REWARD SYNC FAILED — RETRY AVAILABLE`. The claim call fires once per match (`useWalletStore`'s `v1_1RewardByMatchId` cache + in-flight guard prevent resubmission on rerender), never blocks navigation (Results renders immediately; the panel updates asynchronously), and never shows an optimistic amount before the server responds. When the flag is off, the screen is byte-for-byte the Version 1.0 coins/XP panel.

## 6. Rewarded ads

Unchanged: rewarded-currency stays disabled everywhere because there is no AdMob server-side verification (`claim-ad-reward` trusts the client `EARNED_REWARD` callback). See [`V1_1_FEATURE_AUDIT.md`](./V1_1_FEATURE_AUDIT.md) for the exact blocker. New analytics: `rewarded_ad_started` (on request), `rewarded_ad_verification_failed` (client reported "earned" but the server-side claim granted zero).

## 7. Interstitial ads

Unchanged from the ads-first release: Solo-only, every 3 completed matches, 10-minute cooldown, 3/session and 3/UTC-day caps, never on the first app session, never during countdown/gameplay/pause/results/reward-sync/daily-claim/mission-claim/Live/Ranked.

## 8. Deferred to Version 1.1B

- The 5-item free cosmetic catalog (Ember Card Back, Gold Lane Glow, Midnight Card Style, Flame Profile Frame, Lava Arena Tint) — see [`V1_1_FREE_REWARD_CATALOG_PLAN.md`](./V1_1_FREE_REWARD_CATALOG_PLAN.md). None of these are implemented in 1.1A.
- Enabling `EXPO_PUBLIC_ENABLE_V1_1_REWARDS` (and `EXPO_PUBLIC_ENABLE_DAILY_REWARDS`/`_MISSIONS`) in any build profile — this milestone ships the foundation OFF by default everywhere.
- AdMob server-side verification for rewarded currency.

## 9. Known blockers

1. **AdMob SSV missing** — rewarded-currency stays off (unchanged blocker, re-confirmed).
2. **Remote backend deployment unverified** — the Supabase MCP connection available in this sandbox points to an unrelated project; `0008_v1_1_rewards_economy.sql` and `claim-match-rewards` have not been applied/deployed from this environment. See [`V1_1_BACKEND_DEPLOYMENT_CHECKLIST.md`](./V1_1_BACKEND_DEPLOYMENT_CHECKLIST.md).
3. **No live device/integration testing** — see [`V1_1_ECONOMY_TEST_MATRIX.md`](./V1_1_ECONOMY_TEST_MATRIX.md) for which of the required 18 test scenarios are unit-tested here vs. require a deployed backend.
