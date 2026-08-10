import { supabase } from '../lib/supabase';
import { mapLivePvpErrorCode, mapLivePvpSnapshot } from '../livePvp/livePvpProtocol';
import type {
  LiveMatchErrorCode,
  LiveMatchProgressInput,
  LiveMatchResultInput,
  LiveMatchSnapshot,
} from '../livePvp/livePvpTypes';

const TIMEOUT_MS = 12000;

export class LivePvpServiceError extends Error {
  readonly code: LiveMatchErrorCode;

  constructor(code: LiveMatchErrorCode, message?: string) {
    super(message ?? code);
    this.name = 'LivePvpServiceError';
    this.code = code;
  }
}

function withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new LivePvpServiceError('UNKNOWN', `${label} timed out.`));
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

function mapError(error: { message?: string; details?: string } | null): never {
  const message = `${error?.message ?? ''} ${error?.details ?? ''}`;
  throw new LivePvpServiceError(mapLivePvpErrorCode(message), error?.message);
}

async function rpcJson(
  name: string,
  args: Record<string, unknown> = {},
): Promise<Record<string, unknown>> {
  const { data, error } = await withTimeout(
    Promise.resolve(supabase.rpc(name as never, args as never)),
    name,
  );
  if (error) {
    mapError(error);
  }
  if (!isRecord(data)) {
    throw new LivePvpServiceError('UNKNOWN', `${name} returned invalid payload`);
  }
  return data;
}

export async function createLiveMatchInvite(
  opponentId: string,
): Promise<{
  matchId: string;
  status: string;
  realtimeTopic: string;
  protocolVersion: string;
  stateVersion: number;
  expiresAt: string;
  participantRole: 'challenger';
  serverNow: string;
}> {
  const data = await rpcJson('create_live_pvp_invite', { p_opponent_id: opponentId });
  return {
    matchId: String(data.matchId),
    status: String(data.status),
    realtimeTopic: String(data.realtimeTopic),
    protocolVersion: String(data.protocolVersion),
    stateVersion: Number(data.stateVersion ?? 0),
    expiresAt: String(data.expiresAt),
    participantRole: 'challenger',
    serverNow: String(data.serverNow),
  };
}

export async function acceptLiveMatch(matchId: string): Promise<LiveMatchSnapshot> {
  return mapLivePvpSnapshot(await rpcJson('accept_live_pvp_match', { p_match_id: matchId }));
}

export async function declineLiveMatch(
  matchId: string,
): Promise<{ matchId: string; status: string; alreadyDeclined?: boolean }> {
  const data = await rpcJson('decline_live_pvp_match', { p_match_id: matchId });
  return {
    matchId: String(data.matchId),
    status: String(data.status),
    alreadyDeclined: Boolean(data.alreadyDeclined),
  };
}

export async function cancelLiveMatch(
  matchId: string,
): Promise<{ matchId: string; status: string; alreadyTerminal?: boolean }> {
  const data = await rpcJson('cancel_live_pvp_match', { p_match_id: matchId });
  return {
    matchId: String(data.matchId),
    status: String(data.status),
    alreadyTerminal: Boolean(data.alreadyTerminal),
  };
}

export async function getLiveMatchSnapshot(matchId: string): Promise<LiveMatchSnapshot> {
  return mapLivePvpSnapshot(await rpcJson('get_live_pvp_snapshot', { p_match_id: matchId }));
}

export async function getLivePvpServerTime(): Promise<{ serverNow: string }> {
  const data = await rpcJson('get_live_pvp_server_time');
  return { serverNow: String(data.serverNow) };
}

export async function setLiveMatchReady(matchId: string): Promise<LiveMatchSnapshot> {
  return mapLivePvpSnapshot(await rpcJson('set_live_pvp_ready', { p_match_id: matchId }));
}

export async function submitLiveMatchProgress(
  matchId: string,
  progress: LiveMatchProgressInput,
): Promise<{
  accepted: boolean;
  idempotent?: boolean;
  sequence: number;
  stateVersion?: number;
  serverNow: string;
}> {
  const data = await rpcJson('submit_live_pvp_progress', {
    p_match_id: matchId,
    p_sequence: progress.sequence,
    p_score: progress.score,
    p_exact_21_count: progress.exact21Count,
    p_five_card_clear_count: progress.fiveCardClearCount,
    p_bust_count: progress.bustCount,
    p_cards_played: progress.cardsPlayed,
    p_lanes_cleared: progress.lanesCleared,
    p_client_elapsed_ms: progress.clientElapsedMs,
  });
  return {
    accepted: Boolean(data.accepted),
    idempotent: data.idempotent == null ? undefined : Boolean(data.idempotent),
    sequence: Number(data.sequence ?? progress.sequence),
    stateVersion: data.stateVersion == null ? undefined : Number(data.stateVersion),
    serverNow: String(data.serverNow),
  };
}

export async function completeLiveMatchAttempt(
  matchId: string,
  result: LiveMatchResultInput,
): Promise<LiveMatchSnapshot> {
  return mapLivePvpSnapshot(
    await rpcJson('complete_live_pvp_attempt', {
      p_match_id: matchId,
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
    }),
  );
}

export async function forfeitLiveMatch(matchId: string): Promise<LiveMatchSnapshot> {
  return mapLivePvpSnapshot(await rpcJson('forfeit_live_pvp_match', { p_match_id: matchId }));
}

export async function reconcileLiveMatch(matchId: string): Promise<LiveMatchSnapshot> {
  return getLiveMatchSnapshot(matchId);
}
