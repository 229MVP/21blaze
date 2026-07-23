import type { GameOverReason } from '../game/types';

export type OnlineEligibility = 'verified' | 'localOnly';

export type SubmissionStatus =
  | 'idle'
  | 'submitting'
  | 'verified'
  | 'rejected'
  | 'failed';

export type OnlineMatchState = {
  eligibility: OnlineEligibility;
  onlineMatchId: string | null;
  deckSeed: number | null;
  startedAtServer: string | null;
  expiresAtServer: string | null;
  submissionStatus: SubmissionStatus;
  rejectionReason: string | null;
};

export type MoveLogEntry = {
  sequence: number;
  laneId: number;
  elapsedMilliseconds: number;
};

export type StartMatchResponse = {
  matchId: string;
  seed: number;
  startedAt: string;
  expiresAt: string;
  durationSeconds: number;
};

export type OfficialMatchResult = {
  score: number;
  lanesCleared: number;
  cardsPlayed: number;
  busts: number;
  timeRemainingSeconds: number;
  gameOverReason: Exclude<GameOverReason, 'quit'>;
};

export type SubmitMatchResponse = {
  verified: boolean;
  scoreId?: string;
  officialResult?: OfficialMatchResult;
  rejectionReason?: string;
};

export const IDLE_ONLINE_MATCH_STATE: OnlineMatchState = {
  eligibility: 'localOnly',
  onlineMatchId: null,
  deckSeed: null,
  startedAtServer: null,
  expiresAtServer: null,
  submissionStatus: 'idle',
  rejectionReason: null,
};
