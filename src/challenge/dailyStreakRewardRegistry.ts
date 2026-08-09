/**
 * Central Daily Blaze streak milestone registry (Version 1.3 Phase 3).
 * Server SQL mirrors these amounts in `daily_streak_milestone_coins`.
 * UI reads from here — never hardcode reward values in screens.
 */

export type DailyStreakRewardType = 'blaze_coins' | 'cosmetic_entitlement' | 'future_sabotage_unlock';

export type DailyStreakRewardDefinition = {
  milestone: number;
  blazeCoins?: number;
  cosmeticEntitlement?: string;
  futureSabotageUnlock?: string;
  label: string;
};

/** Milestone reward schedule — cosmetic hooks are not granted in Phase 3 UI. */
export const DAILY_STREAK_REWARD_REGISTRY: DailyStreakRewardDefinition[] = [
  { milestone: 1, blazeCoins: 25, label: '1 Day' },
  { milestone: 3, blazeCoins: 50, label: '3 Days' },
  { milestone: 5, blazeCoins: 75, label: '5 Days' },
  { milestone: 7, blazeCoins: 100, label: '7 Days' },
  {
    milestone: 14,
    blazeCoins: 150,
    cosmeticEntitlement: 'future_streak_14_cosmetic',
    label: '14 Days',
  },
  {
    milestone: 30,
    blazeCoins: 300,
    cosmeticEntitlement: 'future_streak_30_cosmetic',
    label: '30 Days',
  },
];

export const DAILY_STREAK_MILESTONES = DAILY_STREAK_REWARD_REGISTRY.map((r) => r.milestone);

export function getStreakRewardForMilestone(milestone: number): DailyStreakRewardDefinition | null {
  return DAILY_STREAK_REWARD_REGISTRY.find((r) => r.milestone === milestone) ?? null;
}

export function getNextStreakMilestone(currentStreak: number): DailyStreakRewardDefinition | null {
  return DAILY_STREAK_REWARD_REGISTRY.find((r) => r.milestone > currentStreak) ?? null;
}

/** Architecture hook for future sabotage rewards — not obtainable in 1.3. */
export const FUTURE_SABOTAGE_REWARD_KEYS = [
  'future_sabotage_time_burn',
  'future_sabotage_blind_draw',
  'future_sabotage_frozen_lane',
  'future_defense_blaze_shield',
] as const;
