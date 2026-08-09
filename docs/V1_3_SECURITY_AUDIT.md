# Version 1.3 Security Audit

Last updated: release-freeze branch `cursor/v1-3-release-freeze-1a6b`  
Scope: Solo, Daily Challenge, leaderboards, streaks, XP/levels, daily missions, Blaze Coin rewards.

This document does **not** claim the client is cheat-proof. It describes trust boundaries, protections, and accepted risks.

---

## 1. Authoritative trust boundaries

| Domain | Authoritative layer | Client role |
|--------|---------------------|-------------|
| Daily challenge deck/seed | Supabase RPC `start_daily_challenge` | Never trusts client-supplied seeds |
| Ranked attempt lifecycle | `start_daily_challenge`, `complete_daily_challenge` | Submits verified counters only |
| Leaderboard ranks | SQL views + RPCs (`get_daily_leaderboard`, etc.) | Read-only display |
| Streak state | `apply_daily_challenge_streak` (service_role path via RPC) | Display only |
| Blaze Coin balance | `player_wallets` + `apply_wallet_delta` | Hydrates from server; no direct writes |
| XP / level | `grant_player_xp` via edge functions / RPCs | Display only; no INSERT/UPDATE |
| Mission definitions | `mission_templates` + `assign_daily_missions_secure` | Read templates; cannot invent rewards |
| Mission progress | `apply_mission_progress_from_match`, completion RPCs | End-of-game summaries only |
| Mission claims | `claim_daily_mission_secure` / `claim_daily_mission_reward` | Submits mission progress id only |
| Cosmetic ownership | `unlock_cosmetic` + entitlement tables | Equip via allowed RPCs |

---

## 2. Protected database operations

Writes to competitive and economy tables occur only through **SECURITY DEFINER** functions executed with service role (edge functions) or tightly scoped authenticated RPCs that validate `auth.uid()`.

Key functions:

- `complete_daily_challenge` — ranked completion, streak, XP, mission progress
- `grant_player_xp` — idempotent XP ledger
- `apply_wallet_delta` — idempotent coin ledger
- `claim_daily_mission_secure` / `claim_daily_mission_reward`
- `claim_daily_streak_reward`
- `apply_mission_progress_from_match` — service_role only
- `start_daily_challenge` — creates/resumes ranked attempts server-side

Migration `0012` **removed** client INSERT/UPDATE policies on `daily_challenge_attempts`. Attempt rows are server-controlled.

Migration `0013` **removed** client INSERT/UPDATE on `daily_challenge_streaks`.

---

## 3. Reward idempotency strategy (Blaze Coins)

- Ledger: `wallet_transactions` / `apply_wallet_delta`
- Unique keys per grant (e.g. `daily_mission_coins:{idempotency_key}`, `level_reward_coins:…`)
- `reward_grants` for streak milestones with `ON CONFLICT DO NOTHING` on `(user_id, source_type, source_id, reward_key)`
- Client wallet store updates balance only from server RPC responses or `fetchWallet`

**Search result:** No client `UPDATE` on `player_wallets` or direct balance mutation without server response.

---

## 4. XP idempotency strategy

- Ledger: `progression_transactions` with `UNIQUE (idempotency_key)`
- `grant_player_xp` returns `already_processed` on duplicate keys
- Examples:
  - Solo: `progression:solo:{matchId}`
  - Daily challenge: `daily_challenge_xp:{attemptId}`
  - Mission: `daily_mission_xp:{claim_idempotency_key}`

Client cannot call `grant_player_xp` directly (service_role only).

---

## 5. Mission progress validation

- Progress increments only in `apply_mission_progress_from_match` (service_role) and `complete_daily_challenge`
- Deduped by `mission_progress_events (player_mission_id, match_id)`
- Practice mode rejected at SQL layer (`daily_challenge_practice` → `practice_not_counted`)
- Targets and rewards copied from `mission_templates` at assignment time
- Client cannot set `progress`, `completed_at`, or reward amounts

---

## 6. Known client-trust limitations (accepted v1.3)

| Limitation | Risk | Mitigation / deferral |
|------------|------|------------------------|
| Solo gameplay runs locally | Score tampering before `submit-match` | Server replays move log; unverified submissions rejected |
| Optimistic UI during claims | Brief incorrect “claimed” display | Server is source of truth; re-hydrate on error |
| `markV1_1RewardLocal` | Local-only reward display flag | Does not grant coins; server RPC required for wallet |
| Guest / local auth | No persistent competitive progression | Sign-in required for missions/XP persistence |
| Device clock | Wrong countdown display | Eligibility uses server UTC in RPCs |
| No full anti-cheat replay for Daily Challenge client-only path | Fabricated completion counters | RPC validates attempt ownership, date, rules version; plausibility checks on time |

---

## 7. RLS coverage summary

| Table | SELECT | INSERT/UPDATE (authenticated) |
|-------|--------|-------------------------------|
| `daily_challenges` | authenticated | none |
| `daily_challenge_attempts` | own rows | **revoked** (0012) |
| `daily_challenge_streaks` | own rows | **revoked** (0013) |
| `reward_grants` | own rows | none |
| `player_progression` | own rows | none |
| `progression_transactions` | own rows | none |
| `player_daily_missions` | own rows | none |
| `mission_progress_events` | own rows | none |
| `profiles` | authenticated | own display_name only |
| `player_wallets` | own (via service patterns) | none direct |
| `progression_unlock_types` | authenticated read | none (future hooks disabled) |

Public leaderboard views expose: display name, score, rank metadata, equipped frame id — not email or wallet.

---

## 8. Security-definer hygiene

- Functions use `SET search_path = public`
- User-facing RPCs check `auth.uid()` and raise `not_authenticated` when missing
- Service-role credentials are **not** present in the mobile bundle (grep: no `service_role` keys in `src/`)

---

## 9. Fixed risks (this release freeze)

| Issue | Fix |
|-------|-----|
| Stale progression/wallet after account switch | `resetUserScopedStores()` on sign-out and user id change |
| Dev diagnostics in production builds | Daily Challenge diagnostics gated behind `__DEV__` in Settings |

---

## 10. Accepted v1.3 risks (documented, not blocking)

- Solo offline play cannot grant server XP until sync
- Manual device QA not executed in CI (documented in test matrix)
- `expo-build-properties` patch version drift (expo-doctor advisory)
- Deferred Sabotage / PvP / purchase surfaces remain flag-disabled

---

## 11. Deferred to later versions

- Full Daily Challenge move-log server replay (if not already enforced for all paths)
- Async Duel / Live PvP anti-cheat
- Sabotage inventory grants
- RevenueCat / store purchase validation
- Automated RLS integration tests against live Supabase (live verification script exists for daily challenge)

---

## 12. Production configuration requirements

- Apply migrations `0011`–`0014` on production Supabase
- Deploy edge functions: `submit-match`, `daily-missions`, `daily-reward`
- `EXPO_PUBLIC_SUPABASE_URL` + anon key only (never service role)
- `EXPO_PUBLIC_ENABLE_V1_3_PROGRESSION` and Daily Challenge flags per release plan
- Store purchases remain disabled (`EXPO_PUBLIC_ENABLE_STORE_PURCHASES` off)
