# Version 1.2.0 Final Release Feature Matrix

Classification for the first public release. Source code for deferred features
remains in the repository but routes and UI entry points are hidden via feature
flags and navigator gating.

| Feature | Status | Notes |
|---------|--------|-------|
| Home | **Shipping** | Solo Play primary CTA |
| Solo Play (timed) | **Shipping** | Core gameplay loop |
| Countdown overlay | **Shipping** | Board-relative centering (Android/iOS/web) |
| Pause / Resume | **Shipping** | |
| Restart / Quit | **Shipping** | |
| Results | **Shipping** | Real match values |
| High Scores — Local | **Shipping** | |
| High Scores — Global | **Shipping** | Online verified; fails visibly offline |
| High Scores — Friends | **Hidden** | Tab removed for 1.2.0 |
| Settings | **Shipping** | Sound, haptics, reduced motion |
| How to Play | **Shipping** | |
| Sound / haptics | **Shipping** | |
| Reduced Motion | **Shipping** | |
| Blaze Locker (earn coins) | **Shipping** | `EXPO_PUBLIC_ENABLE_V1_1_LOCKER=true` on release profiles |
| Blaze Store (rewards mode) | **Shipping** | Purchases disabled; Blaze Rewards UI |
| Daily login reward | **Shipping** | With `V1_1_REWARDS` + `DAILY_REWARDS` on release profiles |
| Daily missions | **Shipping** | With `V1_1_REWARDS` + `DAILY_MISSIONS` on release profiles |
| Visual themes (1.2) | **Shipping** | Classic + earnable themes when visual flags on |
| Board / victory effects | **Shipping** | When visual flags on |
| Interstitial ads (Solo transitions) | **Shipping** | Test ads on TestFlight; policy-gated |
| Rewarded ads (currency) | **Hidden** | `REWARDED_CURRENCY=false` — SSV incomplete |
| Store purchases / RevenueCat | **Hidden** | `STORE_PURCHASES=false` |
| Player progression screen | **Hidden** | `PROGRESSION_BETA=false` |
| Live Duel | **Deferred** | Routes flag-gated off |
| Quick Match | **Deferred** | Routes flag-gated off |
| Ranked beta | **Deferred** | Routes flag-gated off |
| Daily Challenge (1.3) | **Deferred** | Not in 1.2.0 branch navigator |
| Async duels / friends / chat | **Deferred** | Not implemented |
| Tournaments | **Deferred** | Not implemented |
| Developer tools | **Hidden** | `__DEV__` / diagnostics flags off on release |
| Purchase diagnostics | **Hidden** | Off on TestFlight/production |
| Theme preview dev | **Hidden** | Off on release profiles |

## Release profile flags (summary)

| Flag | testflight | production |
|------|------------|------------|
| STORE_PURCHASES | false | false |
| V1_1_LOCKER | true | true |
| V1_1_REWARDS | true | true |
| V1_2_VISUAL_SYSTEM | true | true |
| BOARD_EFFECTS | true | true |
| VICTORY_EFFECTS | true | true |
| ADMOB_USE_TEST_ADS | true | false |
| REWARDED_CURRENCY | false | false |
| LIVE_DUEL / QUICK_MATCH / RANKED | false | false |
