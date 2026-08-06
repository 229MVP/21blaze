import { supabase } from '../lib/supabase';
import { withTimeout, DailyChallengeServiceError } from './dailyChallengeService';

const REQUEST_TIMEOUT_MS = 12000;

export type ChallengeRewardStatus = {
  challengeDate: string;
  participation: { granted: boolean };
  placement: {
    finalized: boolean;
    granted: boolean;
    pending?: boolean;
    rank?: number | null;
    coins_if_finalized?: number;
  };
  weekly: {
    weekStart: string;
    challengePoints: number;
    currentTier: string | null;
    coinsForTier: number;
    previousWeekStart: string;
    previousWeekPoints: number;
    previousWeekTier: string | null;
    previousWeekFinalized: boolean;
    previousWeekClaimable: boolean;
    previousWeekCoins: number;
  };
  streak: {
    current: number;
    longest: number;
    lastCompletedDate: string | null;
  };
  serverTime: string;
};

async function invokeChallenge<T>(body: Record<string, unknown>): Promise<T> {
  const invoke = supabase.functions.invoke('daily-challenge', { body });
  const { data, error } = await withTimeout(invoke, REQUEST_TIMEOUT_MS, 'daily-challenge');

  if (error) {
    throw new DailyChallengeServiceError(error.message || 'Challenge request failed.');
  }

  if (!data || typeof data !== 'object') {
    throw new DailyChallengeServiceError('Invalid challenge response.');
  }

  const candidate = data as Record<string, unknown>;
  if (typeof candidate.error === 'string') {
    throw new DailyChallengeServiceError(candidate.error);
  }

  return data as T;
}

export async function fetchChallengeRewardStatus(
  challengeDate?: string,
): Promise<ChallengeRewardStatus> {
  return invokeChallenge({
    action: 'get_reward_status',
    ...(challengeDate ? { challengeDate } : {}),
  });
}

export async function claimWeeklyChallengeReward(weekStart?: string): Promise<{
  claimed: boolean;
  tier?: string;
  blazeCoins?: number;
  challengePoints?: number;
  reason?: string;
}> {
  return invokeChallenge({
    action: 'claim_weekly_reward',
    ...(weekStart ? { weekStart } : {}),
  });
}
