# Version 1.1A Economy Test Matrix

Maps every required test scenario to its actual coverage. "Unit tested" means it runs today via `npm run test:v1.1-rewards` (`src/monetization/v1_1RewardsSelfTest.ts`), pure and RN/Postgres-independent. "Integration" means it requires a deployed Supabase backend + real auth session and cannot be executed from this sandbox (no working connection to the 21 Blaze Supabase project — the only reachable Supabase MCP server belongs to an unrelated project).

| # | Scenario | Coverage | Where |
|---|---|---|---|
| 1 | Completed Solo match grants 10 coins | **Unit tested** | `calculateV1_1MatchCoins(false) === 10` |
| 2 | First completed match grants an additional 20 coins | **Unit tested** | `calculateV1_1MatchCoins(true) === 30` |
| 3 | Second match on the same UTC day does not grant the first-match bonus | **Unit tested** | `calculateV1_1MatchCoins(false)` excludes the bonus; the SQL-level "first of day" gate itself is integration-only |
| 4 | Active-time rewards use only eligible completed-match time | **Unit tested** | `deriveActiveSeconds` prefers the smaller of replay-derived vs. wall-clock time |
| 5 | Paused time is excluded | **Unit tested** | `deriveActiveSeconds` with inflated wall-clock (simulated pause) still returns the replay-derived value |
| 6 | Background time is excluded | **Unit tested** | Same mechanism as #5, separate scenario for a 1-hour backgrounding gap |
| 7 | Active-time reward caps at 20 coins daily | **Unit tested** | `calculateV1_1ActiveTimeCoins` — below-cap, remaining-budget, over-cap-from-zero, and no-budget-left cases |
| 8 | Duplicate match submission grants once | **Integration** (SQL design verified by code review) | `claim_v1_1_match_reward` checks `match_v1_1_rewards` for an existing row and returns it verbatim before any wallet mutation; each coin component also has its own `wallet_transactions` idempotency key |
| 9 | Invalid match grants no rewards | **Unit tested** (client-reachable "quit" case) + **integration** (server-side replay/verification rejection) | `calculateV1_1RewardBreakdown({isQuit: true, ...})` → all zero; a failed replay never produces a `verified_scores` row at all |
| 10 | Abandoned match grants no rewards | **Integration** (by construction) | Abandoned matches (`online_matches.status = 'abandoned'`) never reach `'completed'` or gain a `verified_scores` row, so `claim_v1_1_match_reward` raises "match is not completed" before computing anything |
| 11 | Local-only match grants no server currency | **Unit tested** | `shouldSyncV1_1Reward({eligibility: 'localOnly', ...}) === 'local'` — the claim function is never called |
| 12 | Mission progress is idempotent | **Integration** (SQL design verified by code review) | `mission_progress_events` has `UNIQUE(player_mission_id, match_id)`; `apply_mission_progress_from_match` checks for an existing event before mutating progress |
| 13 | Mission claim grants once | **Integration** (SQL design verified by code review) | `claim_daily_mission_secure` checks `claimed_at IS NOT NULL` and returns the existing state without re-granting |
| 14 | Daily reward claim grants once | **Integration** (SQL design verified by code review) | `claim_daily_reward_secure` derives/accepts an idempotency key and returns the existing `daily_reward_claims` row on a repeat call |
| 15 | Device clock changes do not affect eligibility | **Unit tested** | `evaluateDailyClaim` takes `nowMs`/`lastClaimAtMs` as explicit parameters — the server RPC uses Postgres `now()`, never a client-submitted timestamp, for the authoritative decision |
| 16 | Rewarded-ad callback without server verification grants zero | **Integration** (code-review verified) | `useWalletStore.claimRewardedDouble` only ever sets `balance` from the awaited `claim-ad-reward` response; there is no code path that credits currency from the client's local `EARNED_REWARD` event alone |
| 17 | Store purchases remain disabled | **Unit tested** | `isStorePurchasesEnabled()` returns `false` with the flag unset |
| 18 | RevenueCat does not initialize when purchases are disabled | **Code-review verified** (not runtime-tested here — `revenueCatClient.ts` imports React Native's `Platform` and cannot run under plain Node/tsx) | `configureRevenueCat()` checks `isStorePurchasesEnabled()` as its first line and returns before any native import or `Purchases.configure` call; this is the single choke point for every purchase flow |

## Running the unit-tested scenarios

```bash
npm run test:v1.1-rewards
```

## Outstanding integration test plan (requires a deployed backend + real Supabase project)

1. Apply `supabase/migrations/0008_v1_1_rewards_economy.sql` to a non-production Supabase branch.
2. Deploy `claim-match-rewards` (and redeploy `submit-match` for the `busts` threading change).
3. Play a real Solo match end-to-end with `EXPO_PUBLIC_ENABLE_V1_1_REWARDS=true`; confirm the Results panel matches the server response exactly.
4. Call `claim-match-rewards` twice for the same `matchId` (e.g. force a retry) and confirm the balance only increases once.
5. Play two Solo matches in the same UTC day; confirm only the first grants the +20 bonus.
6. Force a long real-world pause mid-match; confirm active-time coins reflect only the in-game timer's elapsed time.
7. Complete missions naturally across several matches; confirm progress does not double-count on retried `submit-match` calls (e.g. flaky network resubmission).
8. Claim a daily mission and a daily reward twice each; confirm the second call is a no-op.
