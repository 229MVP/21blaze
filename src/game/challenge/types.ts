/** Version 1.3A — Daily Challenge typed configuration. */

export const DAILY_CHALLENGE_RULES_VERSION = 1;
export const DAILY_CHALLENGE_SCORING_VERSION = 1;

export type DailyChallengeAttemptType = 'ranked' | 'practice';

export type DailyChallengeAttemptStatus =
  | 'created'
  | 'started'
  | 'completed'
  | 'abandoned'
  | 'rejected'
  | 'expired'
  | 'invalid';

export type DailyChallengeVerificationStatus =
  | 'pending'
  | 'verified'
  | 'rejected'
  | 'failed';

/** Cached / offline challenge metadata (no authoritative seed until start RPC). */
export type DailyChallengeConfig = {
  challengeId: string;
  challengeDate: string;
  rulesVersion: string;
  deckVersion: string;
  durationSeconds: number;
  bustLimit: number;
  status: string;
  /** Populated after ranked start or from secure cache for practice offline. */
  authoritativeSeed?: string;
};

export type DailyChallengeSession = {
  challengeId: string;
  attemptId: string;
  attemptType: DailyChallengeAttemptType;
  authoritativeSeed: string;
  rulesVersion: string;
  deckVersion: string;
  durationSeconds: number;
  bustLimit: number;
  serverStartTime: string;
  expiresAt: string;
  challengeDate: string;
  resumed?: boolean;
};

export type DailyChallengeRankedAttempt = {
  id: string;
  status: DailyChallengeAttemptStatus;
  verifiedScore: number | null;
  exact21Count: number | null;
  fiveCardClearCount: number | null;
  bustCount: number | null;
  completionMs: number | null;
  startedAt: string | null;
  completedAt: string | null;
};

export type DailyChallengeCompletionSummary = {
  score: number;
  exact21Count: number;
  fiveCardClearCount: number;
  bustCount: number;
  completionMs: number;
  rulesVersion: string;
  alreadyCompleted: boolean;
};

export type DailyChallengeVerifiedResult = {
  score: number;
  lanesCleared: number;
  exact21Count: number;
  fiveCardClears: number;
  bustCount: number;
  bestMultiplier: number;
  elapsedTimeMs: number;
  gameOverReason: string;
  rank: number | null;
  percentile: number | null;
  totalPlayers: number;
};
