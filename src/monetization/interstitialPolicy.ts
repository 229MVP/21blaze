/**
 * Version 1.1C — pure interstitial eligibility policy.
 *
 * Deliberately has zero dependency on the ad SDK, AsyncStorage, or React
 * Native so it can be unit tested with `tsx` (see
 * `src/monetization/v1_1cAdsSelfTest.ts`). `src/monetization/
 * interstitialAdService.ts` is the only caller that combines this pure
 * decision with real persisted state and the ad SDK.
 */

export type InterstitialScreen =
  | 'home'
  | 'countdown'
  | 'gameplay'
  | 'pause'
  | 'results'
  | 'rewardSync'
  | 'cosmeticUnlock'
  | 'dailyReward'
  | 'missionClaim'
  | 'auth'
  | 'liveDuel'
  | 'ranked'
  | 'dailyChallenge'
  | 'asyncChallenge'
  | 'leaderboard'
  | 'adShowing'
  | 'other';

export type InterstitialEligibilityContext = {
  /** Ads/interstitials master toggles. */
  interstitialAdsEnabled: boolean;
  isWeb: boolean;
  hasRemoveAds: boolean;
  /** Never show during the player's very first app session. */
  isFirstAppSession: boolean;
  /** Completed *Solo* matches since the last interstitial was shown. */
  completedEligibleMatches: number;
  /** Epoch ms of the last interstitial shown, or null if never shown. */
  lastShownAtMs: number | null;
  /** Current time, injected so eligibility never reads the device clock internally. */
  nowMs: number;
  /** How many interstitials have already been shown on `utcDailyKey`. */
  utcDailyCount: number;
  /** The UTC calendar day (yyyy-mm-dd) `utcDailyCount` was accumulated for. */
  utcDailyKey: string | null;
  /** Today's UTC calendar day (yyyy-mm-dd), computed by the caller from `nowMs`. */
  todayUtcKey: string;
  /** The screen the player is currently on / transitioning from. */
  currentScreen: InterstitialScreen;
  /** Epoch ms a rewarded ad was last shown/interacted with, or null. */
  lastRewardedAdAtMs: number | null;
};

export type InterstitialEligibilityResult =
  | { eligible: true }
  | { eligible: false; reason: string };

export const INTERSTITIAL_POLICY = {
  matchesRequired: 3,
  minIntervalMs: 10 * 60 * 1000,
  maxPerUtcDay: 3,
  /** Buffer after any rewarded-ad interaction before an interstitial may show. */
  minGapAfterRewardedAdMs: 60 * 1000,
} as const;

const NEVER_DURING_SCREENS: ReadonlySet<InterstitialScreen> = new Set([
  'countdown',
  'gameplay',
  'pause',
  'results',
  'rewardSync',
  'cosmeticUnlock',
  'dailyReward',
  'missionClaim',
  'auth',
  'liveDuel',
  'ranked',
  'dailyChallenge',
  'asyncChallenge',
  'leaderboard',
  'adShowing',
]);

/**
 * Pure decision — never mutates state, never touches the ad SDK. Callers
 * are responsible for actually loading/showing an ad only after this
 * returns `{ eligible: true }`.
 */
export function isInterstitialEligible(
  context: InterstitialEligibilityContext,
): InterstitialEligibilityResult {
  if (!context.interstitialAdsEnabled) {
    return { eligible: false, reason: 'interstitial_ads_disabled' };
  }
  if (context.isWeb) {
    return { eligible: false, reason: 'unsupported_platform' };
  }
  if (context.hasRemoveAds) {
    return { eligible: false, reason: 'remove_ads_entitlement' };
  }
  if (context.isFirstAppSession) {
    return { eligible: false, reason: 'first_app_session' };
  }
  if (NEVER_DURING_SCREENS.has(context.currentScreen)) {
    return { eligible: false, reason: `blocked_screen:${context.currentScreen}` };
  }
  if (context.completedEligibleMatches < INTERSTITIAL_POLICY.matchesRequired) {
    return { eligible: false, reason: 'not_enough_matches' };
  }
  if (
    context.lastShownAtMs !== null &&
    context.nowMs - context.lastShownAtMs < INTERSTITIAL_POLICY.minIntervalMs
  ) {
    return { eligible: false, reason: 'cooldown_active' };
  }
  if (
    context.lastRewardedAdAtMs !== null &&
    context.nowMs - context.lastRewardedAdAtMs < INTERSTITIAL_POLICY.minGapAfterRewardedAdMs
  ) {
    return { eligible: false, reason: 'recent_rewarded_ad' };
  }
  const dailyCountToday =
    context.utcDailyKey === context.todayUtcKey ? context.utcDailyCount : 0;
  if (dailyCountToday >= INTERSTITIAL_POLICY.maxPerUtcDay) {
    return { eligible: false, reason: 'daily_max_reached' };
  }
  return { eligible: true };
}

export function utcDayKey(nowMs: number): string {
  return new Date(nowMs).toISOString().slice(0, 10);
}
