import { create } from 'zustand';

import {
  createInitialGameState,
  getCardsRemaining,
  placeCardInLane,
} from '../game/gameEngine';
import type { GameState, LaneId } from '../game/types';
import { saveHighScore } from '../storage/highScoreStorage';

type GameStore = GameState & {
  highScore: number;
  isProcessingMove: boolean;
  setHighScore: (score: number) => void;
  startGame: () => void;
  restartGame: () => void;
  resetGame: () => void;
  playCardToLane: (laneId: LaneId) => void;
  getCardsRemaining: () => number;
};

const idleGameState: GameState = {
  status: 'idle',
  deck: [],
  activeCard: null,
  lanes: [],
  score: 0,
  multiplier: 1,
  busts: 0,
  clearedLanes: 0,
};

function maybePersistHighScore(score: number, highScore: number): number {
  if (score > highScore) {
    void saveHighScore(score);
    return score;
  }

  return highScore;
}

export const useGameStore = create<GameStore>((set, get) => ({
  ...idleGameState,
  highScore: 0,
  isProcessingMove: false,

  setHighScore: (score) => {
    const normalized = Number.isFinite(score) && score > 0 ? Math.floor(score) : 0;
    set({ highScore: normalized });
  },

  startGame: () => {
    const next = createInitialGameState();
    set({
      ...next,
      isProcessingMove: false,
    });
  },

  restartGame: () => {
    const next = createInitialGameState();
    set({
      ...next,
      isProcessingMove: false,
    });
  },

  resetGame: () => {
    set({
      ...idleGameState,
      isProcessingMove: false,
    });
  },

  playCardToLane: (laneId) => {
    const current = get();

    if (
      current.isProcessingMove ||
      current.status !== 'playing' ||
      current.activeCard === null
    ) {
      return;
    }

    set({ isProcessingMove: true });

    const nextState = placeCardInLane(get(), laneId);
    const nextHighScore = maybePersistHighScore(nextState.score, get().highScore);

    set({
      ...nextState,
      highScore: nextHighScore,
      isProcessingMove: false,
    });
  },

  getCardsRemaining: () => getCardsRemaining(get()),
}));
