/**
 * Runtime validators for Async Duel RPC payloads.
 * Rejects malformed backend responses before they enter UI state.
 */

import type {
  AsyncDuelAttemptResult,
  AsyncDuelAttemptStatus,
  AsyncDuelCompletionResult,
  AsyncDuelDecidingField,
  AsyncDuelDetails,
  AsyncDuelHistoryItem,
  AsyncDuelInboxItem,
  AsyncDuelOutcome,
  AsyncDuelParticipantRole,
  AsyncDuelPublicParticipant,
  AsyncDuelStartResult,
  AsyncDuelStatus,
} from './asyncDuelTypes';
import { AsyncDuelServiceError } from './asyncDuelServiceError';

const DUEL_STATUSES: AsyncDuelStatus[] = [
  'challenger_playing',
  'awaiting_opponent',
  'opponent_playing',
  'completed',
  'declined',
  'expired',
  'cancelled',
  'invalid',
];

const ATTEMPT_STATUSES: AsyncDuelAttemptStatus[] = [
  'started',
  'completed',
  'abandoned',
  'invalid',
];

const OUTCOMES: AsyncDuelOutcome[] = ['challenger_win', 'opponent_win', 'tie'];

const ROLES: AsyncDuelParticipantRole[] = ['challenger', 'opponent'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireString(
  record: Record<string, unknown>,
  key: string,
  label: string,
): string {
  const value = record[key];
  if (typeof value !== 'string' || value.length === 0 || value === 'undefined') {
    throw new AsyncDuelServiceError('UNKNOWN', `Invalid ${label}: missing ${key}`);
  }
  return value;
}

function optionalString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  if (value == null) {
    return undefined;
  }
  if (typeof value !== 'string' || value.length === 0 || value === 'undefined') {
    throw new AsyncDuelServiceError('UNKNOWN', `Invalid optional field: ${key}`);
  }
  return value;
}

function requireNumber(
  record: Record<string, unknown>,
  key: string,
  label: string,
): number {
  const value = record[key];
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new AsyncDuelServiceError('UNKNOWN', `Invalid ${label}: ${key}`);
  }
  return value;
}

function optionalNumber(record: Record<string, unknown>, key: string): number | null {
  const value = record[key];
  if (value == null) {
    return null;
  }
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new AsyncDuelServiceError('UNKNOWN', `Invalid numeric field: ${key}`);
  }
  return value;
}

function requireStatus(value: unknown, label: string): AsyncDuelStatus {
  if (typeof value !== 'string' || !DUEL_STATUSES.includes(value as AsyncDuelStatus)) {
    throw new AsyncDuelServiceError('UNKNOWN', `Invalid ${label} status`);
  }
  return value as AsyncDuelStatus;
}

function requireAttemptStatus(value: unknown): AsyncDuelAttemptStatus {
  if (typeof value !== 'string' || !ATTEMPT_STATUSES.includes(value as AsyncDuelAttemptStatus)) {
    throw new AsyncDuelServiceError('UNKNOWN', 'Invalid attempt status');
  }
  return value as AsyncDuelAttemptStatus;
}

function requireRole(value: unknown): AsyncDuelParticipantRole {
  if (typeof value !== 'string' || !ROLES.includes(value as AsyncDuelParticipantRole)) {
    throw new AsyncDuelServiceError('UNKNOWN', 'Invalid participant role');
  }
  return value as AsyncDuelParticipantRole;
}

function parsePublicParticipant(raw: unknown, label: string): AsyncDuelPublicParticipant {
  if (!isRecord(raw)) {
    throw new AsyncDuelServiceError('UNKNOWN', `Invalid ${label}`);
  }
  return {
    userId: requireString(raw, 'userId', label),
    displayName: requireString(raw, 'displayName', label),
    profileFrameId:
      raw.profileFrameId == null ? null : optionalString(raw, 'profileFrameId') ?? null,
  };
}

