import { supabase } from '../lib/supabase';
import type {
  AsyncDuelCompletionResult,
  AsyncDuelErrorCode,
  AsyncDuelGameResult,
  AsyncDuelHistoryItem,
  AsyncDuelInboxItem,
  AsyncDuelPublicParticipant,
  AsyncDuelStartResult,
} from '../asyncDuel/asyncDuelTypes';

const TIMEOUT_MS = 12000;

export class AsyncDuelServiceError extends Error {
  readonly code: AsyncDuelErrorCode;

  constructor(code: AsyncDuelErrorCode, message?: string) {
    super(message ?? code);
    this.name = 'AsyncDuelServiceError';
    this.code = code;
  }
}

function withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new AsyncDuelServiceError('UNKNOWN', `${label} timed out.`));
    }, TIMEOUT_MS);
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function mapError(error: { message?: string; details?: string; code?: string } | null): never {
  const message = `${error?.message ?? ''} ${error?.details ?? ''}`.toUpperCase();
  const codes: AsyncDuelErrorCode[] = [
    'SELF_CHALLENGE',
    'PLAYER_NOT_FOUND',
    'PLAYER_NOT_ELIGIBLE',
    'ACTIVE_DUEL_LIMIT',
    'DUPLICATE_ACTIVE_DUEL',
    'DUEL_NOT_FOUND',
    'NOT_PARTICIPANT',
    'INVALID_DUEL_STATE',
    'ALREADY_STARTED',
    'ALREADY_COMPLETED',
    'DECLINED',
    'EXPIRED',
    'INVALID_RESULT',
    'ASYNC_DUEL_DISABLED',
  ];
  for (const code of codes) {
    if (message.includes(code)) {
      throw new AsyncDuelServiceError(code);
    }
  }
  if (/not_authenticated/i.test(message)) {
    throw new AsyncDuelServiceError('NOT_AUTHENTICATED');
  }
  throw new AsyncDuelServiceError('UNKNOWN', error?.message ?? 'Async Duel request failed.');
}

async function rpcJson(
  name: string,
  args: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const { data, error } = await withTimeout(
    Promise.resolve(supabase.rpc(name as never, args as never)),
    name,
  );
  if (error) {
    mapError(error);
  }
  if (!isRecord(data)) {
    throw new AsyncDuelServiceError('UNKNOWN', `Invalid ${name} response.`);
  }
  return data;
}

function parseStart(data: Record<string, unknown>): AsyncDuelStartResult {
  return {
    duelId: String(data.duelId),
    attemptId: String(data.attemptId),
    seed: String(data.seed),
    rulesVersion: String(data.rulesVersion),
    deckVersion: String(data.deckVersion),
    durationSeconds: Number(data.durationSeconds),
    bustLimit: Number(data.bustLimit),
    status: data.status as AsyncDuelStartResult['status'],
    expiresAt: String(data.expiresAt),
    participantRole: data.participantRole as AsyncDuelStartResult['participantRole'],
    alreadyStarted: Boolean(data.alreadyStarted),
    opponentId: data.opponentId != null ? String(data.opponentId) : undefined,
  };
}

/**
 * Client service foundation — no full UI.
 * Resume policy: start/opponent start returns existing attempt on retry;
 * complete is idempotent for already-completed attempts.
 * Never trusts client-supplied seed/rules/winner.
 */
export async function createAsyncDuel(opponentId: string): Promise<AsyncDuelStartResult> {
  if (!opponentId) {
    throw new AsyncDuelServiceError('PLAYER_NOT_FOUND');
  }
  const data = await rpcJson('create_async_duel', { p_opponent_id: opponentId });
  return parseStart(data);
}

export async function getAsyncDuelInbox(options?: {
  limit?: number;
  offset?: number;
}): Promise<{ items: AsyncDuelInboxItem[]; limit: number; offset: number }> {
  const data = await rpcJson('get_async_duel_inbox', {
    p_limit: options?.limit ?? 20,
    p_offset: options?.offset ?? 0,
  });
  const items = Array.isArray(data.items) ? (data.items as AsyncDuelInboxItem[]) : [];
  return {
    items,
    limit: Number(data.limit ?? 20),
    offset: Number(data.offset ?? 0),
  };
}

export async function startAsyncDuelOpponentAttempt(
  duelId: string,
): Promise<AsyncDuelStartResult> {
  const data = await rpcJson('start_async_duel_opponent_attempt', {
    p_duel_id: duelId,
  });
  return parseStart(data);
}

