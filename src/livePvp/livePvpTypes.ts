/**
 * Version 1.5 Phase 1 Live PvP domain types.
 * Transport payloads are validated at the service / channel boundary.
 */

import type { LIVE_PVP_PROTOCOL_VERSION } from './livePvpConfig';

export type LiveMatchProtocolVersion = typeof LIVE_PVP_PROTOCOL_VERSION | string;
export type LiveMatchStateVersion = number;

export type LiveMatchStatus =
  | 'invited'
  | 'lobby'
  | 'countdown'
  | 'active'
  | 'settling'
  | 'completed'
  | 'declined'
  | 'cancelled'
  | 'expired'
  | 'invalid';

export type LiveMatchOutcome =
  | 'challenger_win'
  | 'opponent_win'
  | 'tie'
  | 'no_contest';

export type LiveMatchCompletionReason = 'normal' | 'forfeit' | 'timeout' | 'invalid';

export type LiveMatchParticipantRole = 'challenger' | 'opponent';

export type LiveMatchAttemptStatus =
  | 'pending'
  | 'active'
  | 'completed'
  | 'forfeited'
  | 'timed_out'
  | 'invalid';

export type LiveMatchDecidingField =
  | 'score'
  | 'exact_21'
  | 'five_card_clear'
  | 'busts'
  | 'completion_ms'
  | 'forfeit'
  | string;

export type LiveMatchPublicParticipant = {
  userId: string;
  displayName: string;
  profileFrameId?: string | null;
};

export type LiveMatchConfiguration = {
  protocolVersion: LiveMatchProtocolVersion;
  rulesVersion: string;
  deckVersion: string;
  durationSeconds: number;
  bustLimit: number;
  seed: string | null;
};

export type LiveMatch = {
  id: string;
  status: LiveMatchStatus;
  stateVersion: LiveMatchStateVersion;
  protocolVersion: LiveMatchProtocolVersion;
  realtimeTopic: string;
  challengerId: string;
  opponentId: string;
  scheduledStartAt: string | null;
  gameplayDeadlineAt: string | null;
  submissionGraceUntil: string | null;
  expiresAt: string;
  outcome: LiveMatchOutcome | null;
  winnerUserId: string | null;
  decidingField: LiveMatchDecidingField | null;
  completionReason: LiveMatchCompletionReason | null;
  settledAt: string | null;
} & Partial<LiveMatchConfiguration>;

export type LiveMatchParticipant = {
  matchId: string;
  userId: string;
  participantRole: LiveMatchParticipantRole;
  activeSlot: boolean;
  readyAt: string | null;
  joinedAt: string | null;
};

export type LiveMatchAttempt = {
  attemptId: string;
  status: LiveMatchAttemptStatus;
  score: number | null;
  completedAt: string | null;
};

export type LiveMatchProgress = {
  userId: string;
  sequence: number;
  score: number;
  exact21Count: number;
  fiveCardClearCount: number;
  bustCount: number;
  cardsPlayed: number;
  lanesCleared: number;
  clientElapsedMs?: number;
  serverReceivedAt?: string;
};

export type LiveMatchSnapshot = {
  matchId: string;
  status: LiveMatchStatus;
  stateVersion: LiveMatchStateVersion;
  protocolVersion: LiveMatchProtocolVersion;
  realtimeTopic: string;
  participantRole: LiveMatchParticipantRole;
  challenger: LiveMatchPublicParticipant;
  opponent: LiveMatchPublicParticipant;
  challengerReady: boolean;
  opponentReady: boolean;
  scheduledStartAt: string | null;
  gameplayDeadlineAt: string | null;
  submissionGraceUntil: string | null;
  expiresAt: string;
  rulesVersion: string | null;
  deckVersion: string | null;
  durationSeconds: number | null;
  bustLimit: number | null;
  seed: string | null;
  seedAvailable: boolean;
  outcome: LiveMatchOutcome | null;
  winnerUserId: string | null;
  decidingField: LiveMatchDecidingField | null;
  completionReason: LiveMatchCompletionReason | null;
  settledAt: string | null;
  myAttempt: LiveMatchAttempt | null;
  myLatestProgressSequence: number;
  progress: LiveMatchProgress[];
  serverNow: string;
  gameplayEligible: boolean;
};

