# Async Duel — Version 1.4 Phase 2 QA

Playable Async Duel experience (mobile UI wired to Phase 1 backend).

**Flag:** `EXPO_PUBLIC_ENABLE_ASYNC_DUEL=true`  
**Migrations:** `0015` (foundation) + `0016` (search + active list)

Do not mark unexecuted manual tests as passed.

| Test ID | Role | Preconditions | Steps | Expected | Automated / Manual | Platform | Pass/Fail | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| AD2-01 | Challenger | Signed in, flag on, Phase 1+2 migrations | Home → see ASYNC DUEL entry → DUEL | Opens Duel Hub | Manual | iOS/Android | | |
| AD2-02 | Guest | Signed out | Open Async Duel Hub | Sign-in required; no inbox | Manual | Both | | |
| AD2-03 | Opponent | Incoming challenges exist | Home badge count | Matches authoritative inbox length | Manual | Both | | Uses `refreshHub` inbox |
| AD2-04 | Challenger | Online | Hub → Challenge Player → search ≥2 chars | Debounced bounded results; self excluded | Manual | Both | | |
| AD2-05 | Challenger | Eligible opponent | Confirm → Start Duel | Client sends opponent id only; plays server seed | Manual | Both | | |
| AD2-06 | Challenger | After create | Finish run | Challenge Sent (not Victory); no XP/coins | Manual | Both | | |
| AD2-07 | Opponent | Challenger completed | Inbox → View → Accept & Play | Seed received only now; one attempt | Manual | Both | | |
| AD2-08 | Both | Same duel | Compare deck fingerprints / first cards | Identical seed, rules, duration, bust | Automated | Node | Pass when `test:async-duel-phase2` green | |
| AD2-09 | Opponent | After opponent finish | Result screen | Server settlement; Victory/Defeat/Tie by role | Manual | Both | | |
| AD2-10 | Challenger | Settled duel | History → open result | Perspective adapter (not raw challenger_win) | Manual | Both | | |
| AD2-11 | Opponent | Awaiting challenge | Decline with confirm | Removed after server confirm | Manual | Both | | |
| AD2-12 | Challenger | Status challenger_playing | Cancel | Allowed; not after awaiting_opponent | Manual | Both | | |
| AD2-13 | Opponent | Near expiry | Accept at expiry | Server wins race; friendly expired copy | Manual | Both | | |
| AD2-14 | Either | Offline | Open Hub | Offline/error + retry | Manual | Both | | |
| AD2-15 | Either | Mid-submit | Kill app after server success | Reopen Hub; no duplicate create | Manual | Both | | |
| AD2-16 | Account switch | User A inbox loaded | Sign out → User B | Inbox cleared; no A data | Manual | Both | | `resetUserScopedStores` |
| AD2-17 | A11y | VoiceOver/TalkBack | Hub, details, result | Labels; Victory/Defeat not color-only | Manual | Both | | |
| AD2-18 | Security | Inspect network | Inbox/history responses | No seed field | Manual | Both | | |
| AD2-19 | Security | Client code review | Async Duel paths | No direct table writes; no rewards | Automated + review | — | | |
| AD2-20 | Presentation | Unit | Perspective + tie-break labels | Match Phase 1 comparator | Automated | Node | `npm run test:async-duel-phase2` | |
| AD2-21 | Errors | Unit | Error map | Player-safe copy | Automated | Node | | |
| AD2-22 | Phase 1 | Backend | Existing Phase 1 suite | Still green | Automated | Node | `npm run test:async-duel-phase1` | |

## Automated validation commands

```bash
npm run test:async-duel-phase1
npm run test:async-duel-phase2
npx tsc --noEmit
```

## Manual testing still required

- Two-device (or two-account) full create → play → accept → settle loop
- Expiration countdown zero → verifying → refresh
- Duplicate-tap Start / Accept / Decline / Complete
- iOS and Android visual/accessibility pass with flag enabled
- Production build with flag off (screens unregistered) and on

## Out of scope (Phase 3+)

Live PvP, sabotage, friends, chat, matchmaking, MMR, seasons, tournaments, paid entry, push, duel XP/coins, rematches, spectating.
