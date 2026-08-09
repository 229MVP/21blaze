import { supabase } from '../lib/supabase';
import type {
  ClaimStreakRewardResult,
  DailyLeaderboardEntry,
  DailyLeaderboardPage,
  DailyLeaderboardPosition,
  DailyStreakStatus,
  WeeklyLeaderboardEntry,
  WeeklyLeaderboardPage,
  WeeklyLeaderboardPosition,
} from './dailyLeaderboardTypes';

export class DailyLeaderboardClientError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DailyLeaderboardClientError';
  }
}

function mapDailyEntry(raw: Record<string, unknown>): DailyLeaderboardEntry {
  return {
    rank: Number(raw.rank),
    displayName: String(raw.display_name ?? raw.displayName ?? 'Blaze Player'),
    score: Number(raw.score),
    exact21Count: raw.exact_21_count != null ? Number(raw.exact_21_count) : undefined,
    fiveCardClearCount:
      raw.five_card_clear_count != null ? Number(raw.five_card_clear_count) : undefined,
    bustCount: raw.bust_count != null ? Number(raw.bust_count) : undefined,
    completionMs: raw.completion_ms != null ? Number(raw.completion_ms) : undefined,
    profileFrameId:
      typeof raw.profile_frame_id === 'string' ? raw.profile_frame_id : null,
    isCurrentPlayer: Boolean(raw.is_current_player ?? raw.isCurrentPlayer),
  };
}

function mapWeeklyEntry(raw: Record<string, unknown>): WeeklyLeaderboardEntry {
  return {
    rank: Number(raw.rank),
    displayName: String(raw.display_name ?? raw.displayName ?? 'Blaze Player'),
    weeklyScore: Number(raw.weekly_score ?? raw.weeklyScore),
    daysPlayed: Number(raw.days_played ?? raw.daysPlayed),
    bestDailyScore: Number(raw.best_daily_score ?? raw.bestDailyScore),
    profileFrameId:
      typeof raw.profile_frame_id === 'string' ? raw.profile_frame_id : null,
    isCurrentPlayer: Boolean(raw.is_current_player ?? raw.isCurrentPlayer),
  };
}

export async function getDailyLeaderboard(input: {
  challengeId: string;
  limit?: number;
  offset?: number;
}): Promise<DailyLeaderboardPage> {
  const { data, error } = await supabase.rpc('get_daily_leaderboard', {
    p_challenge_id: input.challengeId,
    p_limit: input.limit ?? 50,
    p_offset: input.offset ?? 0,
  });

  if (error) {
    throw new DailyLeaderboardClientError(error.message);
  }

  const payload = data as Record<string, unknown>;
  const entries = Array.isArray(payload.entries)
    ? (payload.entries as Record<string, unknown>[]).map(mapDailyEntry)
    : [];

  return {
    entries,
    totalPlayers: Number(payload.totalPlayers ?? 0),
    limit: Number(payload.limit ?? input.limit ?? 50),
    offset: Number(payload.offset ?? input.offset ?? 0),
  };
}

export async function getMyDailyLeaderboardPosition(
  challengeId: string,
): Promise<DailyLeaderboardPosition> {
  const { data, error } = await supabase.rpc('get_my_daily_leaderboard_position', {
    p_challenge_id: challengeId,
  });

  if (error) {
    throw new DailyLeaderboardClientError(error.message);
  }

  const payload = data as Record<string, unknown>;
  const entryRaw = payload.entry as Record<string, unknown> | null;

  return {
    entry: entryRaw
      ? {
          rank: Number(entryRaw.rank),
          displayName: String(entryRaw.displayName ?? 'Blaze Player'),
          score: Number(entryRaw.score),
          exact21Count:
            entryRaw.exact21Count != null ? Number(entryRaw.exact21Count) : undefined,
          fiveCardClearCount:
            entryRaw.fiveCardClearCount != null
              ? Number(entryRaw.fiveCardClearCount)
              : undefined,
          bustCount: entryRaw.bustCount != null ? Number(entryRaw.bustCount) : undefined,
          completionMs:
            entryRaw.completionMs != null ? Number(entryRaw.completionMs) : undefined,
          profileFrameId:
            typeof entryRaw.profileFrameId === 'string' ? entryRaw.profileFrameId : null,
          isCurrentPlayer: true,
        }
      : null,
    totalPlayers: Number(payload.totalPlayers ?? 0),
  };
}

