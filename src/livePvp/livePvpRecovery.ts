import { LIVE_PVP_PROTOCOL_VERSION } from './livePvpConfig';
import type { LivePvpCheckpoint } from './livePvpCheckpointStorage';
import type { LiveMatchSnapshot, LiveMatchStatus } from './livePvpTypes';

export type LivePvpRecoveryDiscardReason =
  | 'wrong_account'
  | 'corrupt_checkpoint'
  | 'terminal_match'
  | 'expired_match'
  | 'incompatible_versions'
  | 'id_mismatch'
  | 'not_playable'
  | 'attempt_completed'
  | 'past_deadline'
  | 'missing_seed';

export type LivePvpRecoveryResult =
  | { kind: 'resume'; checkpoint: LivePvpCheckpoint; snapshot: LiveMatchSnapshot }
  | { kind: 'discard'; reason: LivePvpRecoveryDiscardReason };

const PLAYABLE_STATUSES: ReadonlySet<LiveMatchStatus> = new Set([
  'countdown',
  'active',
  'settling',
]);

export function evaluateLivePvpRecovery(input: {
  checkpoint: LivePvpCheckpoint | null;
  userId: string;
  snapshot: LiveMatchSnapshot | null;
}): LivePvpRecoveryResult {
  const { checkpoint, userId, snapshot } = input;
  if (!checkpoint) {
    return { kind: 'discard', reason: 'corrupt_checkpoint' };
  }
  if (checkpoint.userId !== userId) {
    return { kind: 'discard', reason: 'wrong_account' };
  }
  if (!snapshot || snapshot.matchId !== checkpoint.matchId) {
    return { kind: 'discard', reason: 'id_mismatch' };
  }
  if (snapshot.protocolVersion !== checkpoint.protocolVersion) {
    return { kind: 'discard', reason: 'incompatible_versions' };
  }
  if (checkpoint.protocolVersion !== LIVE_PVP_PROTOCOL_VERSION) {
    return { kind: 'discard', reason: 'incompatible_versions' };
  }
  if (
    snapshot.rulesVersion !== checkpoint.rulesVersion ||
    snapshot.deckVersion !== checkpoint.deckVersion
  ) {
    return { kind: 'discard', reason: 'incompatible_versions' };
  }
  if (
    snapshot.status === 'completed' ||
    snapshot.status === 'declined' ||
    snapshot.status === 'cancelled' ||
    snapshot.status === 'expired' ||
    snapshot.status === 'invalid'
  ) {
    return { kind: 'discard', reason: 'terminal_match' };
  }
  if (!PLAYABLE_STATUSES.has(snapshot.status)) {
    return { kind: 'discard', reason: 'not_playable' };
  }
  if (snapshot.myAttempt?.attemptId && snapshot.myAttempt.attemptId !== checkpoint.attemptId) {
    return { kind: 'discard', reason: 'id_mismatch' };
  }
  if (
    snapshot.myAttempt?.status === 'completed' ||
    snapshot.myAttempt?.status === 'forfeited' ||
    snapshot.myAttempt?.status === 'timed_out'
  ) {
    return { kind: 'discard', reason: 'attempt_completed' };
  }
  const deadlineMs = Date.parse(snapshot.gameplayDeadlineAt ?? '');
  const serverNowMs = Date.parse(snapshot.serverNow);
  if (
    Number.isFinite(deadlineMs) &&
    Number.isFinite(serverNowMs) &&
    serverNowMs >= deadlineMs
  ) {
    return { kind: 'discard', reason: 'past_deadline' };
  }
  if (!snapshot.seed) {
    return { kind: 'discard', reason: 'missing_seed' };
  }
  return { kind: 'resume', checkpoint, snapshot };
}
