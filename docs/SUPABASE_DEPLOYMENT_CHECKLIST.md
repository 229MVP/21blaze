# Supabase Deployment Checklist — 21 Blaze RC 0.9.0

**Audit status:** Migrations `0001`–`0007` and all edge functions exist **locally**.  
**Remote deployment: unverified.** Do not mark production ready until every row below is checked with evidence (project ref, CLI output, or dashboard screenshot).

Target project: _________________ (fill at deploy time)  
Deployed by: _________________  
Date: _________________

---

## Pre-flight

- [ ] Confirm target project URL matches `EXPO_PUBLIC_SUPABASE_URL`
- [ ] Confirm anonymous auth enabled (guest sessions)
- [ ] Confirm service role key available to deployer only (not client)
- [ ] Confirm `REVENUECAT_WEBHOOK_AUTHORIZATION` secret set before webhook deploy
- [ ] Backup / snapshot plan acknowledged ([DATABASE_ROLLBACK_PLAN.md](./DATABASE_ROLLBACK_PLAN.md))

---

## Migrations (apply in order)

| # | File | Purpose | Applied remote? | Verified? |
|---|------|---------|-----------------|-----------|
| 0001 | `0001_online_leaderboard.sql` | Profiles, online matches, leaderboard | [ ] Unverified | [ ] |
| 0002 | `0002_live_duels.sql` | Live duel private rooms / match tables | [ ] Unverified | [ ] |
| 0003 | `0003_quick_match.sql` | Casual Quick Match extensions + history | [ ] Unverified | [ ] |
| 0004 | `0004_ranked_beta.sql` | Ranked modes, ratings, ranked history | [ ] Unverified | [ ] |
| 0005 | `0005_monetization_beta.sql` | Wallets, entitlements, cosmetics, ad claims, RLS, coin RPCs | [ ] Unverified | [ ] |
| 0006 | `0006_progression_beta.sql` | XP/levels, daily rewards, daily missions | [ ] Unverified | [ ] |
| 0007 | `0007_rc_solo_coin_verified.sql` | Solo coins from `verified_scores` (ignore client score); Founders grant → neon (not volcano) | [ ] Present locally; remote pending | [ ] |

### Post-migration verification (SQL)

- [ ] `player_wallets` / `player_entitlements` / progression tables exist
- [ ] RLS enabled on wallet, entitlements, cosmetics, wallet_transactions, ad_reward_claims
- [ ] Authenticated role has **SELECT** only on wallet/XP-sensitive tables (no client INSERT/UPDATE/DELETE)
- [ ] `claim_solo_match_coins` / wallet mutate RPCs executable by `service_role` only
- [ ] After 0007: claim path uses server-verified score (client inflated score ignored/rejected)
- [ ] After 0007: `grant_founders_bundle_benefits` grants `founders_pack` + `ad_free` + `inferno_pack` + `neon_pack` (not volcano)

---

## Edge functions (deploy each)

Deployment status: **local only / unverified remote**.

| Function | Role | Secrets needed | Deployed? | Smoke tested? |
|----------|------|----------------|-----------|---------------|
| `start-match` | Start online solo match | service role | [ ] Unverified | [ ] |
| `submit-match` | Submit solo match result | service role | [ ] Unverified | [ ] |
| `create-live-room` | Create Live Duel room | service role | [ ] Unverified | [ ] |
| `join-live-room` | Join Live Duel room | service role | [ ] Unverified | [ ] |
| `set-live-ready` | Ready state | service role | [ ] Unverified | [ ] |
| `get-live-match-state` | Poll/fetch live state | service role | [ ] Unverified | [ ] |
| `submit-live-result` | Submit live result | service role | [ ] Unverified | [ ] |
| `leave-live-match` | Leave live match | service role | [ ] Unverified | [ ] |
| `quick-match` | Casual matchmaking | service role | [ ] Unverified | [ ] |
| `ranked-match` | Ranked matchmaking | service role | [ ] Unverified | [ ] |
| `claim-match-coins` | Solo coin claim | service role | [ ] Unverified | [ ] |
| `claim-ad-reward` | Rewarded ad coin double / claims | service role | [ ] Unverified | [ ] |
| `purchase-cosmetic` | Coin cosmetic purchase | service role | [ ] Unverified | [ ] |
| `equip-cosmetic` | Equip cosmetic | service role | [ ] Unverified | [ ] |
| `sync-entitlements` | Client entitlement sync | service role | [ ] Unverified | [ ] |
| `revenuecat-webhook` | Store purchase webhook | service role + `REVENUECAT_WEBHOOK_AUTHORIZATION` | [ ] Unverified | [ ] |
| `daily-reward` | Daily reward claim | service role | [ ] Unverified | [ ] |
| `daily-missions` | Daily missions progress/claim | service role | [ ] Unverified | [ ] |

Shared module `_shared/` is bundled with functions — not deployed as its own endpoint.

### Webhook wiring

- [ ] RevenueCat dashboard webhook URL points to deployed `revenuecat-webhook`
- [ ] Authorization header matches Supabase secret
- [ ] Product/entitlement IDs match client remap (`blaze_*` / pack keys)
- [ ] Test event received (sandbox) — **not performed**

---

## Client cutover

- [ ] App points at deployed project (env)
- [ ] Anonymous sign-in succeeds on device
- [ ] Wallet SELECT works; direct client wallet UPDATE fails (RLS check)
- [ ] Edge invoke paths return non-404
- [ ] Migration 0007 behavior confirmed on remote (inflated score ignored)

---

## Explicit non-claims

- This checklist does **not** claim remote deployment success.
- This checklist does **not** claim sandbox purchase success.
- Local presence of SQL/TS files (including `0007`) is necessary but not sufficient for RC sign-off.
