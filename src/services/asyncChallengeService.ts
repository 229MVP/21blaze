import { supabase } from '../lib/supabase';
import type { MoveLogEntry } from '../online/types';
import type {
  AsyncChallengeInvitePreview,
  AsyncChallengeSession,
  AsyncChallengeSummary,
  AsyncChallengeVerifiedStats,
} from '../async/types';

const REQUEST_TIMEOUT_MS = 8000;

export class AsyncChallengeServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AsyncChallengeServiceError';
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new AsyncChallengeServiceError(`${label} timed out.`));
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

async function invokeAsyncChallenge<T>(body: Record<string, unknown>): Promise<T> {
  const invoke = supabase.functions.invoke('async-challenge', { body });
  const { data, error } = await withTimeout(invoke, REQUEST_TIMEOUT_MS, 'async-challenge');

  if (error) {
    throw new AsyncChallengeServiceError(error.message || 'Async challenge request failed.');
  }

  if (!data || typeof data !== 'object') {
    throw new AsyncChallengeServiceError('Invalid async-challenge response.');
  }

  const candidate = data as Record<string, unknown>;
  if (typeof candidate.error === 'string') {
    throw new AsyncChallengeServiceError(candidate.error);
  }

  return data as T;
}

export async function fetchAsyncChallenges(): Promise<{
  serverTime: string;
  challenges: AsyncChallengeSummary[];
}> {
  return invokeAsyncChallenge({ action: 'list_challenges' });
}

export async function fetchAsyncChallenge(challengeId: string): Promise<{
  serverTime: string;
  challenge: AsyncChallengeSummary;
}> {
  return invokeAsyncChallenge({ action: 'get_challenge', challengeId });
}

export async function resolveAsyncInvite(inviteCode: string): Promise<{
  serverTime: string;
  inviteCode: string;
  preview: AsyncChallengeInvitePreview;
  challenge: AsyncChallengeSummary | null;
}> {
  return invokeAsyncChallenge({ action: 'resolve_invite', inviteCode });
}

export async function createAsyncChallenge(): Promise<{
  serverTime: string;
  inviteCode: string;
  challenge: AsyncChallengeSummary;
}> {
  return invokeAsyncChallenge({ action: 'create_challenge' });
}

export async function acceptAsyncChallenge(inviteCode: string): Promise<{
  serverTime: string;
  challenge: AsyncChallengeSummary;
}> {
  return invokeAsyncChallenge({ action: 'accept_challenge', inviteCode });
}

export async function startAsyncChallengeAttempt(challengeId: string): Promise<{
  serverTime: string;
  attemptId: string;
  expiresAt: string;
  config: {
    challengeId: string;
    seed: number;
    rulesVersion: number;
    scoringVersion: number;
    durationSeconds: number;
  };
}> {
  return invokeAsyncChallenge({ action: 'start_attempt', challengeId });
}

export async function recordAsyncChallengeFirstMove(attemptId: string): Promise<{
  attemptId: string;
  status: string;
}> {
  return invokeAsyncChallenge({ action: 'record_first_move', attemptId });
}

export async function abandonAsyncChallengeAttempt(attemptId: string): Promise<{
  attemptId: string;
  status: string;
}> {
  return invokeAsyncChallenge({ action: 'abandon_attempt', attemptId });
}

export async function completeAsyncChallengeAttempt(
  attemptId: string,
  moves: MoveLogEntry[],
): Promise<{
  verified: boolean;
  challenge?: AsyncChallengeSummary;
  result?: AsyncChallengeVerifiedStats;
  rejectionReason?: string;
  waitingForOpponent?: boolean;
  opponentResultVisible?: boolean;
}> {
  return invokeAsyncChallenge({ action: 'complete_attempt', attemptId, moves });
}

export function toAsyncChallengeSession(
  start: Awaited<ReturnType<typeof startAsyncChallengeAttempt>>,
  challenge: AsyncChallengeSummary,
  viewerUserId: string,
): AsyncChallengeSession {
  const participantRole =
    challenge.creator.userId === viewerUserId ? 'creator' : 'opponent';

  return {
    challengeId: start.config.challengeId,
    attemptId: start.attemptId,
    participantRole,
    seed: start.config.seed,
    rulesVersion: start.config.rulesVersion,
    scoringVersion: start.config.scoringVersion,
    serverStartTime: start.serverTime,
    expiresAt: start.expiresAt,
    challengeExpiresAt: challenge.expiresAt,
  };
}
