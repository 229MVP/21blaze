import { supabase } from '../lib/supabase';

export type ProductionV1Intent =
  | { type: 'match.ready' }
  | { type: 'card.place'; laneIndex: 0 | 1 | 2 | 3 }
  | { type: 'power.activate'; powerId: string; target?: Record<string, unknown> }
  | { type: 'match.forfeit' }
  | { type: 'match.rematch_vote'; accept: boolean };

export type ProductionV1Snapshot = {
  matchId: string;
  status: string;
  rulesVersion: 'production-v1';
  revision: number;
  state: Record<string, unknown>;
  startedAt: string | null;
  endsAt: string | null;
  serverNow: string;
};

export type ProductionV1IntentReceipt = {
  actionId: string;
  status: 'pending' | 'processing' | 'accepted' | 'rejected';
  idempotent: boolean;
  expectedRevision: number;
  result?: Record<string, unknown> | null;
  serverNow?: string;
};

export type ProductionV1PrivateMatch = {
  matchId: string;
  status: string;
  rulesVersion: 'production-v1';
  revision: number;
  seedCommitment?: string;
  serverNow: string;
};
export class ProductionV1ServiceError extends Error {
  constructor(readonly code: string, message?: string) {
    super(message ?? code);
    this.name = 'ProductionV1ServiceError';
  }
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ProductionV1ServiceError('INVALID_RESPONSE');
  }
  return value as Record<string, unknown>;
}

function errorCode(error: { message?: string; details?: string; code?: string } | null): string {
  const text = `${error?.message ?? ''} ${error?.details ?? ''}`.toUpperCase();
  for (const code of [
    'STALE_REVISION', 'REVISION_ALREADY_QUEUED', 'NOT_PARTICIPANT',
    'NOT_AUTHENTICATED', 'MATCH_NOT_FOUND', 'MATCH_TERMINAL',
    'RULES_VERSION_MISMATCH', 'INVALID_ACTION_ID', 'INVALID_INTENT',
    'PRODUCTION_V1_DISABLED', 'INVALID_OPPONENT', 'OPPONENT_NOT_FOUND',
    'ACTIVE_MATCH_LIMIT', 'ONLY_OPPONENT_ACCEPTS', 'INVALID_MATCH_STATE',
  ]) if (text.includes(code)) return code;
  return error?.code === '40001' ? 'STALE_REVISION' : 'UNKNOWN';
}

async function rpc(name: string, args: Record<string, unknown>): Promise<Record<string, unknown>> {
  const { data, error } = await supabase.rpc(name as never, args as never);
  if (error) throw new ProductionV1ServiceError(errorCode(error), error.message);
  return record(data);
}

function privateMatch(data: Record<string, unknown>): ProductionV1PrivateMatch {
  if (data.rulesVersion !== 'production-v1') throw new ProductionV1ServiceError('RULES_VERSION_MISMATCH');
  return {
    matchId: String(data.matchId), status: String(data.status), rulesVersion: 'production-v1',
    revision: Number(data.revision),
    seedCommitment: data.seedCommitment == null ? undefined : String(data.seedCommitment),
    serverNow: String(data.serverNow),
  };
}

export async function createProductionV1PrivateMatch(opponentId: string): Promise<ProductionV1PrivateMatch> {
  return privateMatch(await rpc('create_production_v1_private_match', { p_opponent_id: opponentId }));
}

export async function acceptProductionV1PrivateMatch(matchId: string): Promise<ProductionV1Snapshot> {
  const data = await rpc('accept_production_v1_private_match', { p_match_id: matchId });
  if (data.rulesVersion !== 'production-v1') throw new ProductionV1ServiceError('RULES_VERSION_MISMATCH');
  return {
    matchId: String(data.matchId), status: String(data.status), rulesVersion: 'production-v1',
    revision: Number(data.revision), state: record(data.state),
    startedAt: data.startedAt == null ? null : String(data.startedAt),
    endsAt: data.endsAt == null ? null : String(data.endsAt), serverNow: String(data.serverNow),
  };
}
export async function getProductionV1Snapshot(matchId: string): Promise<ProductionV1Snapshot> {
  const data = await rpc('get_production_v1_snapshot', { p_match_id: matchId });
  if (data.rulesVersion !== 'production-v1') throw new ProductionV1ServiceError('RULES_VERSION_MISMATCH');
  return {
    matchId: String(data.matchId), status: String(data.status), rulesVersion: 'production-v1',
    revision: Number(data.revision), state: record(data.state),
    startedAt: data.startedAt == null ? null : String(data.startedAt),
    endsAt: data.endsAt == null ? null : String(data.endsAt), serverNow: String(data.serverNow),
  };
}

export function createProductionV1ActionId(now = Date.now()): string {
  const random = Math.random().toString(36).slice(2, 12);
  return `pv1-${now.toString(36)}-${random}`;
}

export async function enqueueProductionV1Intent(input: {
  matchId: string; expectedRevision: number; intent: ProductionV1Intent; clientActionId?: string;
}): Promise<ProductionV1IntentReceipt> {
  const data = await rpc('enqueue_production_v1_intent', {
    p_match_id: input.matchId,
    p_client_action_id: input.clientActionId ?? createProductionV1ActionId(),
    p_expected_revision: input.expectedRevision,
    p_intent: input.intent,
  });
  return {
    actionId: String(data.actionId),
    status: String(data.status) as ProductionV1IntentReceipt['status'],
    idempotent: Boolean(data.idempotent), expectedRevision: Number(data.expectedRevision),
    result: data.result == null ? null : record(data.result),
    serverNow: data.serverNow == null ? undefined : String(data.serverNow),
  };
}

export async function enqueueWithRevisionRecovery(input: {
  matchId: string; snapshot: ProductionV1Snapshot; intent: ProductionV1Intent; clientActionId?: string;
}): Promise<{ receipt: ProductionV1IntentReceipt | null; snapshot: ProductionV1Snapshot }> {
  const actionId = input.clientActionId ?? createProductionV1ActionId();
  try {
    const receipt = await enqueueProductionV1Intent({
      matchId: input.matchId, expectedRevision: input.snapshot.revision,
      intent: input.intent, clientActionId: actionId,
    });
    return { receipt, snapshot: input.snapshot };
  } catch (error) {
    if (!(error instanceof ProductionV1ServiceError) ||
        (error.code !== 'STALE_REVISION' && error.code !== 'REVISION_ALREADY_QUEUED')) throw error;
    // Never replay an intent automatically after a revision conflict. Refetch
    // authority and let the caller decide whether the user's action is still legal.
    return { receipt: null, snapshot: await getProductionV1Snapshot(input.matchId) };
  }
}

