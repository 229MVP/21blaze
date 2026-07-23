/**
 * Typed progression configuration for Retention & Progression Beta 0.5B.
 * Client flags are not security boundaries — server remains authoritative.
 */

export const PROGRESSION_CONFIG = {
  maxLevel: 50,
  dailyMissionCount: 3,
  dailyRewardCycleLength: 7,
  /** Minimum hours between daily claims. */
  minDailyClaimIntervalHours: 20,
  /** Maximum hours after last claim to continue the streak. */
  maxStreakContinuationHours: 48,
  matchXp: {
    solo: 50,
    casual: 75,
    ranked: 100,
  },
} as const;

export type ProgressionConfig = typeof PROGRESSION_CONFIG;

export function xpRequiredForLevel(level: number): number {
  if (level < 1) {
    return 0;
  }
  if (level >= PROGRESSION_CONFIG.maxLevel) {
    return 0;
  }
  return 100 + (level - 1) * 25;
}
