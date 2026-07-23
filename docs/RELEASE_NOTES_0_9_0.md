# Release Notes — 21 Blaze Internal Beta 0.9.0

Thanks for testing **21 Blaze** Internal Beta.

| | |
|--|--|
| Version | **0.9.0** |
| Android | versionCode **901** |
| iOS | buildNumber **901** |
| Package | `com.twentyoneblaze.app` |

This is an **internal Solo beta**. It is not a public store release and is not “production ready.”

---

## What’s in this beta

- **Solo Play** — 4-lane blaze runs with Ace, exact 21, five-card, bust, timer, pause, and results  
- **Local high scores** and a **local leaderboard**  
- **Settings** and **How to Play**  
- **RevenueCat Test Store** purchases (not production billing):
  - Ad-Free (`blaze_ad_free`)
  - Inferno Pack (`blaze_inferno_pack`)
  - Neon Pack (`blaze_neon_pack`)
  - Founders Pack (`blaze_founders_pack`)
- **Restore Purchases** and cosmetic entitlement display  
- **Purchase Diagnostics** (preview/dev builds only)  
- **Test interstitial ads** (Google test IDs) so you can verify Ad-Free  
- **Offline-friendly Solo** — anonymous auth when available; local mode if online fails. Solo is never blocked.

---

## What’s not in this beta

Please don’t expect these yet:

- Live Duel / Quick Match / Ranked  
- Progression, daily rewards, daily missions  
- Rewarded ads or ad-earned coins  
- Production App Store / Play purchases or production AdMob IDs  

---

## How to help

1. Play Solo — try Ace, 21, five-card, bust, timer, and pause.  
2. Check that your high score sticks after force-quitting.  
3. If purchases are available, try one Test Store product and Restore.  
4. If you buy Ad-Free, confirm test interstitials stop.  
5. Report crashes and blockers with device + steps (see [INTERNAL_BETA_FEEDBACK_GUIDE.md](./INTERNAL_BETA_FEEDBACK_GUIDE.md)).

---

## Known caveats

- Builds require a linked EAS project and authenticated Expo account — some environments cannot produce APK/IPA yet.  
- Purchase dashboard configuration may still be incomplete; failed Test Store offers should be reported with diagnostics.  
- Online features depend on a deployed backend that is **not** claimed verified in this release.

Enjoy the blaze — and thank you for keeping feedback scoped and honest.