export async function completeAsyncDuelAttempt(
  attemptId: string,
  result: AsyncDuelGameResult,
): Promise<AsyncDuelCompletionResult> {
  const data = await rpcJson('complete_async_duel_attempt', {
    p_attempt_id: attemptId,
    p_score: result.score,
    p_exact_21_count: result.exact21Count,
    p_five_card_clear_count: result.fiveCardClearCount,
    p_bust_count: result.bustCount,
    p_cards_played: result.cardsPlayed,
    p_lanes_cleared: result.lanesCleared,
    p_completion_ms: result.completionMs,
    p_rules_version: result.rulesVersion,
    p_deck_version: result.deckVersion,
    p_submission_version: result.submissionVersion ?? null,
  });
  return data as unknown as AsyncDuelCompletionResult;
}

export async function declineAsyncDuel(
  duelId: string,
): Promise<{ duelId: string; status: string; alreadyDeclined?: boolean }> {
  const data = await rpcJson('decline_async_duel', { p_duel_id: duelId });
  return {
    duelId: String(data.duelId),
    status: String(data.status),
    alreadyDeclined: Boolean(data.alreadyDeclined),
  };
}

export async function cancelAsyncDuel(
  duelId: string,
): Promise<{ duelId: string; status: string; alreadyCancelled?: boolean }> {
  const data = await rpcJson('cancel_async_duel', { p_duel_id: duelId });
  return {
    duelId: String(data.duelId),
    status: String(data.status),
    alreadyCancelled: Boolean(data.alreadyCancelled),
  };
}

export async function getAsyncDuelDetails(
  duelId: string,
): Promise<Record<string, unknown>> {
  return rpcJson('get_async_duel_details', { p_duel_id: duelId });
}

export async function getAsyncDuelResult(
  duelId: string,
): Promise<AsyncDuelCompletionResult> {
  const data = await rpcJson('get_async_duel_result', { p_duel_id: duelId });
  return data as unknown as AsyncDuelCompletionResult;
}

export async function getAsyncDuelHistory(options?: {
  limit?: number;
  offset?: number;
}): Promise<{ items: AsyncDuelHistoryItem[]; limit: number; offset: number }> {
  const data = await rpcJson('get_async_duel_history', {
    p_limit: options?.limit ?? 20,
    p_offset: options?.offset ?? 0,
  });
  const items = Array.isArray(data.items) ? (data.items as AsyncDuelHistoryItem[]) : [];
  return {
    items,
    limit: Number(data.limit ?? 20),
    offset: Number(data.offset ?? 0),
  };
}

export type AsyncDuelOpponentSearchItem = {
  userId: string;
  displayName: string;
  profileFrameId: string | null;
  level: number;
  eligible: boolean;
};

export type AsyncDuelActiveItem = {
  duelId: string;
  status: string;
  participantRole: 'challenger' | 'opponent';
  opponent: AsyncDuelPublicParticipant;
  challengerScore: number | null;
  opponentScore: number | null;
  challengerAttemptStatus: string | null;
  opponentAttemptStatus: string | null;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
  targetScoreVisibility: boolean;
};

export async function searchAsyncDuelOpponents(input: {
  query: string;
  limit?: number;
  offset?: number;
}): Promise<{ items: AsyncDuelOpponentSearchItem[]; limit: number; offset: number }> {
  const data = await rpcJson('search_async_duel_opponents', {
    p_query: input.query,
    p_limit: input.limit ?? 20,
    p_offset: input.offset ?? 0,
  });
  const items = Array.isArray(data.items)
    ? (data.items as AsyncDuelOpponentSearchItem[])
    : [];
  return {
    items,
    limit: Number(data.limit ?? 20),
    offset: Number(data.offset ?? 0),
  };
}

export async function getAsyncDuelActive(options?: {
  limit?: number;
  offset?: number;
}): Promise<{ items: AsyncDuelActiveItem[]; limit: number; offset: number }> {
  const data = await rpcJson('get_async_duel_active', {
    p_limit: options?.limit ?? 20,
    p_offset: options?.offset ?? 0,
  });
  const items = Array.isArray(data.items) ? (data.items as AsyncDuelActiveItem[]) : [];
  return {
    items,
    limit: Number(data.limit ?? 20),
    offset: Number(data.offset ?? 0),
  };
}
