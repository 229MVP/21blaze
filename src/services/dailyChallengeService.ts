import { supabase } from '../lib/supabase';
import type {
  DailyChallengeAttemptType,
  DailyChallengeConfig,
  DailyChallengeSession,
  DailyChallengeVerifiedResult,
} from '../game/challenge/types';
import type { MoveLogEntry } from '../online/types';

const REQUEST_TIMEOUT_MS = 8000;

export class DailyChallengeServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DailyChallengeServiceError';
  }
}

export function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new DailyChallengeServiceError(`${label} timed out.`));
    }, ms);

    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error: unknown) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

export type DailyChallengeAttemptSummary = {
  attemptId: string;
  challengeId: string;
  attemptType: DailyChallengeAttemptType;
  status: string;
  startedAt: string | null;
  completedAt: string | null;
  firstMoveAt: string | null;
  verifiedScore: number | null;
  verificationStatus: string | null;
  scoringVersion: number | null;
};

export type DailyChallengeStatusResponse = {
  serverTime: string;
  challenge: DailyChallengeConfig;
  rankedAttempt: DailyChallengeAttemptSummary | null;
  streak: {
    current: number;
    longest: number;
    lastCompletedDate: string | null;
  };
};

export type StartDailyChallengeResponse = {
  challenge: DailyChallengeConfig;
  attempt: DailyChallengeAttemptSummary;
  serverTime: string;
  expiresAt: string;
};

export type CompleteDailyChallengeResponse = {
  verified: boolean;
  attempt?: DailyChallengeAttemptSummary;
  result?: DailyChallengeVerifiedResult;
  rejectionReason?: string;
  streak?: { currentStreak: number; longestStreak: number };
  participationReward?: { granted: boolean; blazeCoins: number; xp: number };
};

export type DailyChallengeLeaderboardEntry = {
  rank: number;
  playerName: string;
  score: number;
  lanesCleared: number;
  exact21Count: number;
  fiveCardClears: number;
  bustCount: number;
  bestMultiplier: number;
  elapsedTimeMs: number;
  isCurrentPlayer: boolean;
};

async function invokeDailyChallenge<T>(body: Record<string, unknown>): Promise<T> {
  const invoke = supabase.functions.invoke('daily-challenge', { body });
  const { data, error } = await withTimeout(invoke, REQUEST_TIMEOUT_MS, 'daily-challenge');

  if (error) {
    throw new DailyChallengeServiceError(error.message || 'Daily Challenge request failed.');
  }

  if (!data || typeof data !== 'object') {
    throw new DailyChallengeServiceError('Invalid daily-challenge response.');
  }

  const candidate = data as Record<string, unknown>;
  if (typeof candidate.error === 'string') {
    throw new DailyChallengeServiceError(candidate.error);
  }

  return data as T;
}

export async function fetchDailyChallengeStatus(): Promise<DailyChallengeStatusResponse> {
  return invokeDailyChallenge({ action: 'get_status' });
}

export async function startDailyChallengeAttempt(
  attemptType: DailyChallengeAttemptType,
): Promise<StartDailyChallengeResponse> {
  return invokeDailyChallenge({ action: 'start_attempt', attemptType });
}

export async function recordDailyChallengeFirstMove(
  attemptId: string,
): Promise<{ attempt: DailyChallengeAttemptSummary }> {
  return invokeDailyChallenge({ action: 'record_first_move', attemptId });
}

export async function completeDailyChallengeAttempt(
  attemptId: string,
  moves: MoveLogEntry[],
): Promise<CompleteDailyChallengeResponse> {
  return invokeDailyChallenge({ action: 'complete_attempt', attemptId, moves });
}

export async function abandonDailyChallengeAttempt(
  attemptId: string,
): Promise<{ attempt: { attemptId: string; status: string } }> {
  return invokeDailyChallenge({ action: 'abandon_attempt', attemptId });
}

export async function fetchDailyChallengeLeaderboard(
  challengeDate?: string,
): Promise<{
  challengeDate: string;
  challengeId: string;
  entries: DailyChallengeLeaderboardEntry[];
}> {
  return invokeDailyChallenge({
    action: 'get_leaderboard',
    ...(challengeDate ? { challengeDate } : {}),
  });
}

export function toDailyChallengeSession(
  start: StartDailyChallengeResponse,
): DailyChallengeSession {
  return {
    challengeId: start.challenge.challengeId,
    attemptId: start.attempt.attemptId,
    attemptType: start.attempt.attemptType,
    seed: start.challenge.seed,
    rulesVersion: start.challenge.rulesVersion,
    scoringVersion: start.challenge.scoringVersion,
    serverStartTime: start.serverTime,
    expiresAt: start.expiresAt,
    challengeDate: start.challenge.challengeDate,
  };
}
