# Version 1.2.0 Final Android QA Checklist

Manual device verification before Play Store submission.

## Startup

- [ ] Cold launch visible UI — no permanent black screen
- [ ] Splash hides on APK / AAB
- [ ] Offline launch reaches Home
- [ ] Status bar / navigation bar do not break layout

## Countdown alignment (critical)

- [ ] Fire ring centered on four-lane board at 320×800, 360×800, 390×844, 430×932
- [ ] Number centered in ring
- [ ] GET READY centered above ring
- [ ] Ring does not shift while rotating

## Core gameplay

- [ ] Full Solo loop end-to-end
- [ ] Pause / resume / restart
- [ ] Hardware back from modals and secondary screens
- [ ] Results and Play Again

## Navigation

- [ ] No multiplayer or 1.3 routes accessible
- [ ] Locker and rewards visible when flags on
- [ ] No Friends leaderboard tab

## Persistence

- [ ] Settings and scores survive force-close

## Ads

- [ ] Internal APK: test ad units only
- [ ] Production bundle: live units only when `ADMOB_USE_TEST_ADS=false` and IDs configured
- [ ] Ad load failure does not block Solo

## Purchases

- [ ] No IAP UI; RevenueCat inactive

## Performance

- [ ] Ten Solo matches without memory growth or tap delay
