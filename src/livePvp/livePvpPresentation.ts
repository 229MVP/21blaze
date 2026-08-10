import type {
  LiveMatchCompletionReason,
  LiveMatchOutcome,
  LiveMatchParticipantRole,
  LiveMatchPublicParticipant,
  LiveMatchSnapshot,
  LiveMatchStatus,
} from './livePvpTypes';

export type LivePvpFacingLabel =
  | 'INVITED'
  | 'WAITING FOR RESPONSE'
  | 'LOBBY'
  | 'READY'
  | 'STARTING'
  | 'LIVE'
  | 'RECONNECTING'
  | 'FINISHED'
  | 'VICTORY'
  | 'DEFEAT'
  | 'TIE'
  | 'NO CONTEST'
  | 'DECLINED'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'INVALID';

export type LivePvpPerspective =
  | 'victory'
  | 'defeat'
  | 'tie'
  | 'no_contest'
  | 'pending';

export function livePvpOtherPlayer(
  snapshot: LiveMatchSnapshot,
): LiveMatchPublicParticipant {
  return snapshot.participantRole === 'challenger'
    ? snapshot.opponent
    : snapshot.challenger;
}

export function livePvpMyReady(snapshot: LiveMatchSnapshot): boolean {
  return snapshot.participantRole === 'challenger'
    ? snapshot.challengerReady
    : snapshot.opponentReady;
}

export function livePvpOpponentReady(snapshot: LiveMatchSnapshot): boolean {
  return snapshot.participantRole === 'challenger'
    ? snapshot.opponentReady
    : snapshot.challengerReady;
}

export function livePvpStatusLabel(status: LiveMatchStatus): string {
  switch (status) {
    case 'invited':
      return 'INVITED';
    case 'lobby':
      return 'LOBBY';
    case 'countdown':
      return 'STARTING';
    case 'active':
      return 'LIVE';
    case 'settling':
      return 'SETTLING';
    case 'completed':
      return 'FINISHED';
    case 'declined':
      return 'DECLINED';
    case 'cancelled':
      return 'CANCELLED';
    case 'expired':
      return 'EXPIRED';
    case 'invalid':
      return 'INVALID';
    default:
      return 'LIVE PVP';
  }
}

export function mapLivePvpFacingStatus(input: {
  status: LiveMatchStatus;
  participantRole: LiveMatchParticipantRole;
  youReady?: boolean;
  opponentReady?: boolean;
  connection?: 'subscribed' | 'reconnecting' | 'other';
}): LivePvpFacingLabel {
  const { status, participantRole, youReady, opponentReady, connection } = input;
  if (connection === 'reconnecting' && (status === 'countdown' || status === 'active')) {
    return 'RECONNECTING';
  }
  switch (status) {
    case 'invited':
      return participantRole === 'challenger' ? 'WAITING FOR RESPONSE' : 'INVITED';
    case 'lobby':
      if (youReady && opponentReady) {
        return 'READY';
      }
      if (youReady) {
        return 'READY';
      }
      return 'LOBBY';
    case 'countdown':
      return 'STARTING';
    case 'active':
      return 'LIVE';
    case 'settling':
      return 'FINISHED';
    case 'completed':
      return 'FINISHED';
    case 'declined':
      return 'DECLINED';
    case 'cancelled':
      return 'CANCELLED';
    case 'expired':
      return 'EXPIRED';
    case 'invalid':
      return 'INVALID';
    default:
      return 'LOBBY';
  }
}

export function livePvpPerspective(
  outcome: LiveMatchOutcome | null | undefined,
  role: LiveMatchParticipantRole,
): Exclude<LivePvpPerspective, 'pending'> {
  if (outcome == null || outcome === 'no_contest') {
    return 'no_contest';
  }
  if (outcome === 'tie') {
    return 'tie';
  }
  if (outcome === 'challenger_win') {
    return role === 'challenger' ? 'victory' : 'defeat';
  }
  return role === 'opponent' ? 'victory' : 'defeat';
}

export function livePvpPerspectiveTitle(
  perspective: Exclude<LivePvpPerspective, 'pending'>,
): string {
  switch (perspective) {
    case 'victory':
      return 'VICTORY';
    case 'defeat':
      return 'DEFEAT';
    case 'tie':
      return 'TIE';
    case 'no_contest':
      return 'NO CONTEST';
  }
}

export type LivePvpPresentedResult = {
  perspective: LivePvpPerspective;
  headline: string;
  subline: string | null;
  reasonLabel: string | null;
  myScore: number | null;
  opponentScore: number | null;
};

function progressScoreForUser(
  snapshot: LiveMatchSnapshot,
  userId: string,
): number | null {
  const row = snapshot.progress.find((p) => p.userId === userId);
  return row ? row.score : null;
}

export function presentLiveMatchResult(
  snapshot: LiveMatchSnapshot,
): LivePvpPresentedResult {
  const other = livePvpOtherPlayer(snapshot);
  const myUserId =
    snapshot.participantRole === 'challenger'
      ? snapshot.challenger.userId
      : snapshot.opponent.userId;
  const myScore =
    snapshot.myAttempt?.score ?? progressScoreForUser(snapshot, myUserId);
  const opponentScore = progressScoreForUser(snapshot, other.userId);

  if (snapshot.status !== 'completed') {
    return {
      perspective: 'pending',
      headline: livePvpStatusLabel(snapshot.status),
      subline: null,
      reasonLabel: null,
      myScore,
      opponentScore,
    };
  }

  const perspective = livePvpPerspective(snapshot.outcome, snapshot.participantRole);
  let subline: string | null = null;
  if (snapshot.completionReason === 'forfeit') {
    subline =
      perspective === 'victory'
        ? `${other.displayName} forfeited.`
        : 'You forfeited.';
  } else if (snapshot.completionReason === 'timeout') {
    subline = 'Decided by timeout.';
  } else if (perspective === 'victory') {
    subline = `Won by ${livePvpDecidingLabel(snapshot.decidingField).toLowerCase()}`;
  } else if (perspective === 'defeat') {
    subline = `Lost by ${livePvpDecidingLabel(snapshot.decidingField).toLowerCase()}`;
  } else if (perspective === 'tie') {
    subline = livePvpDecidingLabel(snapshot.decidingField);
  } else {
    subline = 'Neither result qualified for settlement.';
  }

  return {
    perspective,
    headline: livePvpPerspectiveTitle(perspective),
    subline,
    reasonLabel: livePvpCompletionReasonLabel(snapshot.completionReason),
    myScore,
    opponentScore,
  };
}

export function livePvpDecidingLabel(field: string | null | undefined): string {
  switch (field) {
    case 'score':
      return 'Score';
    case 'exact_21':
      return 'Exact 21s';
    case 'five_card_clear':
      return 'Five-Card Clears';
    case 'busts':
      return 'Fewer busts';
    case 'completion_ms':
      return 'Faster finish';
    case 'forfeit':
      return 'Forfeit';
    default:
      return 'All tie-breakers equal';
  }
}

export function livePvpCompletionReasonLabel(
  reason: LiveMatchCompletionReason | null | undefined,
): string {
  switch (reason) {
    case 'forfeit':
      return 'Forfeit';
    case 'timeout':
      return 'Timeout';
    case 'invalid':
      return 'Invalidated';
    case 'normal':
    default:
      return 'Normal';
  }
}
