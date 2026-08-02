# Ads-First Release Notes — 21 Blaze v1.0

**Strategy:** Ship TestFlight and the public App Store v1.0 as an **ads-first, free-progression** release. RevenueCat products, entitlements, Offerings, and the native Paywall remain fully configured in the dashboard for a future paid-purchases update, but are **not** exposed to players in this release.

This document is the source of truth for that pivot. See [`ENVIRONMENT_VARIABLES.md`](./ENVIRONMENT_VARIABLES.md) for the full flag/profile reference.

---

## 1. Purchase feature freeze

`EXPO_PUBLIC_ENABLE_STORE_PURCHASES=false` for `testflight` and `production` EAS profiles.

When purchases are disabled:

- `configureRevenueCat()` (`src/monetization/revenueCatClient.ts`) is the single choke point for `Purchases.configure` and returns immediately — RevenueCat is **never initialized**, in the background or otherwise.
- `usePurchaseStore`'s `purchaseProduct`, `restorePurchases`, `presentProPaywall`, `openCustomerCenter`, `refreshCustomerInfo` all short-circuit to `'unavailable'` / no-op without setting a visible error.
- `isPurchaseDiagnosticsEnabled()` now also requires `isStorePurchasesEnabled()` — the diagnostics screen/route/entry points disappear whenever purchases are off, in any build profile.
- Nothing is deleted: `react-native-purchases`, `react-native-purchases-ui`, product/entitlement identifiers, the RevenueCat webhook, and migration code all remain in place for a future release.
- Any entitlement a player already owns from the server (`serverEntitlements`, e.g. a prior promo/admin grant) is still honored for display (Ad-Free / Pro badges) — the freeze only blocks **new** purchase flows, not already-owned status.

## 2. Purchase UI removed from v1.0

`BlazeStoreScreen` renders conditionally on `isStorePurchasesEnabled()`:

| Section / control | Purchases ON (dev/preview) | Purchases OFF (TestFlight/production) |
|---|---|---|
| Header title | `BLAZE STORE` | **`BLAZE REWARDS`** |
| 21 Blaze Pro, Featured (Founders), Remove Ads, store-sourced Card Themes / Arenas | Shown | **Hidden** |
| Coin Cosmetics (earn + spend Blaze Coins) | Shown | **Shown** (this is the earnable content) |
| Restore Purchases | Shown | **Hidden** |
| Purchase Diagnostics | Shown (dev/preview) | **Hidden** |
| "NATIVE STORE REQUIRED" / offerings-unavailable notices | Shown when relevant | **Hidden** (no longer relevant) |
| Disclosure copy | Store/purchase language | "Earn Blaze Coins by playing Solo matches, then spend them here." |

Home / Player Progression "BLAZE STORE" button label becomes **BLAZE REWARDS** whenever `isStorePurchasesEnabled()` is false (the button itself stays gated by `isMonetizationBetaEnabled()`, unchanged).

`SettingsScreen`'s **ACCOUNT AND PURCHASES** section collapses to a **PRIVACY** section containing only Privacy Options (ad consent) when purchases are disabled — no Restore, Manage Subscription, Ad-Free Status, Purchase Support, or Diagnostics rows.

## 3. RevenueCat environment safety

- TestFlight/production never set or require `EXPO_PUBLIC_REVENUECAT_API_KEY` (Test Store). No env var in `eas.json` sets a RevenueCat key for any profile — keys are supplied via EAS secrets/environment only, never committed.
- `getRevenueCatApiKey()` already refuses to resolve a `test_…` key when `isProductionBuild()` is true; combined with the purchase-flag freeze above, TestFlight/production can never end up configuring a Test Store key even if one were mistakenly set.
- Development builds may still use the RevenueCat Test Store (`EXPO_PUBLIC_ENABLE_STORE_PURCHASES=true` in the `development` profile) — unchanged.

## 4. Ads-first configuration

| Profile | Monetization | Interstitial | Rewarded ads | Store purchases | Ad units |
|---|---|---|---|---|---|
| `development` | ON | ON | ON | ON (Test Store) | Forced test (`EXPO_PUBLIC_ADMOB_USE_TEST_ADS=true`) |
| `preview` | ON | ON | ON | ON (Test Store) | Forced test |
| `testflight` | ON | ON | ON | **OFF** | Forced test |
| `production` | ON | ON | ON | **OFF** | Real units expected via EAS secrets (falls back to Google test IDs if unset — **must not ship without setting real `EXPO_PUBLIC_ADMOB_*` secrets**) |

`EXPO_PUBLIC_ADMOB_USE_TEST_ADS` (new) forces Google's sample test ad units regardless of any configured production IDs — used to guarantee TestFlight testers and reviewers never see live ads.

## 5. Interstitial policy (`src/monetization/interstitialAdService.ts`)

- Solo mode only, triggered after Solo → Home.
- Requires 3 completed Solo matches since the last interstitial.
- **10-minute** minimum cooldown between interstitials (raised from 8).
- Maximum 3 per app session **and** maximum 3 per UTC calendar day (new — persisted across restarts).
- Never shown during the player's first app session (new — tracked via a one-time AsyncStorage flag).
- Never shown before/during gameplay, countdown, pause, Results, Live Duel, Ranked, authentication, or reward sync — the only call site is the post-Solo-match Home transition.
- `hydrateInterstitialCaps()` is now called once at app startup (`App.tsx`) so match/cooldown/day counters persist correctly across app restarts (previously write-only and effectively reset every launch).

