# Version 1.4 Release Test Matrix — Async Duel

Pass/fail marks: **Pass** = executed and observed; **Fail** = executed and failed; **Pending** = not executed; **N/A** = not applicable in this environment.

Automated column: `Auto` (self-test / CI) or `Manual`.

| Test ID | Feature | Role | Preconditions | Steps | Expected | Auto/Manual | Platform | Env | Result | Notes |
|---------|---------|------|---------------|-------|----------|-------------|----------|-----|--------|-------|
| RF-01 | Deck parity | both | Shared seed | Generate deck twice | Identical order + fingerprint | Auto | all | local | Pass | `test:async-duel-release` |
| RF-02 | Deck divergence | both | Different seeds | Compare decks | Different order | Auto | all | local | Pass | |
| RF-03 | No Math.random | both | Source audit | Scan deck modules | No `Math.random()` | Auto | all | local | Pass | |
| RF-04 | State machine legal | n/a | — | Allowed transitions | Accept | Auto | all | local | Pass | |
| RF-05 | State machine illegal | n/a | — | Terminal → playing | Reject | Auto | all | local | Pass | |
| RF-06 | Tie-break score | n/a | Equal else | Higher score | Winner by score | Auto | all | local | Pass | |
| RF-07 | Tie-break Exact 21 | n/a | Equal score | More Exact 21s | Winner | Auto | all | local | Pass | |
| RF-08 | Tie-break Five-Card | n/a | Equal prior | More clears | Winner | Auto | all | local | Pass | |
| RF-09 | Tie-break busts | n/a | Equal prior | Fewer busts | Winner | Auto | all | local | Pass | |
| RF-10 | Tie-break time | n/a | Equal prior | Faster ms | Winner | Auto | all | local | Pass | |
| RF-11 | Full tie | n/a | All equal | Compare | `tie` | Auto | all | local | Pass | |
| RF-12 | Deep link sanitizes seed | n/a | Payload w/ seed | Parse | No seed field | Auto | all | local | Pass | |
| RF-13 | Kill-switch migration | ops | `0018` present | Grep migration | Push/rematch/ops/integrity | Auto | all | local | Pass | |
| RF-14 | Expire revoke | ops | `0018` | Grep grants | No authenticated execute | Auto | all | local | Pass | |
| RF-15 | Result validation restore | ops | `0018` | Grep complete fn | `validate_async_duel_result_fields` | Auto | all | local | Pass | |
| RF-16 | No service role in client | n/a | `supabase.ts` | Scan | Absent | Auto | all | local | Pass | |
| RF-17 | Marketing version | n/a | app/package | Read | `1.4.0` | Auto | all | local | Pass | |
| RF-18 | Phase 1 suite | n/a | — | `test:async-duel-phase1` | Pass | Auto | all | local | Pass | Re-run in freeze |
| RF-19 | Phase 2 suite | n/a | — | `test:async-duel-phase2` | Pass | Auto | all | local | Pass | |
| RF-20 | Phase 3 suite | n/a | — | `test:async-duel-phase3` | Pass | Auto | all | local | Pass | |
| RF-21 | v1.3 regression suite | n/a | — | `test:v1.3-release` + game/daily/progression | Pass | Auto | all | local | Pass | Baseline + post-fix |
| RF-22 | TypeScript | n/a | — | `npx tsc --noEmit` | Pass | Auto | all | local | Pass | Post-fix |
| RF-23 | Create duel | challenger | Auth online | Start challenge | One duel + attempt + seed | Manual | iOS/Android | staging | Pending | |
| RF-24 | Create concurrency | challenger | Rapid taps | Double create | ≤1 active intended duel | Manual | both | staging | Pending | |
| RF-25 | Challenger complete | challenger | Playing | Finish run | `awaiting_opponent` + 1 notif | Manual | both | staging | Pending | No XP/coins |
| RF-26 | Challenger double complete | challenger | — | Double submit | Idempotent | Manual | both | staging | Pending | |
| RF-27 | Opponent accept | opponent | Inbox | Accept/start | One opponent attempt + seed | Manual | both | staging | Pending | |
| RF-28 | Accept vs decline race | opponent | — | Parallel | Deterministic terminal | Manual | both | staging | Pending | |
| RF-29 | Opponent settle | opponent | Playing | Complete | Outcome + stats once | Manual | both | staging | Pending | |
| RF-30 | Decline | opponent | Awaiting | Decline | Declined + challenger notif | Manual | both | staging | Pending | |
| RF-31 | Cancel | challenger | Challenger playing | Cancel | Cancelled | Manual | both | staging | Pending | |
| RF-32 | Expiration | both | Past expires_at | Worker / RPC | Expired; not playable | Manual | both | staging | Pending | Server time |
| RF-33 | Rematch | either | Completed | Rematch | New id+seed; one child | Manual | both | staging | Pending | |
| RF-34 | Rematch race | both | Completed | Parallel rematch | One child | Manual | both | staging | Pending | |
| RF-35 | History / records | both | Settled | Open hub + profile | Aggregates match server | Manual | both | staging | Pending | |
| RF-36 | Head-to-head | participant | Series | Result series line | Participant-safe only | Manual | both | staging | Pending | |
| RF-37 | In-app notifications | both | Events | Open Alerts | Correct routing; no seed | Manual | both | staging | Pending | |
| RF-38 | Push delivery | both | Tokens + secrets | Trigger push | Delivered once | Manual | both | prod-like | Pending | **Unverified** here |
| RF-39 | Push deep link cold start | recipient | Push tap | Cold open | Auth → fetch → navigate | Manual | both | prod-like | Pending | Needs expo-notifications |
| RF-40 | Notification prefs | user | Settings | Toggle push/in-app | Honored | Manual | both | staging | Pending | |
| RF-41 | Account switch | multi | Two accounts | Switch | No cross inbox/history | Manual | both | staging | Pending | |
| RF-42 | Multi-device | one user | Two devices | Parallel play | Deterministic server state | Manual | both | staging | Pending | |
| RF-43 | Offline hub | user | Offline | Open hub | Error/retry; no fake win | Manual | both | staging | Pending | |
| RF-44 | Uncertain mutation | challenger | Timeout | Restart + reconcile | No duplicate duel | Manual | both | staging | Pending | |
| RF-45 | Creation kill switch | user | Flag false | Hub + create RPC | Unavailable UX + reject | Manual | both | staging | Pending | |
| RF-46 | Push kill switch | ops | Flag false | Claim outbox | Suppressed; duel ok | Manual | n/a | staging | Pending | |
| RF-47 | Seed before start | unrelated / opponent | Details RPC | Inspect payload | No seed | Manual | both | staging | Pending | |
| RF-48 | Accessibility | user | VoiceOver/TalkBack | Hub/result/notif | Labels + non-color outcome | Manual | both | device | Pending | Honest: not run |
| RF-49 | Solo regression | user | — | Solo game | Unchanged scoring | Manual | both | staging | Pending | Auto engine tests Pass |
| RF-50 | Daily Challenge regression | user | — | Ranked + practice | Unchanged | Manual | both | staging | Pending | Auto suites Pass |

## Environment notes

- This Cloud Agent environment: automated Node/TS self-tests and TypeScript checks only.
- No physical iOS/Android devices; Expo push credentials may be absent.
- Database/RLS live verification requires applying `0015`–`0018` to a staging project and running SQL probes — mark separately when done.

Do not mark Pending manual rows as Pass.