function parseAttemptResult(raw: unknown): AsyncDuelAttemptResult | null {
  if (raw == null) {
    return null;
  }
  if (!isRecord(raw)) {
    throw new AsyncDuelServiceError('UNKNOWN', 'Invalid attempt result');
  }
  return {
    attemptId: requireString(raw, 'attemptId', 'attempt result'),
    score: optionalNumber(raw, 'score'),
    exact21Count: optionalNumber(raw, 'exact21Count'),
    fiveCardClearCount: optionalNumber(raw, 'fiveCardClearCount'),
    bustCount: optionalNumber(raw, 'bustCount'),
    cardsPlayed: optionalNumber(raw, 'cardsPlayed'),
    lanesCleared: optionalNumber(raw, 'lanesCleared'),
    completionMs: optionalNumber(raw, 'completionMs'),
    status: requireAttemptStatus(raw.status),
  };
}

export function parseAsyncDuelStart(data: Record<string, unknown>): AsyncDuelStartResult {
  return {
    duelId: requireString(data, 'duelId', 'start result'),
    attemptId: requireString(data, 'attemptId', 'start result'),
    seed: requireString(data, 'seed', 'start result'),
    rulesVersion: requireString(data, 'rulesVersion', 'start result'),
    deckVersion: requireString(data, 'deckVersion', 'start result'),
    durationSeconds: requireNumber(data, 'durationSeconds', 'start result'),
    bustLimit: requireNumber(data, 'bustLimit', 'start result'),
    status: requireStatus(data.status, 'start'),
    expiresAt: requireString(data, 'expiresAt', 'start result'),
    participantRole: requireRole(data.participantRole),
    alreadyStarted: Boolean(data.alreadyStarted),
    opponentId: optionalString(data, 'opponentId'),
    resumedExisting: Boolean(data.resumedExisting),
  };
}

export function parseAsyncDuelCompletion(
  data: Record<string, unknown>,
): AsyncDuelCompletionResult {
  const outcomeRaw = data.outcome;
  let outcome: AsyncDuelOutcome | null | undefined;
  if (outcomeRaw == null) {
    outcome = null;
  } else if (typeof outcomeRaw === 'string' && OUTCOMES.includes(outcomeRaw as AsyncDuelOutcome)) {
    outcome = outcomeRaw as AsyncDuelOutcome;
  } else {
    throw new AsyncDuelServiceError('UNKNOWN', 'Invalid completion outcome');
  }

  const decidingRaw = data.decidingField;
  let decidingField: AsyncDuelDecidingField | null | undefined;
  if (decidingRaw == null) {
    decidingField = null;
  } else if (typeof decidingRaw === 'string') {
    decidingField = decidingRaw as AsyncDuelDecidingField;
  } else {
    throw new AsyncDuelServiceError('UNKNOWN', 'Invalid deciding field');
  }

  return {
    duelId: requireString(data, 'duelId', 'completion result'),
    attemptId: optionalString(data, 'attemptId'),
    status: requireStatus(data.status, 'completion'),
    alreadyCompleted: Boolean(data.alreadyCompleted),
    score: optionalNumber(data, 'score'),
    settled: data.settled == null ? undefined : Boolean(data.settled),
    outcome,
    winnerUserId: data.winnerUserId == null ? null : optionalString(data, 'winnerUserId') ?? null,
    decidingField,
    settledAt: data.settledAt == null ? null : optionalString(data, 'settledAt') ?? null,
    challengerResult: parseAttemptResult(data.challengerResult),
    opponentResult: parseAttemptResult(data.opponentResult),
  };
}

export function parseAsyncDuelInboxItem(raw: unknown): AsyncDuelInboxItem {
  if (!isRecord(raw)) {
    throw new AsyncDuelServiceError('UNKNOWN', 'Invalid inbox item');
  }
  if ('seed' in raw) {
    throw new AsyncDuelServiceError('UNKNOWN', 'Inbox must not include seed');
  }
  return {
    duelId: requireString(raw, 'duelId', 'inbox item'),
    challenger: parsePublicParticipant(raw.challenger, 'inbox challenger'),
    challengerScore: optionalNumber(raw, 'challengerScore'),
    rulesVersion: requireString(raw, 'rulesVersion', 'inbox item'),
    deckVersion: requireString(raw, 'deckVersion', 'inbox item'),
    durationSeconds: requireNumber(raw, 'durationSeconds', 'inbox item'),
    bustLimit: requireNumber(raw, 'bustLimit', 'inbox item'),
    createdAt: requireString(raw, 'createdAt', 'inbox item'),
    expiresAt: requireString(raw, 'expiresAt', 'inbox item'),
    status: requireStatus(raw.status, 'inbox'),
  };
}

