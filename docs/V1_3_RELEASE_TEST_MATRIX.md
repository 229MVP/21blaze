# Version 1.3 Release Test Matrix

Status key: **PASS (auto)** = executed in CI/agent run · **REQUIRED (manual)** = not executed · **FAIL** = failed when run

Automated suite run on release-freeze branch (see `package.json` test scripts).

---

## Solo

| ID | Area | Preconditions | Steps | Expected | Type | Status | Notes |
|----|------|---------------|-------|----------|------|--------|-------|
| SOLO-01 | Engine | — | Run `npm run test:game` | All game engine assertions pass | Auto | PASS (auto) | |
| SOLO-02 | Countdown | — | Run `npm run test:countdown-layout` | Countdown centered | Auto | PASS (auto) | |
| SOLO-03 | Cold start | App installed | Launch app → Solo Play | Game starts, countdown, playable | Manual | REQUIRED (manual) | Device QA |
| SOLO-04 | Results persistence | Online account | Complete Solo → Results → Home | High score persists | Manual | REQUIRED (manual) | |
| SOLO-05 | XP once | Progression on, online | Complete Solo | +25 XP once, no duplicate on Results revisit | Manual | REQUIRED (manual) | Server path |

---

## Daily ranked

| ID | Area | Preconditions | Steps | Expected | Type | Status | Notes |
|----|------|---------------|-------|----------|------|--------|-------|
| DC-R-01 | Deck deterministic | — | `test:daily-challenge-deck` | Same seed → same deck | Auto | PASS (auto) | |
| DC-R-02 | Attempt gate | — | `test:daily-challenge-attempts` | Double-tap resume, no duplicate ranked | Auto | PASS (auto) | |
| DC-R-03 | Phase 2 flow | — | `test:daily-challenge-phase2` | UI/policy integration | Auto | PASS (auto) | |
| DC-R-04 | UTC date | — | `test:v1.3-release` | Midnight boundary dates | Auto | PASS (auto) | |
| DC-R-05 | One ranked/day | Online, not played | Start ranked twice | Second start resumes or rejects | Manual | REQUIRED (manual) | |
| DC-R-06 | Completion XP | Progression on | Complete ranked | +75 XP once | Manual | REQUIRED (manual) | |
| DC-R-07 | UTC reset | Near 00:00 UTC | Play before/after midnight | New challenge date after reset | Manual | REQUIRED (manual) | |

---

## Daily practice

| ID | Area | Preconditions | Steps | Expected | Type | Status | Notes |
|----|------|---------------|-------|----------|------|--------|-------|
| DC-P-01 | No ranked consumption | Completed ranked | Start practice | Practice available, ranked unchanged | Manual | REQUIRED (manual) | |
| DC-P-02 | No leaderboard | Practice complete | Open leaderboard | Practice score absent | Manual | REQUIRED (manual) | |
| DC-P-03 | No streak/XP | Practice complete | Check streak/XP | No streak/XP from practice | Manual | REQUIRED (manual) | Server enforced |
| DC-P-04 | No ranked mission credit | Practice complete | Check missions | Daily Blaze mission not completed | Manual | REQUIRED (manual) | |

---

## Leaderboards

| ID | Area | Preconditions | Steps | Expected | Type | Status | Notes |
|----|------|---------------|-------|----------|------|--------|-------|
| LB-01 | Phase 3 logic | — | `test:daily-challenge-phase3` | Tie-break + registry tests | Auto | PASS (auto) | |
| LB-02 | Daily eligible only | Ranked + practice data | Open daily board | Only ranked eligible rows | Manual | REQUIRED (manual) | |
| LB-03 | Weekly UTC week | Cross-week data | Open weekly board | Correct Mon–Sun UTC sum | Manual | REQUIRED (manual) | |
| LB-04 | My rank | Completed ranked | View position | Matches server rank | Manual | REQUIRED (manual) | |
| LB-05 | Offline | Offline | Open leaderboard | Safe error/offline state | Manual | REQUIRED (manual) | |

---

## Streaks

| ID | Area | Preconditions | Steps | Expected | Type | Status | Notes |
|----|------|---------------|-------|----------|------|--------|-------|
| ST-01 | Phase 3 streak RPC | — | `test:daily-challenge-phase3` | Streak registry tests | Auto | PASS (auto) | |
| ST-02 | Official only | Ranked complete | Check streak | Increments once per UTC day | Manual | REQUIRED (manual) | |
| ST-03 | Practice no streak | Practice only | Check streak | No change | Manual | REQUIRED (manual) | |
| ST-04 | Milestone idempotent | Reach milestone, claim twice | Claim reward | One coin grant | Manual | REQUIRED (manual) | |
| ST-05 | Month boundary | Streak across month end | Complete consecutive days | Streak logic correct | Manual | REQUIRED (manual) | |

---

## Missions

