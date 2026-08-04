# Version 1.1C Ads Implementation Audit

Audit performed at the start of Version 1.1C, against the Version 1.1B
state merged into `main`. Classifications use the scale requested in the
milestone: **Working**, **Implemented but untested**, **Partial**,
**Client-only**, **Backend-only**, **Disabled**, **Missing**.

## Summary

The ad SDK, unit-id resolution, interstitial policy, and UMP consent flow
were already substantially built (from the "Ads-first release" pass
before Version 1.0). Version 1.1C's main contributions are: centralizing
all direct SDK calls behind one `src/services/adService.ts`, extracting
the interstitial policy into a pure/testable module, fixing an iOS
personalized-ads/ATT compliance gap, and building genuine (but
live-untestable in this sandbox) AdMob Server-Side Verification for a new
flat rewarded-coin reward. **No component in this audit is claimed
production-ready without the caveats stated below.**

## Component-by-component status

| Area | Status | Notes |
|---|---|---|
| Ad SDK (`react-native-google-mobile-ads` v16.4.0) | **Implemented but untested** | Installed and configured via the Expo config plugin (`app.json`); never exercised on a real device build in this sandbox (no EAS build has been run for this milestone). |
| iOS AdMob app ID configuration | **Working** | `app.json` → `ios.infoPlist.GADApplicationIdentifier` and the `react-native-google-mobile-ads` plugin both currently hold Google's official test app id (`ca-app-pub-3940256099942544~1458002511`), correct for TestFlight. Production real IDs must be supplied via EAS secrets before a public store build (unchanged gap, documented since the Ads-first release). |
| Rewarded ad unit IDs | **Working (test); Partial (production)** | `src/monetization/adUnitIds.ts` resolves test vs. configured production IDs via the newly-extracted pure `adUnitResolution.ts` (unit tested). Falls back to Google's test ID when no production env var is set — a deliberate fail-safe, but means production silently ships test ads if the real secret is never set (must be caught at store-build time, not by this audit alone). |
| Interstitial ad unit IDs | **Working (test); Partial (production)** | Same resolution/fallback behavior as rewarded. |
| Test-ad configuration | **Working** | `EXPO_PUBLIC_ADMOB_USE_TEST_ADS` forces Google's sample IDs regardless of any configured production ID. Set `true` for `development`/`preview`/`testflight`, `false` for `production` in `eas.json` (confirmed unchanged and correct for this milestone). |
| UMP consent flow | **Implemented but untested** | `src/monetization/adConsentService.ts` calls `AdsConsent.requestInfoUpdate()` / `showForm()` correctly (form only shown when `status === REQUIRED`), persists the decision, and never repeats an obtained/not-required decision. Never exercised against Google's live UMP form (requires a real device + a configured GDPR message in the AdMob dashboard, neither available here). Added in 1.1C: `isPrivacyOptionsRequired()` (uses the SDK's dedicated privacy-options status API when available) and a `__DEV__`-only consent reset in Settings for manual re-testing. |
| ATT (App Tracking Transparency) behavior | **Working — deliberately not requested** | The app **never requests ATT** anywhere in the codebase (no `expo-tracking-transparency` dependency, no `requestTrackingAuthorizationAsync` call). `app.json` still declares `NSUserTrackingUsageDescription` for a possible future update but the string is currently unused. **Gap found and fixed in 1.1C:** `canRequestPersonalizedAds()` previously could return `true` on iOS whenever GDPR/UMP consent was `obtained`/`notRequired`, which would have requested *personalized* (IDFA-based) ads without ATT authorization — a real App Store compliance risk. It now always returns `false` on iOS (Android is unaffected, since ATT is an Apple-only requirement and continues to follow the UMP/GDPR state). **ATT is not required by the current configuration** because the app never accesses IDFA for tracking; if a future update wants personalized ads on iOS, ATT must be implemented and this gate updated together. |
| Ad frequency policy (interstitial) | **Working** | Solo-only, 3 completed matches, 10-minute cooldown, 3/UTC-day cap, never during the first app session, never during the explicit "never during" screen list. Implemented as a pure, SDK-independent function (`src/monetization/interstitialPolicy.ts`, `isInterstitialEligible`), unit tested with 21 scenarios in `v1_1cAdsSelfTest.ts`. The pre-1.1C implementation also had an undocumented "3 per app session" cap not present in the approved 1.1C policy — removed to match the policy exactly. |
| Reward verification (rewarded ads) | **Partial / Backend scaffolding implemented, not live-verified** | Two independent reward mechanisms exist: (1) the pre-existing "double the match reward" (`claim-ad-reward` Edge Function) — **client-trusted, no real SSV**, permanently gated off via `EXPO_PUBLIC_ENABLE_REWARDED_CURRENCY=false`, unchanged by this milestone; (2) the new flat "25 coins" reward (this milestone) — a genuine AdMob SSV verification pipeline (ECDSA P-256/SHA-256 signature check against Google's published keys) was implemented and its cryptographic core is unit-tested against a locally generated keypair, but the end-to-end flow has **never been exercised against a live AdMob callback** (requires configuring the deployed Edge Function URL as the ad unit's SSV callback in the AdMob console, which needs a live AdMob account not available here). See `docs/V1_1C_REWARDED_SSV.md` for the exact remaining blocker. `EXPO_PUBLIC_ENABLE_REWARDED_CURRENCY` stays `false` in every profile as a result. |
| Supabase Edge Functions (ads) | **Implemented, not deployed** | `request-rewarded-ad` and `verify-rewarded-ad` (new) plus the pre-existing `claim-ad-reward` exist as local function source only; none have been deployed to a live Supabase project in this sandbox (same "local-only" caveat that applies to every edge function in this repository per `docs/SUPABASE_DEPLOYMENT_CHECKLIST.md`). |
| Ad analytics | **Working** | `interstitial_eligible/_loaded/_shown/_dismissed/_failed`, `rewarded_ad_requested/_loaded/_completed/_dismissed/_verification_started/_verified/_verification_failed`, and the UMP events (`ump_status_updated`, `ump_form_presented`, `privacy_options_opened`) all fire through the existing lightweight `trackEvent` sink (`src/monetization/analytics.ts`). No secrets, tokens, or raw callback payloads are included in any event payload (only ids, amounts, and enum-like status strings). |
| Ad failure handling | **Working** | Every ad-SDK call site (`initializeAdsOnce`, `preloadRewardedAd`, `preloadInterstitialAd`, `maybeShowInterstitialAfterSoloHome`, `showRewardedAdForServerVerification`) catches all errors internally and resolves to a failure value (`false` / `{status:'failed'}`) rather than throwing. No ad call site is ever `await`-blocking navigation into or out of Solo Play — Solo gameplay is unaffected by any ad failure, airplane mode, or missing ad unit configuration. |
| Centralized ad service | **Working (new in 1.1C)** | `src/services/adService.ts` is now the single owner of `mobileAds().initialize()` (memoized to run at most once per process), ad preloading, and lifecycle state (`idle/loading/ready/showing/completed/failed/dismissed`) for both rewarded and interstitial ads. `interstitialAdService.ts` and `rewardedAdService.ts` (the legacy double-reward flow) were refactored to call into it instead of each duplicating their own `mobileAds().initialize()` — this also means UMP consent is now requested at most once per app session instead of once per ad service. |

