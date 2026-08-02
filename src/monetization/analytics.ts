/**
 * Lightweight analytics sink. No third-party SDK in this beta.
 * Events must never include receipts, tokens, or payment details.
 */
type AnalyticsPayload = Record<string, string | number | boolean | null | undefined>;

export const PROGRESSION_ANALYTICS_EVENTS = [
  'progression_profile_viewed',
  'xp_earned',
  'level_up',
  'level_reward_granted',
  'daily_reward_viewed',
  'daily_reward_claimed',
  'daily_streak_continued',
  'daily_streak_reset',
  'daily_missions_viewed',
  'daily_mission_completed',
  'daily_mission_claimed',
  'progression_sync_failed',
] as const;

export type ProgressionAnalyticsEvent =
  (typeof PROGRESSION_ANALYTICS_EVENTS)[number];

/** Version 1.1A "Blaze Rewards" — never include amounts derived from an
 * untrusted client value; only server-confirmed numbers. Never log access
 * tokens, raw user IDs, move logs, RevenueCat keys, ad verification
 * secrets, or database records. */
export const V1_1_REWARDS_ANALYTICS_EVENTS = [
  'match_reward_requested',
  'match_reward_confirmed',
  'match_reward_failed',
  'first_match_bonus_granted',
  'active_play_reward_granted',
  'rewarded_ad_started',
  'rewarded_ad_completed',
  'rewarded_ad_verification_failed',
] as const;

export type V1_1RewardsAnalyticsEvent =
  (typeof V1_1_REWARDS_ANALYTICS_EVENTS)[number];

const recent: Array<{ name: string; at: number }> = [];

export function trackEvent(name: string, payload: AnalyticsPayload = {}): void {
  // Keep a tiny in-memory ring for tests / debugging without permanent console logs.
  recent.push({ name, at: Date.now() });
  if (recent.length > 100) {
    recent.shift();
  }
  void payload;
}

export function __getRecentAnalyticsForTests(): ReadonlyArray<{ name: string; at: number }> {
  return recent;
}

export function __clearAnalyticsForTests(): void {
  recent.length = 0;
}