export function parseAsyncDuelHistoryItem(raw: unknown): AsyncDuelHistoryItem {
  if (!isRecord(raw)) {
    throw new AsyncDuelServiceError('UNKNOWN', 'Invalid history item');
  }
  if ('seed' in raw) {
    throw new AsyncDuelServiceError('UNKNOWN', 'History must not include seed');
  }
  const outcomeRaw = raw.outcome;
  let outcome: AsyncDuelOutcome | null = null;
  if (outcomeRaw != null) {
    if (!OUTCOMES.includes(outcomeRaw as AsyncDuelOutcome)) {
      throw new AsyncDuelServiceError('UNKNOWN', 'Invalid history outcome');
    }
    outcome = outcomeRaw as AsyncDuelOutcome;
  }
  return {
    duelId: requireString(raw, 'duelId', 'history item'),
    status: requireStatus(raw.status, 'history'),
    outcome,
    winnerUserId: raw.winnerUserId == null ? null : optionalString(raw, 'winnerUserId') ?? null,
    opponent: parsePublicParticipant(raw.opponent, 'history opponent'),
    challengerScore: optionalNumber(raw, 'challengerScore'),
    opponentScore: optionalNumber(raw, 'opponentScore'),
    challengerCompletedAt:
      raw.challengerCompletedAt == null
        ? null
        : optionalString(raw, 'challengerCompletedAt') ?? null,
    opponentCompletedAt:
      raw.opponentCompletedAt == null
        ? null
        : optionalString(raw, 'opponentCompletedAt') ?? null,
    settledAt: raw.settledAt == null ? null : optionalString(raw, 'settledAt') ?? null,
    updatedAt: requireString(raw, 'updatedAt', 'history item'),
  };
}

export function parseAsyncDuelDetails(data: Record<string, unknown>): AsyncDuelDetails {
  if ('seed' in data) {
    throw new AsyncDuelServiceError('UNKNOWN', 'Details must not include seed');
  }
  const outcomeRaw = data.outcome;
  let outcome: AsyncDuelOutcome | null = null;
  if (outcomeRaw != null) {
    if (!OUTCOMES.includes(outcomeRaw as AsyncDuelOutcome)) {
      throw new AsyncDuelServiceError('UNKNOWN', 'Invalid details outcome');
    }
    outcome = outcomeRaw as AsyncDuelOutcome;
  }
  const caStatus = data.challengerAttemptStatus;
  const oaStatus = data.opponentAttemptStatus;
  return {
    duelId: requireString(data, 'duelId', 'details'),
    status: requireStatus(data.status, 'details'),
    participantRole: requireRole(data.participantRole),
    outcome,
    winnerUserId:
      data.winnerUserId == null ? null : optionalString(data, 'winnerUserId') ?? null,
    decidingField:
      data.decidingField == null ? null : (String(data.decidingField) as AsyncDuelDecidingField),
    challenger: parsePublicParticipant(data.challenger, 'details challenger'),
    opponent: parsePublicParticipant(data.opponent, 'details opponent'),
    rulesVersion: requireString(data, 'rulesVersion', 'details'),
    deckVersion: requireString(data, 'deckVersion', 'details'),
    durationSeconds: requireNumber(data, 'durationSeconds', 'details'),
    bustLimit: requireNumber(data, 'bustLimit', 'details'),
    createdAt: requireString(data, 'createdAt', 'details'),
    expiresAt: requireString(data, 'expiresAt', 'details'),
    settledAt: data.settledAt == null ? null : optionalString(data, 'settledAt') ?? null,
    challengerAttemptStatus:
      caStatus == null ? null : requireAttemptStatus(caStatus),
    opponentAttemptStatus:
      oaStatus == null ? null : requireAttemptStatus(oaStatus),
    challengerScore: optionalNumber(data, 'challengerScore'),
    opponentScore: optionalNumber(data, 'opponentScore'),
  };
}

export function parsePagedItems<T>(
  data: Record<string, unknown>,
  label: string,
  mapItem: (raw: unknown) => T,
): { items: T[]; limit: number; offset: number } {
  if (!Array.isArray(data.items)) {
    throw new AsyncDuelServiceError('UNKNOWN', `Invalid ${label} items array`);
  }
  return {
    items: data.items.map(mapItem),
    limit: requireNumber(data, 'limit', label),
    offset: requireNumber(data, 'offset', label),
  };
}
