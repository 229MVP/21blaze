# Version 1.3 Release Checklist

Use before TestFlight / Play internal testing or production cut.

---

## Environment configuration

- [ ] `EXPO_PUBLIC_SUPABASE_URL` points to production/staging project
- [ ] `EXPO_PUBLIC_SUPABASE_ANON_KEY` is publishable key (not service role)
- [ ] **No** `SUPABASE_SERVICE_ROLE_KEY` in client env or bundle
- [ ] `EXPO_PUBLIC_APP_ENV` set appropriately (`preview` / `production`)
- [ ] Daily Challenge flags enabled per release plan:
  - [ ] `EXPO_PUBLIC_ENABLE_DAILY_CHALLENGE`
  - [ ] `EXPO_PUBLIC_ENABLE_DAILY_CHALLENGE_RANKED`
  - [ ] `EXPO_PUBLIC_ENABLE_DAILY_CHALLENGE_PRACTICE`
  - [ ] `EXPO_PUBLIC_ENABLE_DAILY_LEADERBOARD`
- [ ] Progression flags:
  - [ ] `EXPO_PUBLIC_ENABLE_V1_3_PROGRESSION` (or equivalent progression + missions flags)
- [ ] Purchases **disabled** unless explicitly approved:
  - [ ] `EXPO_PUBLIC_ENABLE_STORE_PURCHASES` = false
  - [ ] `EXPO_PUBLIC_ENABLE_MONETIZATION_BETA` as intended for ads-only build
- [ ] Ads configuration reviewed (`docs/V1_1C_AD_POLICY.md`)
- [ ] `EXPO_PUBLIC_ADMOB_USE_TEST_ADS` for reviewer builds if needed

---

## Supabase backend

- [ ] Migrations applied in order through `0014_v1_3_phase4_progression.sql`
- [ ] Edge functions deployed:
  - [ ] `submit-match`
  - [ ] `daily-missions`
  - [ ] `daily-reward`
- [ ] RPCs verified: `start_daily_challenge`, `complete_daily_challenge`, leaderboard RPCs, streak claim, mission claim
- [ ] RLS enabled on all v1.3 tables (see `V1_3_SECURITY_AUDIT.md`)
- [ ] `daily_challenge_attempts` INSERT/UPDATE revoked for clients (migration 0012)
- [ ] `daily_challenge_streaks` INSERT/UPDATE revoked (migration 0013)
- [ ] Optional: run `npm run test:daily-challenge-live` against staging

---

## Client build

- [ ] `npx tsc --noEmit` passes
- [ ] Full automated test suite passes (see below)
- [ ] `npx expo-doctor` reviewed (note any accepted advisories)
- [ ] `expo export` succeeds for ios, android, web
- [ ] App version `1.3.0` in `package.json` reviewed
- [ ] EAS store version **not** incremented until stabilization sign-off

---

## Debug / dev surfaces

- [ ] Daily Challenge Diagnostics: **only** `__DEV__` Settings entry
- [ ] Theme Preview: requires `__DEV__` + `EXPO_PUBLIC_ENABLE_THEME_PREVIEW_DEV`
- [ ] Purchase diagnostics not shown in production store builds
- [ ] No test hooks exposed in production navigation

---

## Automated tests (run all)

```bash
npm run test:game
npm run test:progression
npm run test:daily-challenge
npm run test:daily-challenge-deck
npm run test:daily-challenge-attempts
npm run test:daily-challenge-phase2
npm run test:daily-challenge-phase3
npm run test:daily-challenge-phase4
npm run test:v1.3-release
npm run test:countdown-layout
npm run test:v1.1-rewards
npm run test:v1.1b-locker
npm run test:v1.1c-ads
npm run test:v1.2a-visual-theme
npm run test:ranked
npm run test:monetization
```

- [ ] All above PASS on release branch

---

## Manual device QA

- [ ] Complete `docs/V1_3_RELEASE_TEST_MATRIX.md` manual sections on iOS
- [ ] Complete manual sections on Android
- [ ] Smoke test Web export if shipping web
- [ ] Record results in test matrix Notes column

---

## Store / compliance

- [ ] Privacy data map reviewed (`docs/PRIVACY_DATA_MAP.md`)
- [ ] Store metadata draft reviewed (`docs/STORE_METADATA_DRAFT.md`)
- [ ] Purchases disabled disclosure accurate
- [ ] No Async Duel / Sabotage / PvP marketed in v1.3 build

---

## Rollback plan

- [ ] Previous store build retained (1.2.x or last stable)
- [ ] Supabase migrations are forward-only; rollback = disable feature flags + revert client build
- [ ] `docs/DATABASE_ROLLBACK_PLAN.md` reviewed for migration 0011–0014
- [ ] Feature flags can disable Daily Challenge and progression without new binary (partial mitigation)

---

## Sign-off

| Role | Name | Date | Decision |
|------|------|------|----------|
| Engineering | | | READY / READY WITH RISKS / NOT READY |
| QA | | | |
| Product | | | |

Release decision must align with `V1_3_RELEASE_VALIDATION_REPORT.md` (generated at freeze).
