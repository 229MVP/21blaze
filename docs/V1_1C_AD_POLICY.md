# Version 1.1C Ad Policy

## Interstitial policy

Implemented as a pure, ad-SDK-independent function:
`isInterstitialEligible(context)` in `src/monetization/interstitialPolicy.ts`.
`src/monetization/interstitialAdService.ts` is the only caller that
combines this decision with real persisted state (`AsyncStorage`) and the
ad SDK; the policy function itself never touches either.

### Eligibility rules (exact)

- Solo mode only — the only call site is
  `maybeShowInterstitialAfterSoloHome`, invoked from `HomeScreen` after
  returning from a completed Solo match.
- Requires 3 completed Solo matches since the last interstitial shown.
- Minimum 10-minute cooldown between interstitials.
- Maximum 3 interstitials per UTC calendar day.
- Never during the player's first app session (tracked via a one-time
  `AsyncStorage` flag, persisted before any ad logic runs).
- Never during any of: countdown, gameplay, pause, Results statistics,
  reward synchronization, cosmetic unlock, daily reward claim, mission
  claim, authentication, Live Duel, Ranked, or while another ad is
  showing — enforced via an explicit `currentScreen` enum reported by
  each relevant screen through `useInterstitialScreenTracking`.
- Blocked for 60 seconds after any rewarded-ad interaction (interstitial
  never immediately follows a rewarded ad).
- Never shown to a player with the Remove Ads / Pro entitlement.
- Never on web.

### What changed from the pre-1.1C implementation

- The old implementation also enforced an undocumented "3 per app
  session" cap. The Version 1.1C spec's approved policy does not include
  a session cap (only the daily cap), so it was removed to implement the
  approved policy exactly.
- The eligibility decision itself moved out of
  `interstitialAdService.ts` into a standalone pure function so it can be
  unit tested without the ad SDK (`v1_1cAdsSelfTest.ts`, 21 interstitial
  scenarios).
- Screen tracking (`setInterstitialCurrentScreen`) was added so the
  "never during X" list is enforced by data, not just by there being only
  one call site today.

## Rewarded ads

Two independent reward mechanisms exist in this codebase:

1. **Legacy "double the match reward"** (`useWalletStore.claimRewardedDouble`,
   Results screen) — unchanged by Version 1.1C, still gated behind
   `EXPO_PUBLIC_ENABLE_REWARDED_CURRENCY=false` (client-trusted, no real
   SSV — see `docs/V1_1C_REWARDED_SSV.md`).
2. **New flat "25 Blaze Coins" reward** (this milestone) —
   `src/store/useRewardedCoinStore.ts`, placements in Blaze Locker,
   Results, Daily Rewards, and Daily Missions, button copy
   `WATCH AD — EARN 25 COINS`. Also gated behind
   `EXPO_PUBLIC_ENABLE_REWARDED_CURRENCY=false` until AdMob SSV is
   live-verified.

Both are optional, explicit-tap-only, and never shown during active
gameplay (only on Locker/Results/Daily Rewards/Daily Missions, never on
`GameScreen`).

### Approved reward

- 25 Blaze Coins per verified watch.
- Maximum 3 verified grants per UTC day, enforced **twice** server-side:
  once before the ad is even requested (`request_rewarded_ad`, so no ad
  impression is wasted once the cap is hit) and once again at grant time
  (`verify_and_grant_rewarded_ad`, closing any race between two
  concurrent requests).

## Centralized ad service

`src/services/adService.ts` is the single owner of all direct
`react-native-google-mobile-ads` calls:

- `initializeAdsOnce()` — consent request + `mobileAds().initialize()`,
  memoized to run at most once per app process.
- `preloadRewardedAd()` / `preloadInterstitialAd()` — load an ad ahead of
  need; safe to call repeatedly (no-op while already loading/ready).
- `showRewardedAdViaService()` — shows the preloaded rewarded ad for the
  legacy double-reward flow.
- `showRewardedAdForServerVerification({ userId, customData })` — creates
  a fresh, SSV-tagged rewarded ad request for the new flat-coin reward
  (cannot reuse a generically preloaded ad, since SSV `customData` must be
  set at ad-request time).
- Public lifecycle state (`idle/loading/ready/showing/completed/failed/dismissed`)
  with a subscribe API, so UI can reflect ad readiness without polling.

Native ad objects (`RewardedAd`/`InterstitialAd` instances) are held only
in module-level closures inside `adService.ts` — never in Zustand state,
so they are never serialized, persisted, or recreated on every render.
`interstitialAdService.ts` and `rewardedAdService.ts` both call into this
service instead of each maintaining their own SDK-initialization state.
