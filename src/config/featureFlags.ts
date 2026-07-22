/**
 * Client UX flags only. Server authorization remains the final authority.
 * Never treat these as a security boundary.
 */

function envFlag(name: string, defaultValue = true): boolean {
  const value = process.env[name];
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }
  const normalized = value.trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes';
}

export function isRankedBetaEnabled(): boolean {
  return envFlag('EXPO_PUBLIC_ENABLE_RANKED_BETA', true);
}

export function isMonetizationBetaEnabled(): boolean {
  return envFlag('EXPO_PUBLIC_ENABLE_MONETIZATION_BETA', true);
}

export function isRewardedAdsEnabled(): boolean {
  return (
    isMonetizationBetaEnabled() && envFlag('EXPO_PUBLIC_ENABLE_REWARDED_ADS', true)
  );
}

export function isInterstitialAdsEnabled(): boolean {
  return (
    isMonetizationBetaEnabled() &&
    envFlag('EXPO_PUBLIC_ENABLE_INTERSTITIAL_ADS', true)
  );
}

export function isStorePurchasesEnabled(): boolean {
  return (
    isMonetizationBetaEnabled() &&
    envFlag('EXPO_PUBLIC_ENABLE_STORE_PURCHASES', true)
  );
}

export function isMonetizationTestMode(): boolean {
  return typeof __DEV__ !== 'undefined' && __DEV__;
}

export function isProgressionBetaEnabled(): boolean {
  return envFlag('EXPO_PUBLIC_ENABLE_PROGRESSION_BETA', true);
}

export function isDailyRewardsEnabled(): boolean {
  return (
    isProgressionBetaEnabled() &&
    envFlag('EXPO_PUBLIC_ENABLE_DAILY_REWARDS', true)
  );
}

export function isDailyMissionsEnabled(): boolean {
  return (
    isProgressionBetaEnabled() &&
    envFlag('EXPO_PUBLIC_ENABLE_DAILY_MISSIONS', true)
  );
}
