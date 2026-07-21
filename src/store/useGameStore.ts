import { create } from 'zustand';

import { SCORE_CLEAR_21, SCORE_CLEAR_FIVE } from '../game/constants';
import {
  createInitialGameState,
  getCardsRemaining,
  placeCardInLane,
} from '../game/gameEngine';
import type { GameState, LaneId, MoveEvent, MoveEventType } from '../game/types';
import { saveHighScore } from '../storage/highScoreStorage';

type GameStore = GameState & {
  highScore: number;
  isProcessingMove: boolean;
  lastMoveEvent: MoveEvent | null;
  setHighScore: (score: number) => void;
  startGame: () => void;
  restartGame: () => void;
  resetGame: () => void;
  playCardToLane: (laneId: LaneId) => void;
  clearLastMoveEvent: () => void;
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

let moveEventSequence = 0;

function maybePersistHighScore(score: number, highScore: number): number {
  if (score > highScore) {
    void saveHighScore(score);
    return score;
  }

  return highScore;
}

function resolveMoveEventType(
  before: GameState,
  after: GameState,
): MoveEventType {
  if (after.busts > before.busts) {
    return 'bust';
  }

  const pointsAwarded = after.score - before.score;

  if (pointsAwarded <= 0) {
    return 'placed';
  }

  const fiveCardPoints = SCORE_CLEAR_FIVE * before.multiplier;
  if (pointsAwarded === fiveCardPoints) {
    return 'clearedFiveCard';
  }

  const exact21Points = SCORE_CLEAR_21 * before.multiplier;
  if (pointsAwarded === exact21Points) {
    return 'cleared21';
  }

  return pointsAwarded >= fiveCardPoints ? 'clearedFiveCard' : 'cleared21';
}

function createMoveEvent(
  before: GameState,
  after: GameState,
  laneId: LaneId,
  cardId: string,
): MoveEvent {
  moveEventSequence += 1;
  const type = resolveMoveEventType(before, after);
  const rawPoints = after.score - before.score;
  const pointsAwarded =
    type === 'cleared21' || type === 'clearedFiveCard' ? rawPoints : 0;

  return {
    id: `move-${moveEventSequence}-${cardId}-lane${laneId}-${type}`,
    type,
    laneId,
    cardId,
    pointsAwarded,
    multiplierBefore: before.multiplier,
    multiplierAfter: after.multiplier,
    bustsAfter: after.busts,
  };
}

export const useGameStore = create<GameStore>((set, get) => ({
  ...idleGameState,
  highScore: 0,
  isProcessingMove: false,
  lastMoveEvent: null,

  setHighScore: (score) => {
    const normalized = Number.isFinite(score) && score > 0 ? Math.floor(score) : 0;
    set({ highScore: normalized });
  },

  startGame: () => {
    const next = createInitialGameState();
    set({
      ...next,
      isProcessingMove: false,
      lastMoveEvent: null,
    });
  },

  restartGame: () => {
    const next = createInitialGameState();
    set({
      ...next,
      isProcessingMove: false,
      lastMoveEvent: null,
    });
  },

  resetGame: () => {
    set({
      ...idleGameState,
      isProcessingMove: false,
      lastMoveEvent: null,
    });
  },

  clearLastMoveEvent: () => {
    set({ lastMoveEvent: null });
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

    const cardId = current.activeCard.id;
    set({ isProcessingMove: true });

    const before: GameState = {
      status: current.status,
      deck: current.deck,
      activeCard: current.activeCard,
      lanes: current.lanes,
      score: current.score,
      multiplier: current.multiplier,
      busts: current.busts,
      clearedLanes: current.clearedLanes,
    };

    const nextState = placeCardInLane(before, laneId);

    if (nextState === before) {
      set({ isProcessingMove: false });
      return;
    }

    const lastMoveEvent = createMoveEvent(before, nextState, laneId, cardId);
    const nextHighScore = maybePersistHighScore(nextState.score, get().highScore);

    set({
      ...nextState,
      highScore: nextHighScore,
      lastMoveEvent,
      isProcessingMove: false,
    });
  },

  getCardsRemaining: () => getCardsRemaining(get()),
}));
