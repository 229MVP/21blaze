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
