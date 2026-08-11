import { supabase } from '../lib/supabase';
import { mapLivePvpErrorCode, mapLivePvpHeadToHeadRecord, mapLivePvpPlayerRecord, mapLivePvpRematchResult, mapLivePvpSnapshot } from '../livePvp/livePvpProtocol';
import type {
  LiveMatchErrorCode,
  LiveMatchProgressInput,
  LiveMatchResultInput,
  LiveMatchSnapshot,
  LivePvpHeadToHeadRecord,
  LivePvpPlayerRecord,
  LivePvpRematchResult,
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

export type LivePvpHubItem = {
  matchId: string;
  status: string;
  participantRole: 'challenger' | 'opponent';
  opponent: { userId: string; displayName: string; profileFrameId?: string | null };
  expiresAt: string;
  scheduledStartAt: string | null;
  gameplayDeadlineAt: string | null;
  youReady: boolean;
  opponentReady: boolean;
  outcome: string | null;
  winnerUserId: string | null;
  completionReason: string | null;
  createdAt: string;
  updatedAt: string;
  stateVersion: number;
};

export type LivePvpHubSection = 'incoming' | 'active' | 'recent';

export async function getLiveMatchHub(options?: {
  section?: LivePvpHubSection;
  limit?: number;
  offset?: number;
}): Promise<{
  section: LivePvpHubSection;
  items: LivePvpHubItem[];
  attentionCount: number;
  serverNow: string;
}> {
  const data = await rpcJson('get_live_pvp_hub', {
    p_section: options?.section ?? 'incoming',
    p_limit: options?.limit ?? 20,
    p_offset: options?.offset ?? 0,
  });
  const items = Array.isArray(data.items)
    ? data.items.map((raw) => {
        const row = raw as Record<string, unknown>;
        const opponent = (row.opponent ?? {}) as Record<string, unknown>;
        return {
          matchId: String(row.matchId),
          status: String(row.status),
          participantRole:
            row.participantRole === 'opponent' ? 'opponent' : 'challenger',
          opponent: {
            userId: String(opponent.userId ?? ''),
            displayName: String(opponent.displayName ?? 'Blaze Player'),
            profileFrameId:
              opponent.profileFrameId == null
                ? null
                : String(opponent.profileFrameId),
          },
          expiresAt: String(row.expiresAt ?? ''),
          scheduledStartAt:
            row.scheduledStartAt == null ? null : String(row.scheduledStartAt),
          gameplayDeadlineAt:
            row.gameplayDeadlineAt == null ? null : String(row.gameplayDeadlineAt),
          youReady: Boolean(row.youReady),
          opponentReady: Boolean(row.opponentReady),
          outcome: row.outcome == null ? null : String(row.outcome),
          winnerUserId: row.winnerUserId == null ? null : String(row.winnerUserId),
          completionReason:
            row.completionReason == null ? null : String(row.completionReason),
          createdAt: String(row.createdAt ?? ''),
          updatedAt: String(row.updatedAt ?? ''),
          stateVersion: Number(row.stateVersion ?? 0),
        } satisfies LivePvpHubItem;
      })
    : [];
  return {
    section: String(data.section ?? 'incoming') as LivePvpHubSection,
    items,
    attentionCount: Number(data.attentionCount ?? 0),
    serverNow: String(data.serverNow ?? new Date().toISOString()),
  };
}

export async function getLivePvpOpsStatus(): Promise<{
  creationEnabled: boolean;
  configActive: boolean;
  protocolVersion: string;
}> {
  const data = await rpcJson('get_live_pvp_ops_status');
  return {
    creationEnabled: Boolean(data.creationEnabled),
    configActive: Boolean(data.configActive),
    protocolVersion: String(data.protocolVersion ?? '1'),
  };
}

export async function createLivePvpRematch(sourceMatchId: string): Promise<LivePvpRematchResult> {
  return mapLivePvpRematchResult(
    await rpcJson('create_live_pvp_rematch', { p_source_match_id: sourceMatchId }),
  );
}

export async function getLivePvpPlayerRecord(): Promise<LivePvpPlayerRecord> {
  return mapLivePvpPlayerRecord(await rpcJson('get_live_pvp_player_record'));
}

export async function getLivePvpHeadToHeadRecord(
  opponentId: string,
): Promise<LivePvpHeadToHeadRecord> {
  return mapLivePvpHeadToHeadRecord(
    await rpcJson('get_live_pvp_head_to_head_record', { p_opponent_id: opponentId }),
  );
}