| ID | Area | Preconditions | Steps | Expected | Type | Status | Notes |
|----|------|---------------|-------|----------|------|--------|-------|
| MI-01 | Three missions | Online, progression on | Open missions | Exactly 3 missions | Manual | REQUIRED (manual) | |
| MI-02 | UTC reset | After 00:00 UTC | Reload missions | New day assignments | Manual | REQUIRED (manual) | |
| MI-03 | Solo progress | Solo with exact 21s | Complete game | Mission progress increments | Manual | REQUIRED (manual) | |
| MI-04 | Practice excluded | Practice daily | Complete practice | Ranked-only missions unchanged | Manual | REQUIRED (manual) | |

---

## Mission claims

| ID | Area | Preconditions | Steps | Expected | Type | Status | Notes |
|----|------|---------------|-------|----------|------|--------|-------|
| CL-01 | Secure claim path | Completed mission | Tap CLAIM | XP + coins from server | Manual | REQUIRED (manual) | |
| CL-02 | Double tap | Completed mission | Double CLAIM | One grant | Manual | REQUIRED (manual) | |
| CL-03 | Restart after claim | Claimed mission | Restart app | Still CLAIMED | Manual | REQUIRED (manual) | |

---

## XP / levels

| ID | Area | Preconditions | Steps | Expected | Type | Status | Notes |
|----|------|---------------|-------|----------|------|--------|-------|
| XP-01 | Curve | — | `test:progression` | v1.3 curve assertions | Auto | PASS (auto) | |
| XP-02 | Phase 4 | — | `test:daily-challenge-phase4` | XP/mission client rules | Auto | PASS (auto) | |
| XP-03 | Boundaries | — | `test:v1.3-release` | Levels 1–10 thresholds | Auto | PASS (auto) | |
| XP-04 | Multi level-up | Large mission XP | Claim mission | Multiple levels in one grant | Manual | REQUIRED (manual) | |
| XP-05 | Level-up UI | Level up | View modal | No fabricated unlocks | Manual | REQUIRED (manual) | |

---

## Economy

| ID | Area | Preconditions | Steps | Expected | Type | Status | Notes |
|----|------|---------------|-------|----------|------|--------|-------|
| EC-01 | Wallet RPC | — | `test:monetization` | Wallet helpers | Auto | PASS (auto) | |
| EC-02 | Locker | — | `test:v1.1b-locker` | Coin unlock safety | Auto | PASS (auto) | |
| EC-03 | Rewards | — | `test:v1.1-rewards` | Reward registry | Auto | PASS (auto) | |
| EC-04 | Streak claim | Eligible milestone | Claim | One ledger entry | Manual | REQUIRED (manual) | |

---

## Auth / account

| ID | Area | Preconditions | Steps | Expected | Type | Status | Notes |
|----|------|---------------|-------|----------|------|--------|-------|
| AU-01 | Account switch | Two accounts | Sign out → sign in | No stale progression/wallet | Manual | REQUIRED (manual) | `resetUserScopedStores` added |
| AU-02 | Guest | Local mode | Play Solo | No server XP persistence message | Manual | REQUIRED (manual) | |
| AU-03 | Session refresh | Online session | Background/resume | Auth restores | Manual | REQUIRED (manual) | |

---

## Offline / network

| ID | Area | Preconditions | Steps | Expected | Type | Status | Notes |
|----|------|---------------|-------|----------|------|--------|-------|
| NET-01 | Offline Solo | Offline | Play Solo | Game works; sync message for rewards | Manual | REQUIRED (manual) | |
| NET-02 | Claim timeout | Slow network | Claim mission, retry | Idempotent single grant | Manual | REQUIRED (manual) | |

---

## Platform

| ID | Area | Preconditions | Steps | Expected | Type | Status | Notes |
|----|------|---------------|-------|----------|------|--------|-------|
| PL-01 | iOS export | — | `expo export --platform ios` | Success | Auto | PASS (auto) | Release freeze run |
| PL-02 | Android export | — | `expo export --platform android` | Success | Auto | PASS (auto) | |
| PL-03 | Web export | — | `expo export --platform web` | Success | Auto | PASS (auto) | |
| PL-04 | iOS device | Test build | Full smoke test | No black screen, navigation OK | Manual | REQUIRED (manual) | |
| PL-05 | Android device | Test build | Full smoke test | Startup stable | Manual | REQUIRED (manual) | |

---

## Accessibility

| ID | Area | Preconditions | Steps | Expected | Type | Status | Notes |
|----|------|---------------|-------|----------|------|--------|-------|
| A11Y-01 | XP bar | VoiceOver/TalkBack | Focus progression bar | Announces level and XP fraction | Manual | REQUIRED (manual) | |
| A11Y-02 | Missions | VoiceOver/TalkBack | Focus mission card | Name, progress, reward, state | Manual | REQUIRED (manual) | |
| A11Y-03 | Reduced motion | Reduced motion on | Level up | No blocking animation | Manual | REQUIRED (manual) | |

---

## Summary

| Category | Auto PASS | Manual required |
|----------|-----------|-----------------|
| Total cases above | 18 | 35+ |

Do not mark manual cases as PASS until executed on target devices.
