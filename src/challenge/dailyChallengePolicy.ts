import type {
  DailyChallengeConfig,
  DailyChallengeSession,
} from '../game/challenge/types';
import type { DailyChallengeAttemptSummary } from '../services/dailyChallengeService';

export type DailyChallengeUiStatus =
  | 'loading'
  | 'available'
  | 'in_progress'
  | 'completed'
  | 'abandoned'
  | 'unavailable'
  | 'offline'
  | 'error';

export function deriveDailyChallengeUiStatus(input: {
  challenge: DailyChallengeConfig | null;
  rankedAttempt: DailyChallengeAttemptSummary | null;
  activeSession: DailyChallengeSession | null;
  offline: boolean;
  errorMessage: string | null;
}): DailyChallengeUiStatus {
  if (input.errorMessage && !input.challenge) {
    return input.offline ? 'offline' : 'error';
  }
  if (input.offline && !input.challenge) {
    return 'offline';
  }
  if (!input.challenge) {
    return 'loading';
  }
  if (input.activeSession) {
    return 'in_progress';
  }
  if (input.rankedAttempt?.status === 'completed') {
    return 'completed';
  }
  if (
    input.rankedAttempt?.status === 'abandoned' ||
    input.rankedAttempt?.status === 'rejected' ||
    input.rankedAttempt?.status === 'expired'
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
