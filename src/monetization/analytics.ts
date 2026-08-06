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

/** Version 1.1B "Blaze Locker" — never include access tokens, raw UUIDs,
 * full wallet records, database responses, or secrets in these payloads. */
export const V1_1B_LOCKER_ANALYTICS_EVENTS = [
  'blaze_locker_viewed',
  'cosmetic_previewed',
  'cosmetic_unlock_started',
  'cosmetic_unlock_completed',
  'cosmetic_unlock_failed',
  'cosmetic_equipped',
  'insufficient_coins_shown',
  'seven_day_title_unlocked',
] as const;

export type V1_1BLockerAnalyticsEvent = (typeof V1_1B_LOCKER_ANALYTICS_EVENTS)[number];

/** Version 1.1C "Ads, Retention Polish, and TestFlight RC" — never log
 * secrets, access tokens, raw callback payloads, or full UUIDs. */
export const V1_1C_ANALYTICS_EVENTS = [
  'ump_status_updated',
  'ump_form_presented',
  'privacy_options_opened',
  'interstitial_eligible',
  'interstitial_loaded',
  'interstitial_shown',
  'interstitial_dismissed',
  'interstitial_failed',
  'rewarded_ad_requested',
  'rewarded_ad_loaded',
  'rewarded_ad_completed',
  'rewarded_ad_dismissed',
  'rewarded_ad_verification_started',
  'rewarded_ad_verified',
  'rewarded_ad_verification_failed',
  'daily_streak_viewed',
  'daily_mission_viewed',
  'locker_affordability_reached',
  'version_1_1_whats_new_viewed',
] as const;

export type V1_1CAnalyticsEvent = (typeof V1_1C_ANALYTICS_EVENTS)[number];

export const DAILY_CHALLENGE_ANALYTICS_EVENTS = [
  'daily_challenge_viewed',
  'daily_challenge_ranked_started',
  'daily_challenge_practice_started',
  'daily_challenge_first_move',
  'daily_challenge_completed',
  'daily_challenge_abandoned',
  'daily_challenge_verification_started',
  'daily_challenge_verified',
  'daily_challenge_rejected',
  'daily_challenge_result_viewed',
  'daily_challenge_leaderboard_opened',
  'daily_leaderboard_viewed',
  'weekly_leaderboard_viewed',
  'leaderboard_refreshed',
  'leaderboard_page_loaded',
  'leaderboard_nearby_viewed',
  'leaderboard_current_rank_viewed',
  'leaderboard_offline_cache_viewed',
  'challenge_points_awarded',
  'leaderboard_finalized',
  'challenge_participation_reward_granted',
  'daily_placement_reward_pending',
  'daily_placement_reward_granted',
  'weekly_reward_progress_viewed',
  'weekly_reward_claim_started',
  'weekly_reward_claimed',
  'weekly_reward_claim_failed',
  'challenge_streak_increased',
  'challenge_streak_reset',
  'challenge_streak_milestone_granted',
  'challenge_badge_equipped',
  'challenge_title_equipped',
] as const;

export type DailyChallengeAnalyticsEvent =
  (typeof DAILY_CHALLENGE_ANALYTICS_EVENTS)[number];

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
