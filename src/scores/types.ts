import type { GameOverReason } from '../game/types';

export type ScoreEntry = {
  id: string;
  score: number;
  highScoreAtCompletion: number;
  lanesCleared: number;
  cardsPlayed: number;
  busts: number;
  timeRemainingSeconds: number;
  gameOverReason: GameOverReason;
  completedAt: string;
};

export const MAX_SCORE_HISTORY = 10;
