# Version 1.1A Backend Deployment Checklist

Follows the same pattern as [`SUPABASE_DEPLOYMENT_CHECKLIST.md`](./SUPABASE_DEPLOYMENT_CHECKLIST.md). This milestone's changes were written and validated locally only — **no Supabase deployment was performed from this environment.** The only Supabase MCP connection available here (`supabase` / `Undefeated Draft Picks` / `DraftsPicks.com`) points to an unrelated sports/fantasy project (confirmed via `list_tables` and `get_project_url` — tables like `sports_props`, `fantasy_rosters`, `draft_sessions`, `wager_markets` have no relationship to 21 Blaze), so it must not be used for this app's schema.

## Pre-deploy

- [ ] Confirm the target Supabase project is the real 21 Blaze project (check `player_wallets`, `verified_scores`, `player_progression` exist).
- [ ] Back up / snapshot before applying, or apply to a development branch first (`create_branch` / Supabase CLI `db branch`).
- [ ] Review `supabase/migrations/0008_v1_1_rewards_economy.sql` diff against the currently deployed schema — this repo's prior migrations (`0001`–`0007`) may or may not already be applied; verify with `list_migrations` before assuming this is a clean append.

## Migration `0008_v1_1_rewards_economy.sql`

- [ ] Apply the migration. It is written to be safe to re-run (`CREATE OR REPLACE FUNCTION`, `IF NOT EXISTS`, `ON CONFLICT DO UPDATE`).
- [ ] Confirm `daily_reward_for_streak_day(1..7)` returns 20/25/30/40/50/60/100.
- [ ] Confirm `mission_templates` rows `complete_two_solo_matches` (target 3) and `get_three_five_card_clears` (target 2) updated correctly, and `complete_low_bust_match` exists.
- [ ] Confirm `public.match_v1_1_rewards` table exists with RLS enabled and a `select-own` policy.
- [ ] Confirm `calculate_v1_1_match_coins` / `calculate_v1_1_active_time_coins` / `claim_v1_1_match_reward` exist and are `GRANT`ed to `service_role` only (not `PUBLIC`/`anon`, except the two pure calculators which are also granted to `authenticated` for potential client-side preview use — they perform no writes).
- [ ] Run `get_advisors({type: 'security'})` after applying — expect no new RLS gaps introduced by `match_v1_1_rewards`.

## Edge Functions

- [ ] Deploy `claim-match-rewards` (new).
- [ ] Redeploy `submit-match` (busts now threaded into mission progress via `_shared/progression.ts`).
- [ ] Redeploy `daily-reward` and confirm it still resolves via the shared `_shared/progression.ts` calendar (no code changes to the function itself, only the shared calendar values).
- [ ] Smoke-test `claim-match-rewards` directly (e.g. `supabase functions invoke claim-match-rewards --data '{"matchId":"<real-completed-match-id>"}'` with a valid user JWT) against a real completed Solo match and confirm the itemized response shape matches `V1_1MatchRewardResult`.

## Client environment

- [ ] Leave `EXPO_PUBLIC_ENABLE_V1_1_REWARDS=false` in every EAS profile until the above is verified end-to-end.
- [ ] When ready to test, set `EXPO_PUBLIC_ENABLE_V1_1_REWARDS=true` (and optionally `EXPO_PUBLIC_ENABLE_DAILY_REWARDS`/`EXPO_PUBLIC_ENABLE_DAILY_MISSIONS=true`) in the `development` or `preview` profile only — never `testflight`/`production` until the integration test plan in [`V1_1_ECONOMY_TEST_MATRIX.md`](./V1_1_ECONOMY_TEST_MATRIX.md) has passed on a device.

## Post-deploy verification

- [ ] Run through the integration test plan in `V1_1_ECONOMY_TEST_MATRIX.md` §"Outstanding integration test plan."
- [ ] Confirm `get_logs({service: 'edge-function'})` shows no unexpected errors from `claim-match-rewards` or `submit-match` during test play.
- [ ] Confirm no regression in Version 1.0 behavior when `EXPO_PUBLIC_ENABLE_V1_1_REWARDS=false` (the old `claim-match-coins` flow must still run unchanged).
