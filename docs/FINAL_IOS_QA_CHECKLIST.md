# Version 1.2.0 Final iOS QA Checklist

Manual device verification before App Store submission. Do not mark READY until
each blocking item passes on a physical iPhone.

## Startup

- [ ] Cold launch shows visible rescue screen (21 BLAZE / STARTING GAME…) — no permanent black screen
- [ ] Splash hides within 8 seconds on slow network
- [ ] Offline launch reaches Home
- [ ] ErrorBoundary RETRY works after forced error (dev build only)
- [ ] Basic Mode / Classic fallback available if shell fails

## Countdown

- [ ] Fire ring centered on four-lane board (not screen center)
- [ ] Countdown number centered in ring
- [ ] GET READY above ring, not clipped on iPhone SE / Pro Max
- [ ] Countdown does not block lane touches (overlay pointerEvents none)
- [ ] Timing unchanged (3-2-1-BLAZE)

## Core gameplay

- [ ] Full Solo match: deal, lanes, 21, five-card clear, bust, multiplier, timer
- [ ] Pause freezes; resume restores
- [ ] Background → foreground safe
- [ ] Restart clean match
- [ ] Results show real score; Play Again / Home work
- [ ] Rapid taps do not duplicate moves

## Navigation

- [ ] No Live Duel, Ranked, Quick Match entry on Home
- [ ] No Daily Challenge entry
- [ ] Blaze Locker opens when flag on
- [ ] Blaze Rewards (not Blaze Store IAP) when purchases off
- [ ] No developer screens in release build
- [ ] High Scores: Local + Global only (no Friends tab)

## Persistence

- [ ] Force-close and reopen: settings, high score, equipped cosmetics persist

## Ads / privacy (if ads enabled)

- [ ] TestFlight shows Google test ads only
- [ ] No ad during countdown or active gameplay
- [ ] No ad on Pause overlay
- [ ] Consent failure does not block Solo Play
- [ ] ATT prompt only when tracking configuration requires it

## Purchases

- [ ] No paywall, restore, or dollar prices
- [ ] RevenueCat does not initialize

## Performance

- [ ] Ten consecutive Solo matches without increasing lag or crash
