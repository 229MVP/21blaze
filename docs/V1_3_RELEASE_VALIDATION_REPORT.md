# Version 1.3 Release Validation Report

Generated during release-freeze phase on branch `cursor/v1-3-release-freeze-1a6b`.

---

## 1. Files changed (release freeze)

| File | Purpose |
|------|---------|
| `src/store/resetUserScopedStores.ts` | Clear user-scoped caches on sign-out / account switch |
| `src/store/useAuthStore.ts` | Wire store reset on auth user change |
| `src/challenge/v1_3ReleaseSelfTest.ts` | XP boundary + UTC deterministic tests |
| `docs/V1_3_RELEASE_TEST_MATRIX.md` | Full test matrix |
| `docs/V1_3_SECURITY_AUDIT.md` | Security audit |
| `docs/V1_3_RELEASE_CHECKLIST.md` | Release checklist |
| `package.json` | `test:v1.3-release` script |

No new migrations in release-freeze (0011–0014 from prior phases).

---

## 2. Migrations added (v1.3 cumulative)

| Migration | Phase |
|-----------|-------|
| `0011_v1_3a_daily_challenge.sql` | 1.3A foundation tables |
| `0012_v1_3_phase1_daily_challenge_rpc.sql` | RPCs + attempt RLS hardening |
| `0013_v1_3_phase3_leaderboards_streaks_rewards.sql` | Leaderboards, streaks, rewards |
| `0014_v1_3_phase4_progression.sql` | XP, missions, progression RPCs |

---

## 3. Bugs found

| ID | Severity | Description |
|----|----------|-------------|
| REL-01 | Medium | Stale progression/wallet/daily data could flash after account switch |

---

## 4. Bugs fixed

| ID | Fix |
|----|-----|
| REL-01 | `resetUserScopedStores()` on sign-out and `onAuthStateChange` user id change |

---

## 5. Security issues found

| ID | Severity | Description |
|----|----------|-------------|
| SEC-01 | Low (accepted) | Client-local Solo gameplay until server verify |
| SEC-02 | Low (accepted) | Optimistic reward UI before server confirm |

No new **critical** client-authoritative XP/coin write paths found in `src/` audit.

---

## 6. Security issues fixed

| ID | Fix |
|----|-----|
| REL-01 | Account switch cache isolation (see above) |

Pre-existing: attempt/streak direct client writes removed in migrations 0012/0013.

---

## 7. Automated checks run

| Check | Command | Result |
|-------|---------|--------|
| TypeScript | `npx tsc --noEmit` | **PASS** |
| Game engine | `npm run test:game` | **PASS** |
| Progression | `npm run test:progression` | **PASS** |
| Daily challenge (all) | `test:daily-challenge*` + phase2/3/4 | **PASS** |
| Release self-test | `npm run test:v1.3-release` | **PASS** |
| Countdown layout | `npm run test:countdown-layout` | **PASS** |
| v1.1 rewards/locker/ads | respective scripts | **PASS** |
| v1.2 visual | `test:v1.2a-visual-theme` | **PASS** |
| Ranked / monetization | respective scripts | **PASS** |
| Expo doctor | `npx expo-doctor` | **19/20** (expo-build-properties patch advisory) |
| iOS export | `expo export --platform ios --clear` | **PASS** |
| Android export | `expo export --platform android --clear` | **PASS** |
| Web export | `expo export --platform web --clear` | **PASS** |

---

## 8. Exact pass/fail results

All listed automated tests: **PASS**  
Expo doctor: **1 advisory failure** (non-blocking patch version)  
ESLint: **not configured** in project (pre-existing)

---

## 9. Manual tests still required

See `docs/V1_3_RELEASE_TEST_MATRIX.md` — **35+ manual cases** including:

- Device cold/warm start (iOS, Android)
- Daily ranked + practice isolation on real backend
- Leaderboard/streak UI vs server
- Mission claim double-tap on device
- UTC reset boundary (live)
- Accessibility (VoiceOver/TalkBack)
- Offline Solo + reconnect claim behavior

---

## 10. Known limitations

- Guest/local mode: no persistent XP/missions without authenticated account
- Solo offline: XP sync deferred until online + `submit-match`
- No EAS production build produced in this phase
- Live Supabase RLS not exercised by automated CI (staging live script available)
- Sabotage / Async Duel / purchases intentionally disabled

---

## 11. Release blockers

| Blocker | Status |
|---------|--------|
| Critical reward duplication path | **None identified** in code audit |
| Client-authoritative XP/coin writes | **None identified** |
| Automated test failures | **None** |
| Migrations not applied to target Supabase | **Ops blocker** — must apply 0011–0014 before prod QA |
| Manual device QA not executed | **QA blocker** for store submission |

---

## 12. Recommended release decision

### **READY WITH DOCUMENTED RISKS**

**Rationale:**

- All automated TypeScript, unit/self-tests, and export builds pass on the release-freeze branch
- Security audit documents trust boundaries; critical write paths are server-side with idempotency
- Account-switch cache leak fixed
- Manual multi-device QA and production Supabase migration apply remain **required** before store submission

**Not** declaring unconditional **READY** because mandatory manual test matrix entries have not been executed on physical devices in this agent run.

---

## Checkpoint

| Item | Value |
|------|-------|
| Branch | `cursor/v1-3-release-freeze-1a6b` |
| Base | `cursor/1-3-phase4-progression-1a6b` (`d59c5d2`) |
| v1.3 migrations present | Yes (0011–0014) |
| v1.4 feature work introduced | No |
