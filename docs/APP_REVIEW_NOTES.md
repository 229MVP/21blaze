# App Review Notes — 21 Blaze 1.2.0

Copy into App Store Connect **Notes for Review** and Google Play **App access**
sections as appropriate.

---

## How to start Solo Play

1. Launch the app — Home screen appears (no login required).
2. Tap **SOLO PLAY** (primary button).
3. Wait for the **GET READY** countdown on the lane board.
4. Tap a lane to place each dealt card until the timer ends or the deck is exhausted.
5. View **Results**, then **PLAY AGAIN** or return **Home**.

## Core objective

Build up to four lanes without busting. Clear lanes at **21** or with a
**five-card clear**. Score points and grow a multiplier. Beat your high score
within the two-minute clock.

## Account and login

- **Solo Play does not require an account.**
- Optional anonymous online session enables verified global leaderboard and
  server-backed Blaze Locker / rewards when network is available.
- If offline, the app runs in **LOCAL MODE** with local high scores only.

## Purchases

- **In-app purchases are disabled** in this release (`EXPO_PUBLIC_ENABLE_STORE_PURCHASES=false`).
- No paywall, restore purchases, or dollar-priced products appear.
- Blaze Coins are earned through gameplay and rewards, spent in Blaze Locker on
  earnable cosmetics — not real-money packs.

## Advertisements

- Interstitial ads may appear on **natural transitions** (e.g. returning to Home
  after Solo) when ads are enabled.
- Ads **do not** appear during active gameplay, countdown, pause, or results statistics.
- TestFlight / internal builds use **Google test ad units only**.
- Rewarded ads that grant currency are **disabled** (server verification incomplete).

## Blaze Locker and rewards

- Blaze Locker unlocks cosmetics with earned Blaze Coins (online server confirms purchases).
- Daily login reward and missions require online sync; failures show clear messages without blocking Solo.

## Hidden / unavailable features

Not exposed in this build: multiplayer, Live Duel, Ranked, Daily Challenge,
friends leaderboard, Sabotage Mode, in-app purchases, developer diagnostics.

## Support

- In-app **Feedback** screen (from Settings or dedicated route).
- Support URL: _(developer must insert live URL before submission)_

## Privacy

- Privacy policy URL: _(developer must insert live URL before submission)_
- Ad consent managed via Google UMP on Android; see privacy policy for details.

## Encryption

App uses standard HTTPS; declares non-exempt encryption false for export compliance.