export async function getWeeklyLeaderboard(input?: {
  weekStart?: string;
  limit?: number;
  offset?: number;
}): Promise<WeeklyLeaderboardPage> {
  const { data, error } = await supabase.rpc('get_weekly_leaderboard', {
    p_week_start: input?.weekStart ?? undefined,
    p_limit: input?.limit ?? 50,
    p_offset: input?.offset ?? 0,
  });

  if (error) {
    throw new DailyLeaderboardClientError(error.message);
  }

  const payload = data as Record<string, unknown>;
  const entries = Array.isArray(payload.entries)
    ? (payload.entries as Record<string, unknown>[]).map(mapWeeklyEntry)
    : [];

  return {
    weekStart: String(payload.weekStart),
    weekEnd: String(payload.weekEnd),
    entries,
    totalPlayers: Number(payload.totalPlayers ?? 0),
    limit: Number(payload.limit ?? input?.limit ?? 50),
    offset: Number(payload.offset ?? input?.offset ?? 0),
  };
}

export async function getMyWeeklyLeaderboardPosition(
  weekStart?: string,
): Promise<WeeklyLeaderboardPosition> {
  const { data, error } = await supabase.rpc('get_my_weekly_leaderboard_position', {
    p_week_start: weekStart ?? undefined,
  });

  if (error) {
    throw new DailyLeaderboardClientError(error.message);
  }

  const payload = data as Record<string, unknown>;
  const entryRaw = payload.entry as Record<string, unknown> | null;

  return {
    weekStart: String(payload.weekStart),
    weekEnd: String(payload.weekEnd),
    entry: entryRaw
      ? {
          rank: Number(entryRaw.rank),
          displayName: String(entryRaw.displayName ?? 'Blaze Player'),
          weeklyScore: Number(entryRaw.weeklyScore),
          daysPlayed: Number(entryRaw.daysPlayed),
          bestDailyScore: Number(entryRaw.bestDailyScore),
          profileFrameId:
            typeof entryRaw.profileFrameId === 'string' ? entryRaw.profileFrameId : null,
          isCurrentPlayer: true,
        }
      : null,
    totalPlayers: Number(payload.totalPlayers ?? 0),
  };
}

export async function getDailyStreakStatus(): Promise<DailyStreakStatus> {
  const { data, error } = await supabase.rpc('get_daily_streak_status');

  if (error) {
    throw new DailyLeaderboardClientError(error.message);
  }

  const payload = data as Record<string, unknown>;
  const rewards = Array.isArray(payload.eligibleRewards)
    ? (payload.eligibleRewards as Record<string, unknown>[]).map((row) => ({
        grantId: String(row.grantId),
        milestone: Number(row.milestone),
        amount: Number(row.amount),
        status: String(row.status),
        sourceId: String(row.sourceId),
      }))
    : [];

  return {
    currentStreak: Number(payload.currentStreak ?? 0),
    longestStreak: Number(payload.longestStreak ?? 0),
    lastCompletedChallengeDate:
      typeof payload.lastCompletedChallengeDate === 'string'
        ? payload.lastCompletedChallengeDate
        : null,
    updatedAt: typeof payload.updatedAt === 'string' ? payload.updatedAt : null,
    eligibleRewards: rewards,
  };
}

export async function claimDailyStreakReward(milestone: number): Promise<ClaimStreakRewardResult> {
  const { data, error } = await supabase.rpc('claim_daily_streak_reward', {
    p_milestone: milestone,
  });

  if (error) {
    throw new DailyLeaderboardClientError(error.message);
  }

  const payload = data as Record<string, unknown>;
  return {
    alreadyClaimed: Boolean(payload.alreadyClaimed),
    milestone: Number(payload.milestone),
    amount: Number(payload.amount),
    balance: payload.balance != null ? Number(payload.balance) : undefined,
  };
}
