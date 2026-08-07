/** Version 1.3.0 Phase 1 — Daily Challenge domain types (no `any`). */

export type DailyChallengeStatus = 'scheduled' | 'active' | 'published' | 'closed';

export type DailyChallengeAttemptStatus =
  | 'created'
  | 'started'
  | 'completed'
  | 'abandoned'
  | 'rejected'
  | 'expired'
  | 'invalid';

export type DailyChallengeAttemptType = 'ranked' | 'practice';

export type DailyChallenge = {
  id: string;
  challengeDate: string;
  rulesVersion: string;
  deckVersion: string;
  durationSeconds: number;
  bustLimit: number;
  status: DailyChallengeStatus;
};

export type DailyChallengeAttempt = {
  id: string;
  challengeId: string;
  attemptType: DailyChallengeAttemptType;
  status: DailyChallengeAttemptStatus;
  startedAt: string | null;
  completedAt: string | null;
  score: number | null;
  exact21Count: number | null;
  fiveCardClearCount: number | null;
  bustCount: number | null;
  cardsPlayed: number | null;
  completionMs: number | null;
  rulesVersion: string | null;
};

export type DailyChallengeStartResult = {
  attemptId: string;
  challengeId: string;
  challengeDate: string;
  seed: string;
  rulesVersion: string;
  deckVersion: string;
  durationSeconds: number;
  bustLimit: number;
  startedAt: string;
  resumed: boolean;
};

export type DailyChallengeCompletion = {
  alreadyCompleted: boolean;
  attemptId: string;
  score: number;
  exact21Count: number;
  fiveCardClearCount: number;
  bustCount: number;
  completionMs: number;
  rulesVersion: string;
  verificationStatus?: string;
};

export type DailyChallengeStartError =
  | 'ALREADY_PLAYED'
  | 'CHALLENGE_DISABLED'
  | 'ATTEMPT_NOT_AVAILABLE'
  | 'NOT_AUTHENTICATED';
