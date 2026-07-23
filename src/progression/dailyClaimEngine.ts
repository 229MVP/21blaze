import { PROGRESSION_CONFIG } from '../config/progressionConfig';
import { dailyRewardForStreakDay, streakDayFromStreak } from './rewards';

const HOUR_MS = 60 * 60 * 1000;

export type DailyClaimDecision =
  | {
      eligible: true;
      continuesStreak: boolean;
      resetsStreak: boolean;
      newStreak: number;
      streakDay: number;
      reward: ReturnType<typeof dailyRewardForStreakDay>;
      nextClaimAt: string;
    }
  | {
      eligible: false;
      reason: 'too_soon' | 'disabled';
      nextClaimAt: string | null;
      currentStreak: number;
      nextStreakDay: number;
      reward: ReturnType<typeof dailyRewardForStreakDay>;
    };

/**
 * Pure daily-claim eligibility using server timestamps only.
 */
export function evaluateDailyClaim(input: {
  nowMs: number;
  lastClaimAtMs: number | null;
  currentStreak: number;
}): DailyClaimDecision {
  const minIntervalMs =
    PROGRESSION_CONFIG.minDailyClaimIntervalHours * HOUR_MS;
  const maxContinueMs =
    PROGRESSION_CONFIG.maxStreakContinuationHours * HOUR_MS;

  const { nowMs, lastClaimAtMs, currentStreak } = input;

  if (lastClaimAtMs !== null && nowMs - lastClaimAtMs < minIntervalMs) {
    const nextClaimAt = new Date(lastClaimAtMs + minIntervalMs).toISOString();
    const previewDay = streakDayFromStreak(currentStreak + 1);
    return {
      eligible: false,
      reason: 'too_soon',
      nextClaimAt,
      currentStreak,
      nextStreakDay: previewDay,
      reward: dailyRewardForStreakDay(previewDay),
    };
  }

  let continuesStreak = false;
  let resetsStreak = false;
  let newStreak = 1;

  if (lastClaimAtMs === null) {
    newStreak = 1;
  } else if (nowMs - lastClaimAtMs <= maxContinueMs) {
    continuesStreak = true;
    newStreak = currentStreak + 1;
  } else {
    resetsStreak = true;
    newStreak = 1;
  }

  const streakDay = streakDayFromStreak(newStreak);
  return {
    eligible: true,
    continuesStreak,
    resetsStreak,
    newStreak,
    streakDay,
    reward: dailyRewardForStreakDay(streakDay),
    nextClaimAt: new Date(nowMs + minIntervalMs).toISOString(),
  };
}

export function matchXpForMode(
  mode: 'solo' | 'casual' | 'ranked',
): number {
  return PROGRESSION_CONFIG.matchXp[mode];
}
