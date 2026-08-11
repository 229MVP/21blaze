# Version 1.5 Release Validation Report

**Branch:** `cursor/v1-5-release-freeze-exit-gate-1a6b`  
**Baseline:** `a8ffef0` (`origin/cursor/v1-5-release-freeze-1a6b`)  
**Report date:** 2026-08-10  
**Agent environment:** Cloud (no Docker)

## Release decision (exit gate)

**READY WITH DOCUMENTED RISKS — FLAGS REMAIN OFF**

See `docs/V1_5_RC_HANDOFF.md` for handoff detail. Automated validation and disposable-preview migration replay passed. Shared hosted **21 Blaze** project not migrated; EAS QA build not produced; full Realtime/participant gameplay matrix deferred to RC QA.

**Two-device RC validation:** **May not begin** until human migrates staging or explicitly accepts preview backend `cotjuvmgcsgzuqkaimqa` and produces `live-pvp-qa` builds.

## Phase 1 — Baseline verification

| Check | Result |
|-------|--------|
| Branch | `cursor/v1-5-release-freeze-exit-gate-1a6b` |
| Commit | `a8ffef0` — matches expected release-freeze baseline |
| Working tree at test start | Clean (only exit-gate additions) |
| Node | v22.14.0 |
| npm | 10.8.2 |
| Supabase CLI | 2.113.0 |
| `@supabase/supabase-js` | 2.109.0 (exact pin in `package.json`) |
| App version | 1.5.0 |
| iOS buildNumber | 909 |
| Android versionCode | 902 |
| `EXPO_PUBLIC_ENABLE_LIVE_PVP` (default / store profiles) | OFF |
| `live_pvp_creation_enabled` server | OFF |
| Production deployment | Not configured by this task |

## Automated tests

| Command | Result |
|---------|--------|
| `npm run test:game` | PASS |
| `npm run test:countdown-layout` | PASS |
| `npm run test:monetization` | PASS |
| `npm run test:progression` | PASS |
| `npm run test:v1.1-rewards` | PASS |
| `npm run test:v1.1b-locker` | PASS |
| `npm run test:v1.1c-ads` | PASS |
| `npm run test:v1.2a-visual-theme` | PASS |
| `npm run test:daily-challenge` | PASS |
| `npm run test:v1.3-release` | PASS |
| `npm run test:async-duel-phase1` | PASS |
| `npm run test:async-duel-phase2` | PASS |
| `npm run test:async-duel-phase3` | PASS |
| `npm run test:async-duel-release` | PASS |
| `npm run test:live-pvp-phase1` | PASS |
| `npm run test:live-pvp-phase2` | PASS |
| `npm run test:live-pvp-phase3` | PASS |
| `npm run test:live-pvp-release` | PASS |
| `npm run validate:visual-assets` | PASS |
| `npm run test:live-pvp-privileges` | PASS (preview branch API) |
| `npx tsc --noEmit` | PASS |
| `npx expo install --check` | PASS — dependencies up to date |
| `npx expo-doctor` | PASS — 20/20 |
| `npx expo config --type public` | PASS — version 1.5.0, build 909 / 902 |
| `git diff --check` | PASS |

## Phase 2 — Expo dependency health

| Check | Result |
|-------|--------|
| `npx expo install --check` | PASS |
| `npx expo-doctor` | PASS (20/20) |
| Expo SDK major upgrade | Not performed (non-goal) |
| Patch alignment via `expo install --fix` | Not required — doctor clean |

## Phase 3 — Migration replay

| Check | Result |
|-------|--------|
| Docker / local `db reset` | **Not executed** — Docker unavailable |
| Preview branch `v15-exit-gate` (`cotjuvmgcsgzuqkaimqa`) | **Executed — passed** — full chain through `20260810185335` |
| Parent `ioxydgrcgtvrvoxjtupr` | **Not migrated** — remote at `0012`; pending `0013`–`20260810185335` |

Detail: `docs/V1_5_STAGING_DATABASE_REPORT.md`

## Phase 4 — Privilege verification

| Role | Result |
|------|--------|
| `anon` | PASS (API) |
| `authenticated` | PASS (API — allowlist + deny service ops + direct table) |
| `service_role` | PASS (API — finalizer + reconcile) |
| Realtime private channels | **Not executed** |

Detail: `docs/V1_5_PRIVILEGE_VERIFICATION_REPORT.md`

## Phase 5 — Database security

| Check | Result |
|-------|--------|
| `npx supabase db lint --linked` (preview) | **Executed** — errors documented (see privilege report) |
| `npx supabase db advisors --linked` | **Failed** — DB password for CLI postgres role |
| MCP advisors | Wrong Supabase project — not used for 21 Blaze decision |

## Phase 6 — QA build readiness

| Check | Result |
|-------|--------|
| `live-pvp-qa` profile flags | Valid — Live PvP ON, test ads ON, store OFF |
| Native versions | Correct |
| Secrets in repo | None committed |
| Supabase backend in EAS | **Awaiting human** — set preview or staging URL in EAS env |
| EAS build produced | **Awaiting human** — EAS CLI not available in agent env |

## Manual / RC gates (outstanding)

- Two-device full match (iOS + Android)
- Force-close recovery, reconnect, token refresh, rematch
- Realtime participant isolation on device
- Service-role finalizer on staging cron
- Parent staging migration

## Related documents

- `docs/V1_5_STAGING_DATABASE_REPORT.md`
- `docs/V1_5_PRIVILEGE_VERIFICATION_REPORT.md`
- `docs/V1_5_RC_HANDOFF.md`
- `docs/V1_5_SUPABASE_DEPLOYMENT_CHECKLIST.md`
