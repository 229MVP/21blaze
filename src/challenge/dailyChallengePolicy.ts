import type {
  DailyChallengeConfig,
  DailyChallengeRankedAttempt,
  DailyChallengeSession,
} from '../game/challenge/types';

export type DailyChallengeUiStatus =
  | 'loading'
  | 'available'
  | 'in_progress'
  | 'completed'
  | 'practice_available'
  | 'abandoned'
  | 'unavailable'
  | 'offline'
  | 'error'
  | 'sign_in_required'
  | 'disabled';

export function deriveDailyChallengeUiStatus(input: {
  challenge: DailyChallengeConfig | null;
  rankedAttempt: DailyChallengeRankedAttempt | null;
  activeSession: DailyChallengeSession | null;
  offline: boolean;
  errorMessage: string | null;
  authOnline: boolean;
}): DailyChallengeUiStatus {
  if (!input.authOnline && !input.activeSession) {
    return 'sign_in_required';
  }

  if (input.errorMessage && !input.challenge) {
    return input.offline ? 'offline' : 'error';
  }

  if (input.offline && !input.challenge) {
    return 'offline';
  }

  if (!input.challenge) {
    return 'loading';
  }

  if (input.challenge.status === 'closed') {
    return 'disabled';
  }

  if (input.activeSession?.attemptType === 'ranked') {
    return 'in_progress';
  }

  if (input.rankedAttempt?.status === 'completed') {
    return input.activeSession?.attemptType === 'practice' ? 'practice_available' : 'completed';
  }

  if (
    input.rankedAttempt?.status === 'abandoned' ||
    input.rankedAttempt?.status === 'rejected' ||
    input.rankedAttempt?.status === 'expired' ||
    input.rankedAttempt?.status === 'invalid'
  ) {
    return 'abandoned';
  }

  if (
    input.rankedAttempt?.status === 'created' ||
    input.rankedAttempt?.status === 'started'
  ) {
    return 'in_progress';
  }

  return 'available';
}

export function isCachedDailyChallengeValid(
  cached: { challenge: DailyChallengeConfig; cachedAtMs: number } | null,
  nowMs: number,
): cached is { challenge: DailyChallengeConfig; cachedAtMs: number } {
  if (!cached?.challenge?.challengeDate) {
    return false;
  }
  const today = new Date(nowMs).toISOString().slice(0, 10);
  return cached.challenge.challengeDate === today;
}
