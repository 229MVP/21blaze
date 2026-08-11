# Version 1.5 RC Handoff — Exit Gate

**From:** `cursor/v1-5-release-freeze-exit-gate-1a6b`  
**Baseline:** `a8ffef0` (`origin/cursor/v1-5-release-freeze-1a6b`)  
**Report date:** 2026-08-10

## Final decision

### `READY WITH DOCUMENTED RISKS — FLAGS REMAIN OFF`

Automated code validation, Expo Doctor, and disposable-preview migration replay with API privilege checks **passed**. Shared **21 Blaze** hosted project (`ioxydgrcgtvrvoxjtupr`) remains at migration `0012`; internal QA build not produced; security advisors not completed on 21 Blaze; full participant gameplay RPC matrix and Realtime isolation require RC QA.

**Two-device RC validation task:** **Do not begin** until human steps below are complete (or explicitly accept preview-only backend for RC).

## Gate status matrix

| Gate | Status |
|------|--------|
| Branch / commit baseline | **Executed — passed** |
| Clean working tree (at test start) | **Executed — passed** |
| Automated unit/self-test suite | **Executed — passed** |
| TypeScript `tsc --noEmit` | **Executed — passed** |
| `npx expo install --check` | **Executed — passed** |
| `npx expo-doctor` | **Executed — passed** (20/20) |
| Local `supabase db reset` replay | **Not executed** (no Docker) |
| Preview branch full migration replay | **Executed — passed** |
| Parent staging migration | **Not executed** (safety — awaiting human) |
| Privilege API verification (anon / auth / service) | **Executed — passed** |
| Privilege SQL file (full) | **Partial** |
| Realtime participant isolation | **Not executed** |
| `db advisors` on 21 Blaze | **Failed** (credentials) |
| `live-pvp-qa` EAS build | **Awaiting human approval** |
| Physical two-device QA | **Outstanding** (next task) |
| Production Live PvP flags | **OFF** (not enabled) |
| Production deploy | **Not executed** |

## Verified versions and flags

| Item | Expected | Actual |
|------|----------|--------|
| App version | `1.5.0` | `1.5.0` |
| iOS buildNumber | `909` | `909` |
| Android versionCode | `902` | `902` |
| `EXPO_PUBLIC_ENABLE_LIVE_PVP` (testflight / production profiles) | OFF | OFF |
| `live_pvp_creation_enabled` server | OFF | OFF (not enabled in this task) |
| `live-pvp-qa` profile `EXPO_PUBLIC_ENABLE_LIVE_PVP` | ON | ON |
| `EXPO_PUBLIC_ADMOB_USE_TEST_ADS` (live-pvp-qa) | true | true |

## QA build profile (`live-pvp-qa`)

Configuration in `eas.json` is **valid** for internal QA:

- Live PvP client flag **ON** only in this profile
- Store purchases **OFF**; test ads **ON**
- Distribution: internal APK (Android) / device build (iOS)

**Backend URL:** Not embedded in `eas.json`. Set EAS environment / secrets for preview QA:

```text
EXPO_PUBLIC_SUPABASE_URL=https://cotjuvmgcsgzuqkaimqa.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable key for cotjuvmgcsgzuqkaimqa>
```

After parent staging is migrated, switch to `https://ioxydgrcgtvrvoxjtupr.supabase.co` and the matching publishable key.

### EAS build commands (awaiting human)

EAS CLI was **not available** in the agent environment (`npm error could not determine executable to run`).

```bash
# iOS internal QA
eas build --profile live-pvp-qa --platform ios

# Android internal QA (APK)
eas build --profile live-pvp-qa --platform android
```

Requires: Expo account login, Apple/Google signing credentials, EAS project linked, Supabase env vars above.

## Commands executed (representative)

```bash
node -v && npm -v && npx supabase --version
npx expo install --check
npx expo-doctor
npx expo config --type public
npm run test:game
npm run test:countdown-layout
npm run test:monetization
npm run test:progression
npm run test:v1.1-rewards
npm run test:v1.1b-locker
npm run test:v1.1c-ads
npm run test:v1.2a-visual-theme
npm run test:daily-challenge
npm run test:v1.3-release
npm run test:async-duel-phase1
npm run test:async-duel-phase2
npm run test:async-duel-phase3
npm run test:async-duel-release
npm run test:live-pvp-phase1
npm run test:live-pvp-phase2
npm run test:live-pvp-phase3
npm run test:live-pvp-release
npm run validate:visual-assets
npx tsc --noEmit
npx supabase branches list
npx supabase link --project-ref cotjuvmgcsgzuqkaimqa
npx supabase migration list --linked
npx supabase db lint --linked
npm run test:live-pvp-privileges   # with SUPABASE_* env
```

## Files changed in exit-gate branch

- `package.json` — `test:live-pvp-privileges` script
- `scripts/livePvpPrivilegeApiVerification.ts` — API privilege runner
- `scripts/livePvpPrivilegeVerification.sql` — SQL privilege queries
- `docs/V1_5_RELEASE_VALIDATION_REPORT.md` — updated
- `docs/V1_5_STAGING_DATABASE_REPORT.md` — new
- `docs/V1_5_PRIVILEGE_VERIFICATION_REPORT.md` — new
- `docs/V1_5_RC_HANDOFF.md` — new

## Remaining human actions

1. **Migrate shared staging** `ioxydgrcgtvrvoxjtupr` (`0013` through `20260810185335`) after review — not done in this task.
2. **Run EAS builds** with `live-pvp-qa` profile and Supabase env pointing at verified backend.
3. **Enable `live_pvp_creation_enabled`** on staging only when starting RC (server flag — not done here).
4. **Provide `SUPABASE_DB_PASSWORD`** to run full SQL privilege file and `db advisors` on 21 Blaze.
5. **Begin two-device RC QA** (separate task) after accepting backend target (preview vs migrated parent).
6. **Resolve `enqueue_player_notification` overload** before relying on async duel notifications post-migration.

## Physical-device QA

**Not performed in this task.** Reconnect, rematch, token refresh, VoiceOver/TalkBack, and opponent disconnect scenarios remain in the RC validation matrix.
