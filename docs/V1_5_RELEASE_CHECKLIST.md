# Version 1.5 Release Checklist — Live PvP

Use before internal RC QA or production cut. Check items only when verified.

## Backend

- [ ] Migrations applied in order through `20260810185335_v1_5_live_pvp_privilege_closure.sql`
- [ ] Fresh-install migration replay on empty local database
- [ ] Upgrade path from v1.4 (`0018`) verified
- [ ] Privilege closure: internal `SECURITY DEFINER` helpers not executable by `authenticated` / `anon`
- [ ] Client RPC allowlist matches `V1_5_SECURITY_AUDIT.md`
- [ ] `enqueue_player_notification` overloads service_role only
- [ ] `finalize_live_pvp_deadlines` service_role only
- [ ] Realtime policies: participant broadcast read, presence read/write; no client broadcast insert
- [ ] `live_pvp_creation_enabled` server kill switch OFF in production until RC sign-off
- [ ] Service-role key absent from mobile bundle

## Client

- [ ] Marketing version `1.5.0` (`package.json`, `app.json`)
- [ ] iOS `buildNumber` `909` (confirm App Store Connect if higher required)
- [ ] Android `versionCode` `902` (confirm Play Console)
- [ ] `extra.rcVersion` `1.5.0`
- [ ] `EXPO_PUBLIC_ENABLE_LIVE_PVP=false` on testflight / production profiles
- [ ] `live-pvp-qa` profile for internal two-device QA only
- [ ] Kotlin 2.3.0 plugin present (`withAndroidKotlinGradle.js`)
- [ ] No duplicate SKAdNetwork / Android permissions
- [ ] Checkpoint schema v2 — no persisted seed

## Automated checks

Record exact results in `V1_5_RELEASE_VALIDATION_REPORT.md`.

- [ ] `npx tsc --noEmit`
- [ ] `npm run test:live-pvp-release`
- [ ] All Phase 1–3 Live PvP tests
- [ ] Full regression matrix (see validation report)
- [ ] `npx expo-doctor`
- [ ] `npx expo config --type public`
- [ ] `git diff --check`

## Manual / device (required before production flags)

- [ ] Two authenticated devices — full match
- [ ] Force-close recovery
- [ ] Reconnect during countdown and active play
- [ ] Token refresh during match
- [ ] Simultaneous rematch
- [ ] Account switch clears checkpoint
- [ ] Stale push / deep-link handling
- [ ] Settlement after opponent disconnect
- [ ] Large text, VoiceOver, TalkBack

## Release decision

- [ ] Decision: `PRODUCTION CANDIDATE` / `READY WITH DOCUMENTED RISKS` / `NOT READY`
- [ ] Owner + date in `V1_5_RC_VALIDATION_REPORT.md`

## RC validation (2026-08-10)

- [x] Expo Doctor passes (SDK 57 alignment)
- [x] AdMob production blocker resolved in code
- [x] Permission audit (no microphone)
- [ ] Staging database validation
- [ ] Two-device QA
- [ ] Soak test
- [ ] Rollback drill on staging
- Current RC decision: **NOT READY — BLOCKERS REMAIN** (see `docs/V1_5_RC_VALIDATION_REPORT.md`)

## Rollback (summary)

1. `live_pvp_creation_enabled` → false server-side.
2. `EXPO_PUBLIC_ENABLE_LIVE_PVP=false` on next client build.
3. Do not drop `live_pvp_*` tables without backup plan.
