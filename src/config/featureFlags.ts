/**
 * Client UX flags only. Server authorization remains the final authority.
 * Never treat these as a security boundary.
 *
 * RC 0.9.0: incomplete/untested systems default OFF unless an env flag
 * explicitly enables them. Core Solo Play is never gated.
 */

function envFlag(name: string, defaultValue: boolean): boolean {
  const value = process.env[name];
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }
  const normalized = value.trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes';
}

/** development | preview | production — set by EAS build profiles. */
export function getAppEnv(): 'development' | 'preview' | 'production' | 'unknown' {
  const raw = (process.env.EXPO_PUBLIC_APP_ENV ?? '').trim().toLowerCase();
  if (raw === 'development' || raw === 'preview' || raw === 'production') {
    return raw;
  }
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    return 'development';
  }
  return 'unknown';
}

export function isProductionBuild(): boolean {
  return getAppEnv() === 'production';
}

export function isPurchaseDiagnosticsEnabled(): boolean {
  // Never show purchase diagnostics in production store builds, and never
  // when store purchases are intentionally disabled (ads-first releases).
  if (isProductionBuild() || !isStorePurchasesEnabled()) {
    return false;
  }
  return (
    (typeof __DEV__ !== 'undefined' && __DEV__) ||
    getAppEnv() === 'development' ||
    getAppEnv() === 'preview' ||
    envFlag('EXPO_PUBLIC_ENABLE_PURCHASE_DIAGNOSTICS', false)
  );
}

/** Live Duel friend rooms — disabled by default until two-device QA passes. */
export function isLiveDuelEnabled(): boolean {
  return envFlag('EXPO_PUBLIC_ENABLE_LIVE_DUEL', false);
}

/** Quick Match — disabled by default until two-device QA passes. */
export function isQuickMatchEnabled(): boolean {
  return envFlag('EXPO_PUBLIC_ENABLE_QUICK_MATCH', false);
}

export function isRankedBetaEnabled(): boolean {
  return envFlag('EXPO_PUBLIC_ENABLE_RANKED_BETA', false);
}

export function isMonetizationBetaEnabled(): boolean {
  return envFlag('EXPO_PUBLIC_ENABLE_MONETIZATION_BETA', false);
}

export function isRewardedAdsEnabled(): boolean {
  return (
    isMonetizationBetaEnabled() && envFlag('EXPO_PUBLIC_ENABLE_REWARDED_ADS', false)
  );
}

/**
 * Server-side AdMob SSV is not complete for production currency grants.
 * Keep OFF unless explicitly enabled for a verified sandbox environment.
 */
export function isRewardedCurrencyEnabled(): boolean {
  return (
    isRewardedAdsEnabled() &&
    envFlag('EXPO_PUBLIC_ENABLE_REWARDED_CURRENCY', false)
  );
}

export function isInterstitialAdsEnabled(): boolean {
  return (
    isMonetizationBetaEnabled() &&
    envFlag('EXPO_PUBLIC_ENABLE_INTERSTITIAL_ADS', false)
  );
}

export function isStorePurchasesEnabled(): boolean {
  return (
    isMonetizationBetaEnabled() &&
    envFlag('EXPO_PUBLIC_ENABLE_STORE_PURCHASES', false)
  );
}

/**
 * Forces Google/AdMob sample test ad units regardless of configured
 * production ad unit IDs. Used for TestFlight so reviewers and testers
 * never see live ads.
 */
export function isAdMobTestModeForced(): boolean {
  return envFlag('EXPO_PUBLIC_ADMOB_USE_TEST_ADS', false);
}

export function isMonetizationTestMode(): boolean {
  return typeof __DEV__ !== 'undefined' && __DEV__;
}

export function isProgressionBetaEnabled(): boolean {
  return envFlag('EXPO_PUBLIC_ENABLE_PROGRESSION_BETA', false);
}

