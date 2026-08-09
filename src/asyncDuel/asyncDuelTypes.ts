export type AsyncDuelStatus =
  | 'challenger_playing'
  | 'awaiting_opponent'
  | 'opponent_playing'
  | 'completed'
  | 'declined'
  | 'expired'
  | 'cancelled'
  | 'invalid';

export type AsyncDuelOutcome = 'challenger_win' | 'opponent_win' | 'tie';

export type AsyncDuelAttemptStatus =
  | 'started'
  | 'completed'
  | 'abandoned'
  | 'invalid';

export type AsyncDuelParticipantRole = 'challenger' | 'opponent';

export type AsyncDuelDecidingField =
  | 'score'
  | 'exact_21'
  | 'five_card_clear'
  | 'bust_count'
  | 'completion_ms'
  | 'tie';

export type AsyncDuelErrorCode =
  | 'SELF_CHALLENGE'
  | 'PLAYER_NOT_FOUND'
  | 'PLAYER_NOT_ELIGIBLE'
  | 'ACTIVE_DUEL_LIMIT'
  | 'DUPLICATE_ACTIVE_DUEL'
  | 'DUEL_NOT_FOUND'
  | 'NOT_PARTICIPANT'
  | 'INVALID_DUEL_STATE'
  | 'ALREADY_STARTED'
  | 'ALREADY_COMPLETED'
  | 'DECLINED'
  | 'EXPIRED'
  | 'INVALID_RESULT'
  | 'ASYNC_DUEL_DISABLED'
  | 'NOT_AUTHENTICATED'
  | 'UNKNOWN';

export type AsyncDuelPublicParticipant = {
  userId: string;
  displayName: string;
  profileFrameId: string | null;
};

export type AsyncDuelAttemptResult = {
  attemptId: string;
  score: number | null;
  exact21Count: number | null;
  fiveCardClearCount: number | null;
  bustCount: number | null;
  cardsPlayed: number | null;
  lanesCleared: number | null;
  completionMs: number | null;
  status: AsyncDuelAttemptStatus;
};

export type AsyncDuel = {
  id: string;
  challengerId: string;
  opponentId: string;
  rulesVersion: string;
  deckVersion: string;
  durationSeconds: number;
  bustLimit: number;
  status: AsyncDuelStatus;
  winnerUserId: string | null;
  outcome: AsyncDuelOutcome | null;
  decidingField: AsyncDuelDecidingField | null;
  challengerCompletedAt: string | null;
  opponentStartedAt: string | null;
  opponentCompletedAt: string | null;
  expiresAt: string;
  settledAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AsyncDuelAttempt = {
  id: string;
  duelId: string;
  userId: string;
  participantRole: AsyncDuelParticipantRole;
  status: AsyncDuelAttemptStatus;
  startedAt: string;
  completedAt: string | null;
  score: number | null;
  exact21Count: number | null;
  fiveCardClearCount: number | null;
  bustCount: number | null;
  cardsPlayed: number | null;
  lanesCleared: number | null;
  completionMs: number | null;
  rulesVersion: string;
  deckVersion: string;
};

export type AsyncDuelInboxItem = {
  duelId: string;
  challenger: AsyncDuelPublicParticipant;
  challengerScore: number | null;
  rulesVersion: string;
  deckVersion: string;
  durationSeconds: number;
  bustLimit: number;
  createdAt: string;
  expiresAt: string;
  status: AsyncDuelStatus;
};

export type AsyncDuelStartResult = {
  duelId: string;
  attemptId: string;
  seed: string;
  rulesVersion: string;
  deckVersion: string;
  durationSeconds: number;
  bustLimit: number;
  status: AsyncDuelStatus;
  expiresAt: string;
  participantRole: AsyncDuelParticipantRole;
  alreadyStarted?: boolean;
  opponentId?: string;
};

export type AsyncDuelCompletionResult = {
  duelId: string;
  attemptId?: string;
  status: AsyncDuelStatus;
  alreadyCompleted?: boolean;
  score?: number | null;
  settled?: boolean;
  outcome?: AsyncDuelOutcome | null;
  winnerUserId?: string | null;
  decidingField?: AsyncDuelDecidingField | null;
  settledAt?: string | null;
  challengerResult?: AsyncDuelAttemptResult | null;
  opponentResult?: AsyncDuelAttemptResult | null;
};

export type AsyncDuelSettlement = {
  outcome: AsyncDuelOutcome;
  winnerUserId: string | null;
  decidingField: AsyncDuelDecidingField;
};

export type AsyncDuelGameResult = {
  score: number;
  exact21Count: number;
  fiveCardClearCount: number;
  bustCount: number;
  cardsPlayed: number;
  lanesCleared: number;
  completionMs: number;
  rulesVersion: string;
  deckVersion: string;
  submissionVersion?: string | null;
};

export type AsyncDuelHistoryItem = {
  duelId: string;
  status: AsyncDuelStatus;
  outcome: AsyncDuelOutcome | null;
  winnerUserId: string | null;
  opponent: AsyncDuelPublicParticipant;
  challengerScore: number | null;
  opponentScore: number | null;
  challengerCompletedAt: string | null;
  opponentCompletedAt: string | null;
  settledAt: string | null;
  updatedAt: string;
};
