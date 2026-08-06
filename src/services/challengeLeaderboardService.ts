import { supabase } from '../lib/supabase';
import { DailyChallengeServiceError, withTimeout } from './dailyChallengeService';

const REQUEST_TIMEOUT_MS = 12000;

export type DailyLeaderboardRow = {
  rank: number;
  playerName: string;
  score: number;
  exact21Count: number;
  fiveCardClears: number;
  bustCount: number;
  bestMultiplier: number;
  elapsedTimeMs: number | null;
  challengePoints: number;
  profileFrameId: string;
  playerTitleId: string | null;
  isCurrentPlayer: boolean;
};

export type WeeklyLeaderboardRow = {
  rank: number;
  playerName: string;
  challengePoints: number;
  verifiedDaysCompleted: number;
  bestDailyRank: number;
  totalVerifiedScore: number;
  totalExact21Count: number;
  totalFiveCardClears: number;
  totalBustCount: number;
  profileFrameId: string;
  playerTitleId: string | null;
  isCurrentPlayer: boolean;
};

export type PlayerDailyRank = {
  rank: number;
  score: number;
  challengePoints: number;
  verificationStatus: string;
};

export type PlayerWeeklyRank = {
  rank: number;
  challengePoints: number;
  verifiedDaysCompleted: number;
};

export type DailyLeaderboardResponse = {
  challengeDate: string;
  challengeId: string;
  endsAt: string;
  finalized: boolean;
  totalParticipants: number;
  entries: DailyLeaderboardRow[];
  playerRank: PlayerDailyRank | null;
  serverTime: string;
};

export type WeeklyLeaderboardResponse = {
  weekStart: string;
  weekEnd: string;
  totalParticipants: number;
  entries: WeeklyLeaderboardRow[];
  playerRank: PlayerWeeklyRank | null;
  serverTime: string;
};

async function invokeLeaderboard<T>(body: Record<string, unknown>): Promise<T> {
  const invoke = supabase.functions.invoke('daily-challenge', { body });
  const { data, error } = await withTimeout(invoke, REQUEST_TIMEOUT_MS, 'daily-challenge');

  if (error) {
    throw new DailyChallengeServiceError(error.message || 'Leaderboard request failed.');
  }

  if (!data || typeof data !== 'object') {
    throw new DailyChallengeServiceError('Invalid leaderboard response.');
  }

  const candidate = data as Record<string, unknown>;
  if (typeof candidate.error === 'string') {
    throw new DailyChallengeServiceError(candidate.error);
  }

  return data as T;
}

export async function fetchDailyChallengeLeaderboardFull(
  challengeDate?: string,
  afterRank = 0,
  limit = 100,
): Promise<DailyLeaderboardResponse> {
  return invokeLeaderboard({
    action: 'get_daily_leaderboard',
    ...(challengeDate ? { challengeDate } : {}),
    afterRank,
    limit,
  });
}

export async function fetchWeeklyChallengeLeaderboard(
  weekStart?: string,
  afterRank = 0,
  limit = 100,
): Promise<WeeklyLeaderboardResponse> {
  return invokeLeaderboard({
    action: 'get_weekly_leaderboard',
    ...(weekStart ? { weekStart } : {}),
    afterRank,
    limit,
  });
}

export async function fetchNearbyDailyRanks(
  challengeDate?: string,
  window = 2,
): Promise<{ entries: Array<Pick<DailyLeaderboardRow, 'rank' | 'playerName' | 'score' | 'challengePoints' | 'isCurrentPlayer'>> }> {
  return invokeLeaderboard({
    action: 'get_nearby_daily_ranks',
    ...(challengeDate ? { challengeDate } : {}),
    window,
  });
}

export async function fetchNearbyWeeklyRanks(
  weekStart?: string,
  window = 2,
): Promise<{ entries: Array<Pick<WeeklyLeaderboardRow, 'rank' | 'playerName' | 'challengePoints' | 'isCurrentPlayer'>> }> {
  return invokeLeaderboard({
    action: 'get_nearby_weekly_ranks',
    ...(weekStart ? { weekStart } : {}),
    window,
  });
}
