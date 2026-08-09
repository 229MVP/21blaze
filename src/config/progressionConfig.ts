/**
 * Typed progression configuration for Retention & Progression Beta 0.5B.
 * Client flags are not security boundaries — server remains authoritative.
 */

import {
  getXpRequiredForLevel as curveXpRequired,
  XP_MAX_LEVEL,
} from '../progression/xpCurve';
import { xpAmountForSource } from '../progression/xpSources';

export const PROGRESSION_CONFIG = {
  maxLevel: XP_MAX_LEVEL,
  dailyMissionCount: 3,
  dailyRewardCycleLength: 7,
  /** Minimum hours between daily claims. */
  minDailyClaimIntervalHours: 20,
  /** Maximum hours after last claim to continue the streak. */
  maxStreakContinuationHours: 48,
  matchXp: {
    solo: xpAmountForSource('SOLO_COMPLETION'),
    casual: 75,
    ranked: 100,
    dailyChallenge: xpAmountForSource('DAILY_CHALLENGE_COMPLETION'),
  },
} as const;

export type ProgressionConfig = typeof PROGRESSION_CONFIG;

export function xpRequiredForLevel(level: number): number {
  return curveXpRequired(level);
}
