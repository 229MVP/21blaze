# Version 1.2.0 Store Release Feature Matrix

Store submission scope for **21 Blaze 1.2.0**. Features must work on physical
devices before classification as **SHIPPING**.

| Feature | Status | Store notes |
|---------|--------|-------------|
| Home | **SHIPPING** | Solo Play is the primary action |
| Solo Play (timed) | **SHIPPING** | Guest/local play without account |
| Countdown | **SHIPPING** | Board-relative overlay; tested on iOS/Android/web |
| Four-lane gameplay | **SHIPPING** | Core rules unchanged |
| Pause / Resume | **SHIPPING** | |
| Restart / Quit | **SHIPPING** | |
| Results | **SHIPPING** | Real match values |
| Play Again / Home | **SHIPPING** | |
| High Scores — Local | **SHIPPING** | |
| High Scores — Global | **SHIPPING** | Optional online verified tab |
| High Scores — Friends | **HIDDEN** | Tab not shown |
| Settings | **SHIPPING** | Sound, haptics, reduced motion |
| How to Play | **SHIPPING** | |
| Sound | **SHIPPING** | |
| Haptics | **SHIPPING** | |
| Reduced Motion | **SHIPPING** | |
| Blaze Locker | **SHIPPING** | Earnable cosmetics with Blaze Coins |
| Blaze Rewards (daily login + missions) | **SHIPPING** | Server-backed when online |
| Blaze Store (rewards mode) | **SHIPPING** | No IAP UI when purchases disabled |
| Visual themes + board/victory effects | **SHIPPING** | When visual flags enabled on store profiles |
| Interstitial ads | **SHIPPING** | Solo transition only; policy-gated |
| Rewarded ad coin grants | **HIDDEN** | SSV incomplete — `REWARDED_CURRENCY=false` |
| Store purchases / RevenueCat | **HIDDEN** | `STORE_PURCHASES=false` |
| Player progression screen | **HIDDEN** | `PROGRESSION_BETA=false` |
| Purchases / paywall / restore | **HIDDEN** | |
| Friends / social | **DEFERRED** | Not implemented |
| Daily Challenge | **DEFERRED** | Version 1.3 — not in navigator |
| Ranked / async duel (Quick Match) | **DEFERRED** | Routes flag-gated off |
| Live Duel | **DEFERRED** | Routes flag-gated off |
| Sabotage Battle Mode | **DEFERRED** | Spec only — `FUTURE_SABOTAGE_MODE_SPEC.md` |
| Tournaments | **DEFERRED** | Not implemented |
| Developer tools / diagnostics | **HIDDEN** | Off on store profiles |
| Placeholder / mockup screens | **HIDDEN** | Not in production navigator |

## Navigation safety

- Live, Quick Match, and Ranked routes register only when their flags are true (all **false** on store profiles).
- Daily reward/mission routes register only when rewards flags are true.
- No dead buttons on Home for deferred modes.

## Build profiles (store)

| Profile | Platform | Artifact | Purchases | Test ads |
|---------|----------|----------|-----------|----------|
| `production` | iOS App Store | `.ipa` | false | false |
| `android-production` | Google Play | `.aab` | false | false |
| `testflight` | iOS TestFlight | `.ipa` | false | true |
| `preview` | Internal QA | Android **APK** | dev only | true |

Do not use `preview` APK for Play Store submission. Do not use `developmentClient` on store profiles.
