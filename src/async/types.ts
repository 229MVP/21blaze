/** Version 1.4A — Async challenge typed configuration. */

export const ASYNC_CHALLENGE_RULES_VERSION = 1;
export const ASYNC_CHALLENGE_SCORING_VERSION = 1;
export const ASYNC_CHALLENGE_EXPIRY_HOURS = 48;
export const ASYNC_CHALLENGE_RESUME_WINDOW_MS = 5 * 60 * 1000;

export type AsyncChallengeStatus =
  | 'open'
  | 'accepted'
  | 'in_progress'
  | 'awaiting_opponent'
  | 'verifying'
  | 'completed'
  | 'expired'
  | 'cancelled'
  | 'rejected';

export type AsyncChallengeResultType =
  | 'creator_win'
  | 'opponent_win'
  | 'draw'
  | 'expired'
  | 'cancelled'
  | 'invalid';

export type PublicAttemptStatus = 'WAITING' | 'PLAYED' | 'VERIFIED';

export type AsyncChallengeParticipant = {
  userId: string;
  displayName: string;
  profileFrameId: string;
  playerTitleId: string | null;
  level: number | null;
  attemptStatus: PublicAttemptStatus;
};

export type AsyncChallengeVerifiedStats = {
  score: number;
  exact21Count: number;
  fiveCardClears: number;
  bustCount: number;
  bestMultiplier: number;
  elapsedTimeMs: number;
  lanesCleared: number;
  gameOverReason: string | null;
};

export type AsyncChallengeSummary = {
  challengeId: string;
  status: AsyncChallengeStatus;
  resultType: AsyncChallengeResultType | null;
  winnerUserId: string | null;
  rulesVersion: number;
  scoringVersion: number;
  durationSeconds: number;
  createdAt: string;
  acceptedAt: string | null;
  expiresAt: string;
  completedAt: string | null;
  finalizedAt: string | null;
  inviteCode?: string;
  creator: AsyncChallengeParticipant;
  opponent: AsyncChallengeParticipant | null;
  yourAttemptStatus: PublicAttemptStatus | null;
  yourVerifiedResult: AsyncChallengeVerifiedStats | null;
  opponentVerifiedResult: AsyncChallengeVerifiedStats | null;
  isYourTurn: boolean;
};

export type AsyncChallengeSession = {
  challengeId: string;
  attemptId: string;
  participantRole: 'creator' | 'opponent';
  seed: number;
  rulesVersion: number;
  scoringVersion: number;
  serverStartTime: string;
  expiresAt: string;
  challengeExpiresAt: string;
};

export type AsyncChallengeInvitePreview = {
  challengeId: string;
  status: AsyncChallengeStatus;
  expiresAt: string;
  durationSeconds: number;
  rulesVersion: number;
  scoringVersion: number;
  creator: Omit<AsyncChallengeParticipant, 'userId' | 'attemptStatus'>;
  hasOpponent: boolean;
  canAccept: boolean;
};
