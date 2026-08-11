# Version 1.5 Release Validation Report

**Branch:** `cursor/v1-5-release-freeze-1a6b`  
**Baseline:** `f8833bf` (Phase 3 Live PvP resilience)  
**Report date:** 2026-08-10  
**Agent environment:** Cloud (no Docker)

## Release decision

**READY WITH DOCUMENTED RISKS — FLAGS REMAIN OFF**

Automated closure and native reconciliation are complete. Two-device RC QA, staging privilege verification, and production migration deploy are **not** done in this run. Live PvP client and server creation flags remain OFF.

## Automated tests

| Command | Result |
|---------|--------|
| `npm run test:game` | PASS (exit 0) |
| `npm run test:countdown-layout` | PASS (exit 0) |
| `npm run test:monetization` | PASS |
| `npm run test:progression` | PASS (exit 0) |
| `npm run test:v1.1-rewards` | PASS |
| `npm run test:v1.1b-locker` | PASS |
| `npm run test:v1.1c-ads` | PASS |
| `npm run test:v1.2a-visual-theme` | PASS |
| `npm run test:daily-challenge` | PASS |
| `npm run test:v1.3-release` | PASS (exit 0) |
| `npm run test:async-duel-phase1` | PASS (exit 0) |
| `npm run test:async-duel-phase2` | PASS |
| `npm run test:async-duel-phase3` | PASS |
| `npm run test:async-duel-release` | PASS (version assertions updated to 1.5.0) |
| `npm run test:live-pvp-phase1` | PASS |
| `npm run test:live-pvp-phase2` | PASS |
| `npm run test:live-pvp-phase3` | PASS |
| `npm run test:live-pvp-release` | PASS |
| `npm run validate:visual-assets` | PASS |
| `npx tsc --noEmit` | PASS |
| `npx expo-doctor` | **1 check failed** — 7 Expo SDK patch version mismatches (pre-existing; not upgraded per non-goals) |
| `npx expo config --type public` | PASS — version 1.5.0, kotlin plugin present |
| `git diff --check` | PASS |

### Unperformed automated

| Check | Reason |
|-------|--------|
| `npm run test:v1.2-startup-hotfix` | Script not present on branch |
| Daily challenge phase2–4 individual scripts | Not in required matrix run (foundation + v1.3-release passed) |

## Database checks

| Check | Result |
|-------|--------|
| `supabase db reset` (full replay) | **UNPERFORMED** — Docker not available |
| Migration list vs remote | **UNPERFORMED** — no linked staging project in agent |
| `has_function_privilege` live queries | **UNPERFORMED** — requires replayed DB |
| Advisors / lint | **UNPERFORMED** — requires local stack |
| Rematch/record RPC staging tests | **UNPERFORMED** — requires authenticated DB |

Migration `20260810185335_v1_5_live_pvp_privilege_closure.sql` includes inline `has_function_privilege` assertions for replay-time verification.

## Manual / staging gates (all outstanding)

- Two-device full match (iOS + Android)
- Force-close recovery on device
- Reconnect: countdown, active play, foreground
- Token refresh during match
- Simultaneous rematch
- Account switch
- Stale push / deep links
- Opponent disconnect settlement
- VoiceOver / TalkBack / large text
- Service-role finalizer on staging cron
- Staging privilege verification as `anon` / `authenticated`

## Dependency / secret audit

- `@supabase/supabase-js` pinned to **2.109.0** (exact) in `package.json` / lockfile
- Grep: no service-role key in `src/lib/supabase.ts` (release self-test)
- Checkpoint excluded from analytics paths; diagnostics use truncated match id only

## Known risks

1. Full remaining deck stored in checkpoint (no seed persistence).
2. Reconnect coordinator not exercised on physical device in this run.
3. Expo SDK patch drift (expo-doctor).
4. Async Duel release test version check updated to 1.5.0 (coupled marketing version).

## Next steps for RC QA

1. Build `live-pvp-qa` EAS profile (not started automatically).
2. Apply migrations on staging; run privilege SQL from deployment checklist.
3. Complete manual matrix; then consider enabling flags for internal RC only.
