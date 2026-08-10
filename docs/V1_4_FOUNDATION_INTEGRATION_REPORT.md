# v1.4 Foundation Integration Report (Phase 1.5)

**Date:** 2026-08-10  
**Integration branch:** `integration/v1.4-async-duel-foundation`  
**Base:** `origin/main` @ `ba3cb0a`  
**Integration head (pre-security commit):** `49ed345`  
**Scope:** Branch integration, Async Duel security hardening, baseline validation. No Phase 2 Async Duel UI. No Live PvP.

---

## 1. Starting repository state (re-verified)

| Check | Result |
|-------|--------|
| `origin/main` | `ba3cb0a` — fix case-colliding component directories (#27) |
| Audit claim `4f913f1` on main | **Stale** — main advanced past v1.3 Phase 1 |
| `origin/cursor/1-4-phase1-async-duel-foundation-1a6b` head | `213474e` (includes Phase 2 playable — **not merged wholesale**) |
| Tree `4f913f1` vs `df1a80c` | Identical trees (`git diff` empty at audit) |
| Duplicate Phase 1 on main | `4f913f1` is ancestor of `ba3cb0a`; cherry-picks skipped `df1a80c` equivalent |
| Working tree at start | Clean on `integration/v1.4-async-duel-foundation` |
| Package version | `1.3.0` (unchanged — not claiming v1.4 release) |

---

## 2. Integration approach

Created `integration/v1.4-async-duel-foundation` from `origin/main` (`ba3cb0a`).

**Did not** merge `origin/cursor/1-4-phase1-async-duel-foundation-1a6b` blindly — that branch contains Async Duel Phase 2 playable work beyond this gate.

**Cherry-picked** eight ordered commits after the tree-equivalent Phase 1 foundation (skipped duplicate `df1a80c`):

| Order | Commit | Summary |
|-------|--------|---------|
| 1 | `78e1c89` | Remove invalid `ALTER` on `realtime.messages` in `0002` |
| 2 | `0a205d5` | Remove unused `update` dependency |
| 3 | `fbfa4ce` | Daily Challenge live-backend verification |
| 4 | `25c34a4` | Daily Challenge Phase 2 playable UI |
| 5 | `893a656` | Leaderboards, streaks, secure rewards |
| 6 | `f2d2ef8` | XP, levels, missions, progression |
| 7 | `0e4282d` | v1.3 release freeze, account-switch isolation |
| 8 | `49ed345` | Async Duel Phase 1 foundation |

**Conflicts:** None during cherry-picks.

**Security hardening (this gate):** Forward migration `0016_v1_4_async_duel_security_hardening.sql` plus client validators (not yet on remote until push).

---

## 3. Migrations present (forward order)

| File | Purpose |
|------|---------|
| `0011_v1_3a_daily_challenge.sql` | Daily Challenge tables |
| `0012_v1_3_phase1_daily_challenge_rpc.sql` | Daily Challenge RPCs |
| `0013_v1_3_phase3_leaderboards_streaks_rewards.sql` | Leaderboards, streaks, rewards |
| `0014_v1_3_phase4_progression.sql` | Progression, missions |
| `0015_v1_4_phase1_async_duel_foundation.sql` | Async Duel Phase 1 |
| `0016_v1_4_async_duel_security_hardening.sql` | **New** — expiration hardening, create recovery, details `participantRole`, table revokes |

- No duplicate migration numbers
- Fresh-install: apply `0001`–`0016` in order
- Upgrade from current main: apply `0011`–`0016` (main already has `0001`–`0010` and `4f913f1` daily challenge Phase 1 content)

**Production / shared remote:** Not applied in this task.

---

## 4. Expiration vulnerability fix

### Finding (0015)

`expire_async_duels(p_now timestamptz default now())` was granted to `authenticated`. An authenticated client could pass a future `p_now` and expire active duels prematurely.

### Fix (0016)

1. `effective_now := LEAST(COALESCE(p_now, now()), now())` — clamps even if internal caller passes future time.
2. `REVOKE ALL` from `PUBLIC`, `anon`, `authenticated`.
3. `GRANT EXECUTE` to `service_role` only.
4. Internal SECURITY DEFINER RPCs (`create_async_duel`, inbox, start) call `expire_async_duels(now())` as function owner — still works.

### Regression test

Static assertion in `src/asyncDuel/asyncDuelIntegrationSelfTest.ts`:

- Documents 0015 originally granted expire to authenticated
- Verifies 0016 revokes client access and grants service_role only
- Verifies LEAST clamp present

**Live RPC attack test:** Pending — requires linked nonproduction Supabase with migrations applied.

---

## 5. Create-timeout recovery

`create_async_duel` (0016) returns existing active duel for same challenger + opponent before inserting:

- Response includes `resumedExisting: true`, seed, attempt id (challenger resume after lost response / double tap)
- Does not return unrelated completed duels or different opponents
- Documented in `src/asyncDuel/asyncDuelResumePolicy.ts`

Client: `parseAsyncDuelStart` validates `resumedExisting`; `asyncDuelService.createAsyncDuel` uses strict parsers.

---

## 6. Client response validation

Added `src/asyncDuel/asyncDuelProtocol.ts` — runtime validators for:

- Start, completion, inbox, history, details
- Public participant, attempt result, status, outcome, deciding field
- Rejects seed in inbox/history/details payloads
- Rejects malformed ids and `"undefined"` string coercion

`src/services/asyncDuelService.ts` — all RPC responses parsed through validators; `getAsyncDuelDetails` returns typed `AsyncDuelDetails`.

`AsyncDuelServiceError` centralized in `src/asyncDuel/asyncDuelServiceError.ts`.

---

## 7. Seed disclosure audit

| Path | Seed in SQL JSON | Client validator |
|------|------------------|------------------|
| `create_async_duel` | Yes (challenger) | Required on start parse |
| `start_async_duel_opponent_attempt` | Yes (opponent) | Required on start parse |
| `get_async_duel_inbox` | Omitted | Rejects if present |
| `get_async_duel_history` | Omitted | Rejects if present |
| `get_async_duel_details` | Omitted (comment in SQL) | Rejects if present |
| `get_async_duel_result` | Omitted | N/A |

Unrelated users: `NOT_PARTICIPANT` — no duel data. Error messages use stable codes, not seed values.

---

## 8. SECURITY DEFINER audit (0013, 0014, 0015 + 0016 changes)

### 0013 — Leaderboards / streaks / rewards

| Function | Why DEFINER | search_path | Client grant | Notes |
|----------|-------------|-------------|--------------|-------|
| `apply_daily_challenge_streak` | Cross-user streak writes | `public` | service/internal | REVOKE PUBLIC |
| `get_daily_leaderboard` | Aggregated reads | `public` | authenticated | Read-only |
| `get_my_daily_leaderboard_position` | User-scoped read | `public` | authenticated | auth.uid() |
| `get_weekly_leaderboard` | Aggregated reads | `public` | authenticated | Read-only |
| `get_my_weekly_leaderboard_position` | User-scoped read | `public` | authenticated | auth.uid() |
| `claim_daily_streak_reward` | Reward grant | `public` | authenticated | Idempotent claim |
| `get_daily_streak_status` | User state | `public` | authenticated | auth.uid() |

### 0014 — Progression

| Function | Why DEFINER | Client grant | Notes |
|----------|-------------|--------------|-------|
| `get_level_from_lifetime_xp` | Pure helper | authenticated + service_role | No writes |
| `get_progress_to_next_level` | Pure helper | authenticated + service_role | No writes |
| `apply_mission_progress_from_match` | Mission updates | service_role only | REVOKE PUBLIC |
| `grant_daily_streak_milestone_xp` | XP grant | service_role only | REVOKE PUBLIC |
| `get_player_progression` | User read | authenticated | auth.uid() |
| `claim_daily_mission_reward` | Reward claim | authenticated | Idempotent |

### 0015 — Async Duel (hardened by 0016 where noted)

| Function | Why DEFINER | Client grant | 0016 change |
|----------|-------------|--------------|-------------|
| `async_duel_config` | Read app config | service_role | — |
| `compare_async_duel_results` | Settlement logic | service_role | — |
| `expire_async_duels` | Bulk status update | **was authenticated** | **service_role only + clamp** |
| `create_async_duel` | Create + attempt | authenticated | **resume existing active duel** |
| `complete_async_duel_attempt` | Validate + settle | authenticated | — |
| `start_async_duel_opponent_attempt` | Opponent start | authenticated | — |
| `decline_async_duel` / `cancel_async_duel` | State transitions | authenticated | — |
| `get_async_duel_inbox/history/details/result` | Participant reads | authenticated | details adds `participantRole` |

**RLS:** `async_duels` / `async_duel_attempts` — RLS enabled; 0015 + 0016 REVOKE ALL on tables for anon/authenticated.

**Accepted limitation:** `SET search_path = public` (not empty) on Async Duel functions — objects fully qualified within `public`. Future hardening may move to `search_path = ''` with full qualification.

---

## 9. Legacy Live Duel (preserved, disabled)

Not deleted or enabled:

- `src/live/`
- `src/store/useLiveMatchStore.ts`
- `src/services/liveMatchService.ts`
- `supabase/migrations/0002_live_duels.sql`

Feature flags (`src/config/featureFlags.ts`):

- `EXPO_PUBLIC_ENABLE_ASYNC_DUEL` — default **false**
- `EXPO_PUBLIC_ENABLE_LIVE_DUEL` — default **false**
- `EXPO_PUBLIC_ENABLE_QUICK_MATCH` — default **false**
- `EXPO_PUBLIC_ENABLE_RANKED_BETA` — default **false**

Live PvP modernization is a later milestone.

---

## 10. Progression / economy regression (static)

Async Duel Phase 1 grants zero XP, zero Blaze Coins, zero public win/loss updates (verified in 0015 settlement path and Phase 1 self-tests).

Integrated v1.3 progression/rewards remain server-authoritative; no new client-controlled economy paths introduced by this integration.

---

## 11. Tests run and results

| Command | Result |
|---------|--------|
| `npx tsc --noEmit` | **PASS** |
| `npm run test:game` | **PASS** (no output — success) |
| `npm run test:progression` | **PASS** |
| `npm run test:daily-challenge` | **PASS** |
| `npm run test:daily-challenge-deck` | **PASS** |
| `npm run test:daily-challenge-attempts` | **PASS** |
| `npm run test:daily-challenge-phase2` | **PASS** |
| `npm run test:daily-challenge-phase3` | **PASS** |
| `npm run test:daily-challenge-phase4` | **PASS** |
| `npm run test:v1.3-release` | **PASS** |
| `npm run test:async-duel-phase1` | **PASS** |
| `npm run test:async-duel-integration` | **PASS** (after report + test fix) |
| `npm run test:ranked` | **PASS** |
| `npm run test:monetization` | **PASS** |
| `npm run test:v1.1-rewards` | **PASS** |
| `npm run test:v1.1b-locker` | **PASS** |
| `npm run test:v1.1c-ads` | **PASS** |
| `npm run test:v1.2a-visual-theme` | **PASS** |
| `npm run test:countdown-layout` | **PASS** |
| `npm run validate:visual-assets` | **PASS** (15 manifest, 14 themes) |

### Not run

| Check | Reason |
|-------|--------|
| `npx expo-doctor` | 1 check failed — 7 Expo packages patch behind (pre-existing) |
| iOS / Android / Web export | Not run — time; no native toolchain smoke in gate |
| `npm run test:daily-challenge-live` | Requires linked Supabase credentials |
| Supabase CLI migration validation | `supabase` CLI not installed in environment |
| Database integration / RLS live tests | No safe linked nonproduction project verified |
| Supabase database advisors | Pending migration apply on dev project |

---

## 12. Remote deployment status

- **No production deployment**
- **No migrations applied** to shared remote in this task
- Operator steps for dev validation:
  1. Confirm project identity (nonproduction only)
  2. `supabase db push` or apply `0011`–`0016` on staging
  3. Verify `authenticated` cannot execute `expire_async_duels`
  4. Run live expire-attack test with authenticated JWT + future timestamp
  5. Run `supabase db lint` / advisors

---

## 13. Manual QA remaining

- Async Duel diagnostics screen against staging RPCs
- Create timeout / double-tap on real network
- Account switch clears async duel local state
- Daily Challenge + progression flows on integrated branch build
- Confirm Async Duel entry hidden when flag off

---

## 14. Recommended merge decision

**READY TO MERGE WITH DOCUMENTED RISKS**

**Rationale:**

- All eight intended development commits integrated without conflict
- Duplicate Phase 1 tree not integrated twice
- Migration order valid through `0016`
- Expiration exploit addressed in forward migration
- Client parsing hardened; create recovery implemented
- Full static test suite passes
- Feature flags remain off by default

**Risks / blockers before production:**

1. Live database verification of expiration revoke and attack regression
2. Supabase advisors after `0016` apply
3. Async Duel Phase 2 UI not included — product remains diagnostics-only
4. `search_path = public` on DEFINER functions — acceptable for Phase 1 but not ideal
5. No full server replay anti-cheat (documented Phase 1 limitation)

**Do not merge to `main` automatically from this report.** Open PR from `integration/v1.4-async-duel-foundation` for human review.

---

## 15. Files changed by security hardening (this gate)

| File | Change |
|------|--------|
| `supabase/migrations/0016_v1_4_async_duel_security_hardening.sql` | New forward migration |
| `src/asyncDuel/asyncDuelProtocol.ts` | Strict RPC validators |
| `src/asyncDuel/asyncDuelServiceError.ts` | Shared error type |
| `src/asyncDuel/asyncDuelTypes.ts` | `AsyncDuelDetails`, `resumedExisting` |
| `src/asyncDuel/asyncDuelResumePolicy.ts` | Create recovery documentation |
| `src/asyncDuel/asyncDuelIntegrationSelfTest.ts` | Integration gate tests |
| `src/services/asyncDuelService.ts` | Validators, typed details |
| `package.json` | `test:async-duel-integration` script |
| `docs/ASYNC_DUEL_SECURITY_MODEL.md` | Updated |
| `docs/ASYNC_DUEL_OPERATIONS.md` | Updated |
| `docs/V1_4_FOUNDATION_INTEGRATION_REPORT.md` | This report |