## 6. Rewarded ads

**Reward ads infra is enabled** (`EXPO_PUBLIC_ENABLE_REWARDED_ADS=true`) for TestFlight and production so the SDK/ad units are exercised, but **rewarded-currency grants remain disabled** (`EXPO_PUBLIC_ENABLE_REWARDED_CURRENCY=false`) everywhere.

**Exact blocker:** `supabase/functions/claim-ad-reward/index.ts` trusts the client-supplied `clientRewardId` and the client's local `EARNED_REWARD` callback. There is no AdMob Server-Side Verification (SSV) webhook validating that a real rewarded ad was actually watched (no signature check on an AdMob→server postback, no `custom_data`/`key_id` verification). Until that SSV endpoint exists, a malicious client could call the claim function directly without watching an ad.

Per the safe-fallback policy: **rewarded-currency stays OFF in production until SSV is implemented and verified; interstitials remain ON.** The only current UI entry point for rewarded ads (Results screen "DOUBLE REWARD") is gated by `isRewardedCurrencyEnabled()`, so no rewarded-ad prompt is shown to players in this release. This is intentional, not a regression — do not enable `EXPO_PUBLIC_ENABLE_REWARDED_CURRENCY` in production until SSV lands.

## 7. Active-play rewards — deferred

The requested "1 coin per active minute, up to 20/day" and "20 bonus coins for first match of the day" reward model was **not implemented** in this pass. Implementing accurate active-play-time tracking safely requires server-authoritative session/activity timestamps (excluding menus, pause, background, countdown, and invalid/abandoned matches) — this is meaningful backend work that should not be rushed before TestFlight.

**Preserved instead:** the existing verified, server-authoritative Solo match reward system (`calculate_solo_match_coins` SQL + `src/monetization/coinRewards.ts`, mirrored and self-tested):

- Base: 25 coins per completed Solo match
- +10 at score ≥ 1,000, +15 at ≥ 2,000, +25 at ≥ 3,000 (cumulative)
- +50 bonus for the first completed match of the (server) day
- Idempotent per match (`solo_coins:{matchId}`), granted only for non-quit, verified-score matches

Active-minute rewards are **documented as deferred**, not simulated locally.

## 8. Free launch rewards (spendable Blaze Coins)

Coin economy already has a genuine, server-backed spend sink independent of any purchase flag:

- `useCosmeticStore.purchaseWithCoins` → `purchase-cosmetic` Edge Function → `purchase_cosmetic_with_coins` RPC.
- Catalog (`src/cosmetics/catalog.ts`, `purchaseSource: 'coins'`): Midnight Cards (3,000), Ember Arena (5,000), Hot Streak title (2,000), Flame Profile Frame (2,500).
- These render in the **BLAZE REWARDS** screen's "Coin Cosmetics" section regardless of the purchase flag.

**Achievement-tier free cosmetics** (level 3/5/10/15/25/30/40/50 titles, card backs, frames, plus the 7-day streak title) exist in the catalog but are tied to the progression/XP system, which remains behind `EXPO_PUBLIC_ENABLE_PROGRESSION_BETA=false` in every profile (unchanged by this task — enabling progression is a separate, larger readiness decision not requested here). They are intentionally **not** surfaced as "earnable" in this release since players cannot actually reach them while progression is off; this avoids promising an unlock players cannot obtain.

## 9. Privacy / consent (UMP)

Already implemented and left unchanged:

- `requestAdConsentIfNeeded()` (`src/monetization/adConsentService.ts`) calls `AdsConsent.requestInfoUpdate()` and shows the consent form only when `status === REQUIRED` — never repeats an already-obtained/not-required decision.
- Both interstitial and rewarded ad loaders call this before `mobileAds().initialize()` and pass `requestNonPersonalizedAdsOnly: true` when personalized consent was not obtained.
- `openPrivacyOptions()` re-presents the UMP form on demand; exposed via Settings → Privacy Options in both purchase states.
- No App Tracking Transparency (ATT) prompt exists anywhere in the codebase — IDFA/tracking is not requested, consistent with "do not request ATT unless intentionally enabled."
- Ad loading failures never block Solo Play (`ensureMobileAds()` fails closed, returns `false`, callers no-op).

**Outstanding for store submission (not code):** update the App Store Connect App Privacy "data types collected" answers and the Google Play Data Safety form to reflect AdMob's data collection now that ads are enabled for all users, and confirm the UMP consent message/GDPR message set in the AdMob dashboard is published for the target regions.

## 10. Remaining blockers before public App Store submission

1. **AdMob SSV** — no server-side verification for rewarded-currency claims (§6). Keep `EXPO_PUBLIC_ENABLE_REWARDED_CURRENCY=false` until built and verified.
2. **Real AdMob production ad units** — `EXPO_PUBLIC_ADMOB_*_ID` env vars are not set anywhere in this repo (by design — they must come from EAS secrets). Without them, production silently falls back to Google's sample test ad units, which **must not** ship to the public App Store. Set real IDs via EAS secrets and confirm `EXPO_PUBLIC_ADMOB_USE_TEST_ADS=false` before the store build.
3. **EAS project / Apple credentials** — confirm `eas init` has linked a real project and Apple distribution credentials are configured for the `testflight` profile (`distribution: store`).
4. **Store privacy disclosures** — App Store Connect App Privacy and Google Play Data Safety forms need to reflect AdMob usage (see §9).
5. **Active-play reward system** — deferred per §7; not required for v1.0 but should be scoped separately.