/**
 * Version 1.1 "Blaze Rewards" master switch — Results itemized reward
 * summary, Home reward indicators, daily rewards, and daily missions.
 * Defaults OFF so Version 1.0 TestFlight behavior remains unchanged
 * until this is explicitly enabled for a 1.1 release build.
 */
export function isV1_1RewardsEnabled(): boolean {
  return envFlag('EXPO_PUBLIC_ENABLE_V1_1_REWARDS', false);
}

export function isDailyRewardsEnabled(): boolean {
  return (
    isV1_1RewardsEnabled() &&
    envFlag('EXPO_PUBLIC_ENABLE_DAILY_REWARDS', false)
  );
}

export function isDailyMissionsEnabled(): boolean {
  return (
    isV1_1RewardsEnabled() &&
    envFlag('EXPO_PUBLIC_ENABLE_DAILY_MISSIONS', false)
  );
}

/**
 * Version 1.1B "Blaze Locker" — earnable, code-driven cosmetic unlocks.
 * Defaults OFF so Version 1.0 / 1.1A behavior is unchanged until this is
 * explicitly enabled. Never gates paid purchases — RevenueCat/store pricing
 * stays governed exclusively by isStorePurchasesEnabled().
 */
export function isV1_1LockerEnabled(): boolean {
  return envFlag('EXPO_PUBLIC_ENABLE_V1_1_LOCKER', false);
}

/**
 * Version 1.2A "Visual Theme System Foundation" — master switch for the
 * new theme/asset-manifest architecture. When false, every themed
 * component and hook falls back to the exact Version 1.1 classic
 * visuals; nothing in `src/themes/` is bypassed by disabling this, it is
 * simply never asked to resolve anything but classic.
 */
export function isV1_2VisualSystemEnabled(): boolean {
  return envFlag('EXPO_PUBLIC_ENABLE_V1_2_VISUAL_SYSTEM', false);
}

/**
 * Developer-only Theme Preview screen. Requires BOTH this flag AND a
 * development build (`__DEV__`) — never reachable from production
 * navigation regardless of this flag's value.
 */
export function isThemePreviewDevEnabled(): boolean {
  const isDev = typeof __DEV__ !== 'undefined' && __DEV__;
  return isDev && envFlag('EXPO_PUBLIC_ENABLE_THEME_PREVIEW_DEV', false);
}

/** Board-effect overlay (card_placed/exact_21/five_card_clear/bust/etc. visual queue). */
export function isBoardEffectsEnabled(): boolean {
  return isV1_2VisualSystemEnabled() && envFlag('EXPO_PUBLIC_ENABLE_BOARD_EFFECTS', false);
}

/** Victory-effect overlay (standard win / new high score celebration). */
export function isVictoryEffectsEnabled(): boolean {
  return isV1_2VisualSystemEnabled() && envFlag('EXPO_PUBLIC_ENABLE_VICTORY_EFFECTS', false);
}

/**
 * Version 1.3A "Daily Challenge" master switch. When false, Solo Play
 * remains fully available and no challenge navigation or requests occur.
 */
export function isDailyChallengeEnabled(): boolean {
  return envFlag('EXPO_PUBLIC_ENABLE_DAILY_CHALLENGE', false);
}

export function isDailyChallengeRankedEnabled(): boolean {
  return (
    isDailyChallengeEnabled() &&
    envFlag('EXPO_PUBLIC_ENABLE_DAILY_CHALLENGE_RANKED', false)
  );
}

export function isDailyChallengePracticeEnabled(): boolean {
  return (
    isDailyChallengeEnabled() &&
    envFlag('EXPO_PUBLIC_ENABLE_DAILY_CHALLENGE_PRACTICE', false)
  );
}

export function isDailyLeaderboardEnabled(): boolean {
  return (
    isDailyChallengeEnabled() &&
    envFlag('EXPO_PUBLIC_ENABLE_DAILY_LEADERBOARD', false)
  );
}
