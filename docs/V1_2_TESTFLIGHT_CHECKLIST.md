# 21 Blaze 1.2.0 — TestFlight Test Plan

Manual scenarios to execute on a real TestFlight build before wider
distribution. Each item's expected result reflects the code-level
guarantees audited in `docs/V1_2C_QA_AUDIT.md`; this checklist is where
those guarantees get confirmed on real hardware.

## Install & upgrade

- [ ] **Fresh install** — clean device/simulator, no prior 21 Blaze data.
      Expect: app launches, consent flow completes, Solo Play works,
      Classic theme renders, rewards systems initialize without error,
      Locker loads, no paid UI, no missing-asset error, no dev preview,
      no localhost/Metro dependency, no RevenueCat warning.
- [ ] **Upgrade from Version 1.1** — install over an existing 1.1
      TestFlight build. Expect: high scores, settings, Reduced Motion
      preference, sound/haptic preference, Blaze Coins, XP, daily streak,
      daily missions, cosmetic ownership, equipped cosmetics, and the
      auth session are all preserved. The "EMBER BLAZE HAS ARRIVED"
      message appears exactly once, with OPEN LOCKER / PLAY NOW actions,
      and never mentions purchases.

## Theme rendering

- [ ] **Classic theme match** — play a full Solo match with every slot on
      its Classic default. Expect: identical to pre-1.2 behavior.
- [ ] **Ember theme match** — equip `ember_card_back`, `gold_lane_glow`,
      `lava_arena_tint`, `flame_profile_frame` (2+ pieces) and play a
      full match. Expect: coordinated orange/gold board and victory
      effects; cards, lane totals, timer, and score remain fully
      readable.

## Effects

- [ ] **Exact 21** — confirm the lane highlight fires once, resolves
      quickly, and never blocks the next placement.
- [ ] **Five-card clear** — confirm the sweep completes and the lane
      clears through the existing engine timing, not delayed by the
      effect.
- [ ] **Bust** — confirm the red flash is brief and does not delay bust
      resolution.
- [ ] **Multiplier increase** — confirm the badge glow only fires on a
      real multiplier increase, never spuriously.
- [ ] **Pause during an effect** — pause mid-animation; confirm no crash,
      no stuck overlay, and the effect resolves normally on resume.
- [ ] **Background during an effect** — background the app mid-animation;
      confirm no crash and normal state on foreground return.
- [ ] **Results** — confirm the standard-completion glow appears and the
      screen remains fully usable throughout.
- [ ] **New high score** — confirm the stronger gold/ember celebration
      appears, "NEW HIGH SCORE" is clearly presented, and reward sync is
      not delayed by the animation.

## Locker

- [ ] **Locker preview** — open the Locker; confirm the EMBER BLAZE
      COLLECTION section shows the correct owned/locked counts and no
      dollar price or bundle-purchase language anywhere.
- [ ] **Cosmetic unlock** — unlock a Blaze-Coin cosmetic; confirm the
      confirmation modal appears before spending, the wallet updates only
      after server confirmation, and the unlock celebration shows once.
- [ ] **Cosmetic equip** — equip an owned cosmetic; confirm it renders
      immediately in the Locker preview and in gameplay.

## Reduced Motion, sound, and haptics

- [ ] **Reduced Motion** — enable the setting; replay Exact 21 /
      five-card-clear / bust / multiplier / match-complete / high-score;
      confirm each shows a short, static alternative and remains
      understandable without animation.
- [ ] **Sound and haptics** — confirm card-placed/exact-21/five-card-clear/
      bust/multiplier/match-complete/high-score audio and haptics fire
      once per event with no doubling from the new visual layer.

## Offline / asset resilience

- [ ] **Offline startup** — launch with no network; confirm Solo Play,
      Classic theme, and cached equipped cosmetics all render, and Locker
      unlocks are safely blocked with a clear offline message.
- [ ] **Optional asset failure** — (dev-build only, via ThemePreviewScreen's
      simulate-missing-asset toggle, or by simulating a network failure
      during preload) confirm the affected category falls back to
      Classic without a crash or blank space.

## Ads (test configuration only)

- [ ] **Test interstitial** — trigger the interstitial after 3 eligible
      Solo matches; confirm it uses a Google test ad unit (never a
      production ID), never appears during gameplay, and respects the
      10-minute/3-per-day limits.
- [ ] **Rewarded-ad release status** — confirm rewarded ads are optional,
      require explicit interaction, and do not grant currency without
      server verification.

## Progression

- [ ] **Daily missions** — confirm mission progress/claim still works
      exactly as in Version 1.1.
- [ ] **Daily streak** — confirm streak continuation/reset still works
      exactly as in Version 1.1.
- [ ] **Wallet preservation** — confirm the Blaze Coin balance across the
      upgrade and across normal play matches the server-confirmed value
      at every point.

## Release-scope confirmation

- [ ] **No purchase UI** — confirm no dollar price, "Buy", paywall, or
      Restore Purchases control appears anywhere in the build.
- [ ] **No RevenueCat initialization** — confirm no RevenueCat network
      call or SDK log appears at any point in the session (device
      console / Xcode log, if available).
- [ ] **No missing assets** — confirm no "missing image" icon, blank
      placeholder, or dev-only label appears anywhere in the app.
- [ ] **No developer tools** — confirm Settings has no "OPEN THEME
      PREVIEW" or "RESET AD CONSENT (DEV)" row, and no route to
      `ThemePreviewScreen`/`PurchaseDiagnosticsScreen`/`BlazeUIKitPreview`
      exists from anywhere in the UI.
