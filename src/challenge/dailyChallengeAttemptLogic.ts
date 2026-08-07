import {
  DAILY_CHALLENGE_DURATION_SECONDS,
  DAILY_CHALLENGE_SUBMISSION_GRACE_SECONDS,
} from './dailyChallengeRegistry';
import type {
  DailyChallengeAttemptStatus,
  DailyChallengeStartError,
  DailyChallengeStartResult,
} from './dailyChallengeTypes';
import { getUtcChallengeDate } from './utcChallengeDate';

export type RankedAttemptRecord = {
  status: DailyChallengeAttemptStatus;
  userId: string;
  challengeId: string;
};

export type ChallengeRecord = {
  id: string;
  challengeDate: string;
  rulesVersion: string;
  status: string;
};

export type CompletionPayload = {
  attemptId: string;
  score: number;
  exact21Count: number;
  fiveCardClearCount: number;
  bustCount: number;
  cardsPlayed: number;
  completionMs: number;
  rulesVersion: string;
};

export type CompletionValidationError =
  | 'attempt_not_owned'
  | 'attempt_not_active'
  | 'challenge_date_mismatch'
  | 'rules_version_mismatch'
  | 'invalid_score'
  | 'invalid_counters'
  | 'completion_time_implausible';

export function maxPlausibleCompletionMs(
  durationSeconds: number = DAILY_CHALLENGE_DURATION_SECONDS,
): number {
  return (durationSeconds + DAILY_CHALLENGE_SUBMISSION_GRACE_SECONDS) * 1000;
}

/** Mirrors `start_daily_challenge` ranked attempt gate before insert. */
export function evaluateRankedStartGate(
  existingAttempt: RankedAttemptRecord | null,
  challenge: ChallengeRecord,
): DailyChallengeStartError | 'OK' | 'RESUME' {
  if (!challenge.status || !['active', 'published'].includes(challenge.status)) {
    return 'CHALLENGE_DISABLED';
  }

  if (!existingAttempt) {
    return 'OK';
  }

  if (existingAttempt.status === 'completed') {
    return 'ALREADY_PLAYED';
  }

  if (
    existingAttempt.status === 'abandoned' ||
    existingAttempt.status === 'rejected' ||
    existingAttempt.status === 'expired' ||
    existingAttempt.status === 'invalid'
  ) {
    return 'ATTEMPT_NOT_AVAILABLE';
  }

  if (existingAttempt.status === 'created' || existingAttempt.status === 'started') {
    return 'RESUME';
  }

  return 'ATTEMPT_NOT_AVAILABLE';
}

export function validateCompletionPayload(
  attempt: RankedAttemptRecord,
  challenge: ChallengeRecord,
  payload: CompletionPayload,
  actingUserId: string,
  nowMs: number = Date.now(),
): CompletionValidationError | 'already_completed' | 'ok' {
  if (attempt.userId !== actingUserId) {
    return 'attempt_not_owned';
  }

  if (attempt.status === 'completed') {
    return 'already_completed';
  }

  if (attempt.status !== 'started' && attempt.status !== 'created') {
    return 'attempt_not_active';
  }

  if (challenge.challengeDate !== getUtcChallengeDate(nowMs)) {
    return 'challenge_date_mismatch';
  }

  if (payload.rulesVersion !== challenge.rulesVersion) {
    return 'rules_version_mismatch';
  }

  if (!Number.isFinite(payload.score) || payload.score < 0) {
    return 'invalid_score';
  }

  const counters = [
    payload.exact21Count,
    payload.fiveCardClearCount,
    payload.bustCount,
    payload.cardsPlayed,
    payload.completionMs,
  ];

  if (counters.some((value) => !Number.isFinite(value) || value < 0)) {
    return 'invalid_counters';
  }

  if (payload.completionMs > maxPlausibleCompletionMs()) {
    return 'completion_time_implausible';
  }

  return 'ok';
}

export function isDailyChallengeStartError(
  value: unknown,
): value is { error: DailyChallengeStartError } {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { error?: unknown }).error === 'string'
  );
}

export function parseDailyChallengeStartResult(
  value: unknown,
): DailyChallengeStartResult | { error: DailyChallengeStartError } {
  if (isDailyChallengeStartError(value)) {
    return { error: value.error };
  }

  if (typeof value !== 'object' || value === null) {
    throw new Error('invalid_start_daily_challenge_response');
  }

  const record = value as Record<string, unknown>;

  return {
    attemptId: String(record.attemptId),
    challengeId: String(record.challengeId),
    challengeDate: String(record.challengeDate),
    seed: String(record.seed),
    rulesVersion: String(record.rulesVersion),
    deckVersion: String(record.deckVersion),
    durationSeconds: Number(record.durationSeconds),
    bustLimit: Number(record.bustLimit),
    startedAt: String(record.startedAt),
    resumed: Boolean(record.resumed),
  };
}
