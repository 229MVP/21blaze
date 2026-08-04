import { GAME_DURATION_SECONDS } from '../game/constants';

/**
 * Version 1.1A "Blaze Rewards" economy configuration.
 *
 * These values are the client-facing mirror of the server-authoritative
 * SQL functions in `supabase/migrations/0008_v1_1_rewards_economy.sql`
 * (`calculate_v1_1_match_coins`, `calculate_v1_1_active_time_coins`,
 * `daily_reward_for_streak_day`). Keep both in sync.
 *
 * The client NEVER computes a reward amount that is trusted for payout —
 * these values exist for pure unit tests and optimistic-free UI copy only.
 * The server always recomputes and grants the authoritative amount.
 */
export const V1_1_ECONOMY = {
  /** Flat coins for any completed (non-quit) Solo match. */
  soloMatchCompletionCoins: 10,
  /** Additional coins for the first completed Solo match of the UTC day. */
  soloFirstMatchOfDayBonusCoins: 20,
  /** Coins per full active minute of completed-match play. */
  activeTimeCoinsPerMinute: 1,
  /** Maximum active-time coins a player can earn per UTC day. */
  activeTimeMaxCoinsPerDay: 20,
  /** XP for a completed Solo match — unchanged from Version 1.0. */
  soloMatchXp: 50,
} as const;

export type V1_1RewardBreakdown = {
  matchCoins: number;
  firstMatchBonusCoins: number;
  activeTimeCoins: number;
  activeTimeSeconds: number;
  totalCoins: number;
};

/**
 * Pure mirror of `calculate_v1_1_match_coins` — completed-match coins plus
 * the first-of-day bonus when applicable. Never trusted for payout.
 */
export function calculateV1_1MatchCoins(isFirstOfDay: boolean): number {
  return (
    V1_1_ECONOMY.soloMatchCompletionCoins +
    (isFirstOfDay ? V1_1_ECONOMY.soloFirstMatchOfDayBonusCoins : 0)
  );
}

/**
 * Pure mirror of `calculate_v1_1_active_time_coins` — 1 coin per full active
 * minute, capped by the remaining daily active-time budget.
 */
export function calculateV1_1ActiveTimeCoins(
  activeSeconds: number,
  alreadyGrantedTodayCoins: number,
): number {
  if (!Number.isFinite(activeSeconds) || activeSeconds <= 0) {
    return 0;
  }
  const activeMinutes = Math.floor(activeSeconds / 60);
  const remainingBudget = Math.max(
    0,
    V1_1_ECONOMY.activeTimeMaxCoinsPerDay - Math.max(0, alreadyGrantedTodayCoins),
  );
  return Math.max(
    0,
    Math.min(activeMinutes * V1_1_ECONOMY.activeTimeCoinsPerMinute, remainingBudget),
  );
}

/**
 * Derives eligible active-play seconds for a completed match from two
 * server-verified sources, taking the smaller of the two so neither a
 * padded move-log timestamp nor a long-paused wall clock can inflate the
 * reward:
 *  - Replay-derived elapsed time (GAME_DURATION_SECONDS - timeRemainingSeconds),
 *    which by construction excludes countdown and pause (the match timer
 *    only advances while running).
 *  - Real wall-clock time between match start and submission, which bounds
 *    the maximum possible active time regardless of client-reported values.
 */
export function deriveActiveSeconds(input: {
  timeRemainingSeconds: number;
  wallClockElapsedSeconds: number;
}): number {
  const replayDerived = Math.max(
    0,
    GAME_DURATION_SECONDS - Math.max(0, input.timeRemainingSeconds),
  );
  const wallClockBounded = Math.max(
    0,
    Math.min(input.wallClockElapsedSeconds, GAME_DURATION_SECONDS),
  );
  return Math.min(replayDerived, wallClockBounded);
}

/**
 * Pure decision for whether the Results screen should call the server for
 * a Version 1.1A match reward. Extracted so the gating logic (never call
 * for quit matches, never call for local-only matches, wait for online
 * verification to settle before deciding) is independently unit-testable.
 */
export function shouldSyncV1_1Reward(input: {
  v1_1RewardsOn: boolean;
  matchId: string | null | undefined;
  gameOverReason: string | null | undefined;
  eligibility: 'verified' | 'localOnly' | string;
}): 'sync' | 'local' | 'wait' | 'skip' {
  if (!input.v1_1RewardsOn || !input.matchId || input.gameOverReason === 'quit') {
    return 'skip';
  }
  if (input.eligibility === 'localOnly') {
    return 'local';
  }
  if (input.eligibility !== 'verified') {
    return 'wait';
  }
  return 'sync';
}

/**
 * Full itemized breakdown for a completed Solo match, given server-known
 * inputs. Used for pure unit tests and optimistic display copy only.
 */
export function calculateV1_1RewardBreakdown(input: {
  isQuit: boolean;
  isFirstOfDay: boolean;
  timeRemainingSeconds: number;
  wallClockElapsedSeconds: number;
  activeTimeCoinsAlreadyGrantedToday: number;
}): V1_1RewardBreakdown {
  if (input.isQuit) {
    return {
      matchCoins: 0,
      firstMatchBonusCoins: 0,
      activeTimeCoins: 0,
      activeTimeSeconds: 0,
      totalCoins: 0,
    };
  }

  const matchCoins = V1_1_ECONOMY.soloMatchCompletionCoins;
  const firstMatchBonusCoins = input.isFirstOfDay
    ? V1_1_ECONOMY.soloFirstMatchOfDayBonusCoins
    : 0;
  const activeTimeSeconds = deriveActiveSeconds({
    timeRemainingSeconds: input.timeRemainingSeconds,
    wallClockElapsedSeconds: input.wallClockElapsedSeconds,
  });
  const activeTimeCoins = calculateV1_1ActiveTimeCoins(
    activeTimeSeconds,
    input.activeTimeCoinsAlreadyGrantedToday,
  );

  return {
    matchCoins,
    firstMatchBonusCoins,
    activeTimeCoins,
    activeTimeSeconds,
    totalCoins: matchCoins + firstMatchBonusCoins + activeTimeCoins,
  };
}