export type LiveMatchRealtimeEventType =
  | 'MATCH_SNAPSHOT_CHANGED'
  | 'PARTICIPANT_JOINED'
  | 'PARTICIPANT_READY'
  | 'COUNTDOWN_SCHEDULED'
  | 'MATCH_ACTIVE'
  | 'PROGRESS_ACCEPTED'
  | 'PARTICIPANT_FINISHED'
  | 'PARTICIPANT_FORFEITED'
  | 'PARTICIPANT_TIMED_OUT'
  | 'MATCH_SETTLED'
  | 'MATCH_CANCELLED'
  | 'MATCH_EXPIRED'
  | 'MATCH_INVALIDATED';

export type LiveMatchRealtimeEvent = {
  protocolVersion: LiveMatchProtocolVersion;
  eventId: string;
  matchId: string;
  stateVersion: LiveMatchStateVersion;
  eventType: LiveMatchRealtimeEventType;
  serverOccurredAt: string;
  payload: Record<string, unknown>;
};

export type LiveMatchSettlement = {
  outcome: LiveMatchOutcome;
  decidingField: LiveMatchDecidingField | null;
  winnerUserId: string | null;
  completionReason: LiveMatchCompletionReason;
};

export type LiveMatchErrorCode =
  | 'LIVE_PVP_DISABLED'
  | 'SELF_INVITE'
  | 'PLAYER_NOT_FOUND'
  | 'PLAYER_NOT_ELIGIBLE'
  | 'ACTIVE_MATCH_LIMIT'
  | 'INVITE_LIMIT'
  | 'DUPLICATE_INVITE'
  | 'MATCH_NOT_FOUND'
  | 'NOT_PARTICIPANT'
  | 'INVALID_MATCH_STATE'
  | 'INVITE_EXPIRED'
  | 'ALREADY_ACCEPTED'
  | 'ALREADY_READY'
  | 'COUNTDOWN_ALREADY_SCHEDULED'
  | 'MATCH_NOT_ACTIVE'
  | 'PROGRESS_RATE_LIMITED'
  | 'STALE_PROGRESS_SEQUENCE'
  | 'ATTEMPT_ALREADY_COMPLETED'
  | 'SUBMISSION_TOO_LATE'
  | 'MATCH_ALREADY_SETTLED'
  | 'PROTOCOL_VERSION_UNSUPPORTED'
  | 'REMATCH_NOT_ELIGIBLE'
  | 'NOT_AUTHENTICATED'
  | 'UNKNOWN';

export type LivePvpPlayerRecord = {
  completedMatches: number;
  wins: number;
  losses: number;
  ties: number;
  noContests: number;
  forfeitsAgainst: number;
  timeouts: number;
  winRate: number;
  recentForm: LivePvpRecordFormEntry[];
  serverNow: string;
};

export type LivePvpHeadToHeadRecord = {
  opponentId: string;
  opponent: LiveMatchPublicParticipant;
  completedMatches: number;
  wins: number;
  losses: number;
  ties: number;
  noContests: number;
  winRate: number;
  recentForm: LivePvpRecordFormEntry[];
  serverNow: string;
};

export type LivePvpRecordFormEntry = {
  matchId: string;
  outcome: LiveMatchOutcome | null;
  winnerUserId: string | null;
  completionReason: LiveMatchCompletionReason | null;
  settledAt: string | null;
  perspective: 'win' | 'loss' | 'tie' | 'no_contest' | 'unknown';
};

export type LivePvpRematchResult = {
  matchId: string;
  status: string;
  realtimeTopic: string;
  protocolVersion: string;
  stateVersion: number;
  expiresAt: string;
  participantRole: LiveMatchParticipantRole;
  opponent: LiveMatchPublicParticipant;
  rematchOfMatchId: string;
  alreadyExisted: boolean;
  serverNow: string;
};

export type LiveMatchProgressInput = {
  sequence: number;
  score: number;
  exact21Count: number;
  fiveCardClearCount: number;
  bustCount: number;
  cardsPlayed: number;
  lanesCleared: number;
  clientElapsedMs: number;
};

export type LiveMatchResultInput = {
  score: number;
  exact21Count: number;
  fiveCardClearCount: number;
  bustCount: number;
  cardsPlayed: number;
  lanesCleared: number;
  completionMs: number;
  rulesVersion: string;
  deckVersion: string;
  submissionVersion?: string;
};
