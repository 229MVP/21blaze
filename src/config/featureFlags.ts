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
  // Never show purchase diagnostics in production store builds.
  if (isProductionBuild()) {
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

export function isMonetizationTestMode(): boolean {
  return typeof __DEV__ !== 'undefined' && __DEV__;
}

export function isProgressionBetaEnabled(): boolean {
  return envFlag('EXPO_PUBLIC_ENABLE_PROGRESSION_BETA', false);
}

export function isDailyRewardsEnabled(): boolean {
  return (
    isProgressionBetaEnabled() &&
    envFlag('EXPO_PUBLIC_ENABLE_DAILY_REWARDS', false)
  );
}

export function isDailyMissionsEnabled(): boolean {
  return (
    isProgressionBetaEnabled() &&
    envFlag('EXPO_PUBLIC_ENABLE_DAILY_MISSIONS', false)
  );
}
