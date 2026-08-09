# Daily Challenge Phase 2 — Manual QA

Version 1.3 Phase 2 validates the playable Daily Blaze flow: Home card → landing → ranked start → gameplay → results → submission → completed/practice states.

**Prerequisites**

- `EXPO_PUBLIC_ENABLE_DAILY_CHALLENGE=true`
- `EXPO_PUBLIC_ENABLE_DAILY_CHALLENGE_RANKED=true`
- `EXPO_PUBLIC_ENABLE_DAILY_CHALLENGE_PRACTICE=true` (for practice tests)
- Hosted Supabase configured with migrations 0001–0012 applied
- Authenticated test account (not local-only mode)

Record pass/fail in Android and iOS columns. Web optional.

| Test | Steps | Expected | Android | iOS |
|------|-------|----------|---------|-----|
| **TEST A** Authenticated first attempt | Sign in → Home → Daily Blaze → Start Daily Challenge → complete countdown → play → finish | One ranked attempt created; deterministic deck; results submit | | |
| **TEST B** Double-tap Start | On landing, rapidly double-tap Start | Only one start request; single attempt; no duplicate errors | | |
| **TEST C** Complete official game | Finish ranked run (time/busts/deck) | Results show DAILY BLAZE COMPLETE; official stats; submission succeeds | | |
| **TEST D** Attempt second ranked run | After completion, try Start again | Start disabled or shows completed; no second ranked attempt | | |
| **TEST E** Practice mode | After official completion → Practice | PRACTICE RUN label; no official submission; same initial deck | | |
| **TEST F** Force close during game | Start ranked → play → force-close app mid-run | Attempt remains consumed server-side | | |
| **TEST G** Resume behavior | Reopen after TEST F → Home shows IN PROGRESS → Resume | Resumes same attempt/seed; no new start RPC | | |
| **TEST H** Offline start | Disable network before Start (no in-progress attempt) | OFFLINE / connection message; Solo still works | | |
| **TEST I** UTC reset | Near 00:00 UTC (or simulate date change in dev fixture) | Countdown updates; new day fetches new challenge without app restart | | |
| **TEST J** Solo regression | Solo Play from Home → full game → results | Normal shuffle, scoring, restart, pause unchanged | | |

## Additional checks

- Ranked Daily Blaze: Restart hidden (bottom bar + pause menu).
- Pause still works in ranked and Solo.
- Home Daily Blaze card shows status icon + label + UTC reset countdown.
- Sign-out: card shows SIGN IN TO COMPETE; Solo Play unaffected.
- Daily API failure: Home shows error with TRY AGAIN; Solo Play unaffected.
- No fake rank, percentile, or leaderboard placement in Phase 2 UI.
- Dev diagnostics (`Settings` → dev entry): UI fixtures apply AVAILABLE / IN PROGRESS / etc. (development builds only).

## Dev harness

In `__DEV__`, open **Daily Challenge Diagnostics** from Settings. Use **UI state fixtures** to preview card/landing states without mutating production ranked data on shared accounts (prefer a test user).
