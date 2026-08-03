# Version 1.1 TestFlight Checklist

Covers Version 1.1A (Blaze Rewards) + 1.1B (Blaze Locker) + 1.1C (Ads,
Retention Polish, and TestFlight Release Candidate). Purchases remain
disabled for this release — nothing below re-enables RevenueCat.

## Pre-flight configuration

- [x] `EXPO_PUBLIC_ENABLE_STORE_PURCHASES=false` in `testflight` profile.
- [x] `EXPO_PUBLIC_ENABLE_REWARDED_ADS=true`, `EXPO_PUBLIC_ENABLE_INTERSTITIAL_ADS=true` in `testflight` profile.
- [x] `EXPO_PUBLIC_ADMOB_USE_TEST_ADS=true` in `testflight` profile (never live ad-unit IDs in this build).
- [x] `EXPO_PUBLIC_ENABLE_REWARDED_CURRENCY=false` everywhere (AdMob SSV not yet live-verified — see `docs/V1_1C_REWARDED_SSV.md`).
- [x] `EXPO_PUBLIC_ENABLE_V1_1_LOCKER` set for the build under test (defaults `false`; set `true` to exercise the Locker).
- [x] Bundle identifier unchanged: `com.twentyoneblaze.app`.
- [x] EAS project id unchanged: `0c5db163-a4c0-4a17-9a8a-e12eed3bf511`.
- [x] iOS deployment target unchanged: `16.4`.
- [x] App icon / splash screen unchanged.

## Functional smoke test (manual, on a TestFlight build)

1. **Solo Play** — a full match plays, scores, and completes normally
   with no ad-related blocking at any point (countdown, gameplay, pause,
   Results).
2. **Rewards** — after a completed Solo match, the Results screen shows
   the itemized reward breakdown once the server confirms it (never
   before).
3. **Daily Streak** — `DailyRewardScreen` shows the current day, claimed
   days, the next reward, and (on Day 7) the Seven Day Blaze title;
   claiming works exactly once per eligible day.
4. **Daily Missions** — three server-assigned missions show progress,
   target, and reward; claim only works when the mission is complete and
   the device is online.
5. **Blaze Locker** (if enabled) — balance, tabs, previews, unlock
   confirmation, and equip all function; no dollar prices, RevenueCat
   packages, or "Restore Purchases" appear anywhere in the Locker.
6. **Interstitial** — does not appear before 3 completed Solo matches,
   respects the 10-minute cooldown and 3/day cap, and never appears
   during the first app session.
7. **Rewarded ad UI** — `WATCH AD — EARN 25 COINS` plays a test ad end to
   end; since SSV is not live-verified, the flow may end at "verification
   failed" rather than "25 coins added" — this is expected in this build,
   not a regression (see `docs/V1_1C_REWARDED_SSV.md`).
8. **UMP consent** — the consent form (if applicable for the test
   device's region) appears at most once per decision; Settings → Privacy
   Options re-opens it on demand.
9. **What's New** — the "BLAZE REWARDS ARE HERE" message appears once per
   fresh install (when both `EXPO_PUBLIC_ENABLE_V1_1_LOCKER` and
   `EXPO_PUBLIC_ENABLE_V1_1_REWARDS` are enabled) and never reappears
   after being dismissed.
10. **Feedback** — Settings → Feedback lets a tester copy the app
    version/build and anonymized diagnostics, and opens a pre-filled
    support email.

## Feedback route (Settings → Feedback)

Included:
- Copy app version and build number.
- Copy anonymized diagnostics (app version, build, platform, environment).
- Open support email with a pre-filled subject/body.
- Optional "screen name" / "error code" fields included in the email body.

Explicitly excluded (never included in any copy/share action):
- Access tokens or session credentials.
- Full database records.
- Raw user IDs / UUIDs.
- Ad verification secrets (AdMob signing keys, service role keys).
- RevenueCat API keys.
- Private match logs.

**Known placeholder:** the support email address
(`support@twentyoneblaze.com`, in `src/screens/FeedbackScreen.tsx`) is a
placeholder and must be replaced with a real, monitored support address
before public release.

## Known, intentional limitations for this TestFlight build

- Rewarded-ad currency grants are disabled (test ads still play).
- Real production AdMob ad-unit IDs are not configured (test IDs are
  used everywhere via `EXPO_PUBLIC_ADMOB_USE_TEST_ADS=true`).
- No live AdMob SSV verification has been performed.
- Purchases remain fully disabled; RevenueCat is not initialized.