## Environment / flag confirmation (Version 1.1C, §4)

| Flag | TestFlight value | Confirmed |
|---|---|---|
| `EXPO_PUBLIC_ENABLE_REWARDED_ADS` | `true` | ✅ already set in `eas.json` |
| `EXPO_PUBLIC_ENABLE_INTERSTITIAL_ADS` | `true` | ✅ already set |
| `EXPO_PUBLIC_ADMOB_USE_TEST_ADS` | `true` | ✅ already set |
| `EXPO_PUBLIC_ENABLE_STORE_PURCHASES` | `false` | ✅ already set |
| `EXPO_PUBLIC_ENABLE_REWARDED_CURRENCY` | `false` | ✅ already set (and stays `false` per the SSV blocker above) |

No changes were required to `eas.json` for this section — it already
matched the exact Version 1.1C TestFlight configuration.

## Do not claim ads are production-ready

This audit explicitly does **not** claim rewarded-currency, personalized
ads, or a real AdMob SSV integration are production-ready. The concrete
remaining blockers are:

1. Real production `EXPO_PUBLIC_ADMOB_*_ID` values have never been set
   (must come from EAS secrets; production currently falls back to
   Google's test IDs, which must never ship to the public App Store).
2. UMP has never been exercised against a live Google consent message —
   confirm the GDPR message set is published in the AdMob dashboard for
   the target regions before a public release.
3. AdMob SSV (§9) has no live verification pass — see
   `docs/V1_1C_REWARDED_SSV.md`.
4. No native build/device test has been performed for this milestone
   (no `eas build` was run, per the Version 1.1C instructions to stop
   after implementation/validation).
