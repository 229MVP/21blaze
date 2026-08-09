import type { Card } from './types';

/** Canonical play modes — Daily uses `attemptType` on the session for ranked vs practice. */
export type GamePlayMode = 'solo' | 'daily_challenge';

export type GameSessionConfig = {
  mode: GamePlayMode;
  deck: Card[];
  durationSeconds: number;
  bustLimit: number;
  attemptId?: string;
  challengeId?: string;
  challengeDate?: string;
  rulesVersion?: string;
  deckVersion?: string;
  attemptType?: 'ranked' | 'practice';
  authoritativeSeed?: string;
};
