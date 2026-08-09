# Version 1.3 Phase 4 — Progression QA

Manual QA checklist for XP, levels, daily missions, and secure claiming.

## A. New user XP

- [ ] Sign in with a fresh account.
- [ ] Confirm level 1 and 0 / 500 XP bar on Home (when progression enabled).
- [ ] No missions claimed or XP granted before first valid completion.

## B. Solo XP

- [ ] Complete a Solo game online.
- [ ] Confirm +25 XP once on Results or after sync.
- [ ] Repeat Results navigation — no duplicate XP.

## C. Daily Blaze XP

- [ ] Complete official ranked Daily Blaze.
- [ ] Confirm +75 XP granted once.
- [ ] Repeat completion RPC — no duplicate XP.

## D. Level up

- [ ] Earn enough XP to level up.
- [ ] Level-up modal shows correct level.
- [ ] Unlocks match server catalog (no fake cosmetics).

## E. Multiple level up

- [ ] Large XP grant (mission claim) crossing 2+ levels.
- [ ] Single modal: `LEVEL X → Y` and `N LEVELS GAINED`.

## F. Mission progress

- [ ] Three daily missions load.
- [ ] Exact 21 / five-card / lane missions increment from Solo.
- [ ] Daily Blaze mission completes only on ranked completion.

## G. Mission claim

- [ ] Complete mission shows COMPLETE + CLAIM.
- [ ] Claim grants server-defined XP and coins.

## H. Double claim

- [ ] Double-tap CLAIM — one grant only.
- [ ] App restart after claim — remains CLAIMED.

## I. Mission UTC reset

- [ ] After 00:00 UTC, new mission set loads.
- [ ] Historical claimed records preserved.

## J. Offline behavior

- [ ] Solo works offline.
- [ ] Progress shows sync message when online required.

## K. Sign-out / sign-in persistence

- [ ] XP, level, missions, coins persist across logout/login.

## L. Android

- [ ] Startup, Solo, Daily Blaze, progression UI stable.

## M. iPhone

- [ ] Same as Android.

## N. Web

- [ ] Export build loads; progression UI readable.

## O. Daily Challenge regression

- [ ] Ranked + practice flows unchanged.
- [ ] Practice does not grant completion XP or ranked-only missions.

## P. Leaderboard regression

- [ ] Daily and weekly leaderboards still load and rank correctly.
