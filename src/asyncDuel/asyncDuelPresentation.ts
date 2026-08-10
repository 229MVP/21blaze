import type { AsyncDuelOutcome, AsyncDuelParticipantRole } from './asyncDuelTypes';

export type AsyncDuelPerspectiveResult = 'victory' | 'defeat' | 'tie';

export type AsyncDuelDecidingLabel =
  | 'Higher score'
  | 'More Exact 21s'
  | 'More Five-Card Clears'
  | 'Fewer busts'
  | 'Faster valid completion'
  | 'All tie-breakers equal';

const DECIDING_LABELS: Record<string, AsyncDuelDecidingLabel> = {
  score: 'Higher score',
  exact_21: 'More Exact 21s',
  five_card_clear: 'More Five-Card Clears',
  bust_count: 'Fewer busts',
  completion_ms: 'Faster valid completion',
  tie: 'All tie-breakers equal',
};

export function asyncDuelPerspective(
  outcome: AsyncDuelOutcome | null | undefined,
  role: AsyncDuelParticipantRole,
): AsyncDuelPerspectiveResult | null {
  if (!outcome) {
    return null;
  }
  if (outcome === 'tie') {
    return 'tie';
  }
  if (outcome === 'challenger_win') {
    return role === 'challenger' ? 'victory' : 'defeat';
  }
  if (outcome === 'opponent_win') {
    return role === 'opponent' ? 'victory' : 'defeat';
  }
  return null;
}

/**
 * Perspective from authenticated user id + settlement fields.
 * Prefer this when participantRole is not present in a list payload.
 */
export function asyncDuelPerspectiveForUser(input: {
  outcome: AsyncDuelOutcome | null | undefined;
  winnerUserId: string | null | undefined;
  currentUserId: string | null | undefined;
}): AsyncDuelPerspectiveResult | null {
  const { outcome, winnerUserId, currentUserId } = input;
  if (!outcome || !currentUserId) {
    return null;
  }
  if (outcome === 'tie') {
    return 'tie';
  }
  if (!winnerUserId) {
    return null;
  }
  return winnerUserId === currentUserId ? 'victory' : 'defeat';
}

export function asyncDuelDecidingLabel(field: string | null | undefined): AsyncDuelDecidingLabel {
  if (!field) {
    return 'All tie-breakers equal';
  }
  return DECIDING_LABELS[field] ?? 'All tie-breakers equal';
}

export function asyncDuelPerspectiveTitle(
  perspective: AsyncDuelPerspectiveResult | null,
): string {
  if (perspective === 'victory') {
    return 'VICTORY';
  }
  if (perspective === 'defeat') {
    return 'DEFEAT';
  }
  if (perspective === 'tie') {
    return 'TIE';
  }
  return 'DUEL RESULT';
}

export type AsyncDuelPlayerFacingStatus =
  | 'YOUR TURN'
  | 'PLAYING'
  | 'WAITING FOR OPPONENT'
  | 'COMPLETED'
  | 'DECLINED'
  | 'EXPIRED'
  | 'CANCELLED'
  | 'INVALID';

export function mapAsyncDuelFacingStatus(input: {
  status: string;
  participantRole: AsyncDuelParticipantRole;
}): AsyncDuelPlayerFacingStatus {
  const { status, participantRole } = input;
  switch (status) {
    case 'awaiting_opponent':
      return participantRole === 'opponent' ? 'YOUR TURN' : 'WAITING FOR OPPONENT';
    case 'challenger_playing':
      return participantRole === 'challenger' ? 'PLAYING' : 'WAITING FOR OPPONENT';
    case 'opponent_playing':
      return participantRole === 'opponent' ? 'PLAYING' : 'WAITING FOR OPPONENT';
    case 'completed':
      return 'COMPLETED';
    case 'declined':
      return 'DECLINED';
    case 'expired':
      return 'EXPIRED';
    case 'cancelled':
      return 'CANCELLED';
    case 'invalid':
      return 'INVALID';
    default:
      return 'INVALID';
  }
}
