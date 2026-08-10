# Async Duel — Version 1.4 Phase 3 QA

Do not mark unexecuted manual / physical-device tests as passed.

| Test ID | Preconditions | Steps | Expected | Auto/Manual | Platform | Pass/Fail | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| AD3-01 | Migrations 0015–0017 | Challenger completes | One `DUEL_CHALLENGE_RECEIVED` for opponent | Manual | Both | | Dedupe on retry |
| AD3-02 | Awaiting challenge | Unfinished challenger | No challenge notification | Manual | Both | | |
| AD3-03 | Opponent settles | Challenger opens Alerts | One `DUEL_COMPLETED` | Manual | Both | | |
| AD3-04 | Decline | Opponent declines | Challenger gets declined alert | Manual | Both | | |
| AD3-05 | Online | Home Alerts badge | Matches unread RPC count | Manual | Both | | |
| AD3-06 | Notification list | Open item | Marks read; routes; fetches duel | Manual | Both | | |
| AD3-07 | Signed out | Deep link | Auth gate; no foreign duel | Manual | Both | | |
| AD3-08 | Account switch | User A → B | No A notifications | Manual | Both | | |
| AD3-09 | Settings | Toggle push prefs | Preferences persist; inbox intact | Manual | Both | | |
| AD3-10 | Permission | Enable push | Prompt only after Enable | Manual | iOS/Android device | | Needs expo-notifications |
| AD3-11 | Cold start push | Tap push | Opens app → validates → fetches | Manual | Device | | Env-dependent |
| AD3-12 | Warm start push | Tap push | Same as above | Manual | Device | | |
| AD3-13 | No Expo token | Dispatcher cron | Jobs suppressed safely | Manual/ops | Server | | |
| AD3-14 | Settled duel | Progression duel record | W/L/T + highest | Manual | Both | | |
| AD3-15 | Two players | H2H on result | Participant-only series line | Manual | Both | | |
| AD3-16 | Completed duel | Play Rematch | New seed/id; original unchanged | Manual | Both | | |
| AD3-17 | Double tap rematch | Rapid Start Rematch | One rematch child | Manual | Both | | |
| AD3-18 | Both race rematch | Simultaneous | One child; typed error for loser | Manual | Both | | |
| AD3-19 | Offline alerts | Open Notifications | Error/retry | Manual | Both | | |
| AD3-20 | A11y | TalkBack/VoiceOver | Unread announced; W/L not color-only | Manual | Both | | |
| AD3-21 | Unit | `test:async-duel-phase3` | Pass | Automated | Node | | |
| AD3-22 | Regression | Phase 1+2 suites | Pass | Automated | Node | | |

## Automated commands

```bash
npm run test:async-duel-phase1
npm run test:async-duel-phase2
npm run test:async-duel-phase3
npx tsc --noEmit
```
