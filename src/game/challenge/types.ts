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
  | 'expired';

export type DailyChallengeVerificationStatus =
  | 'pending'
  | 'verified'
  | 'rejected'
  | 'failed';

export type DailyChallengeConfig = {
  challengeId: string;
  challengeDate: string;
  seed: number;
  rulesVersion: number;
  scoringVersion: number;
  durationSeconds: number;
  startsAt: string;
  endsAt: string;
};

export type DailyChallengeSession = {
  challengeId: string;
  attemptId: string;
  attemptType: DailyChallengeAttemptType;
  seed: number;
  rulesVersion: number;
  scoringVersion: number;
  serverStartTime: string;
  expiresAt: string;
  challengeDate: string;
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
  challengePoints: number | null;
  weeklyRank: number | null;
  participationCoins: number | null;
  participationXp: number | null;
  percentile: number | null;
  totalPlayers: number;
};
