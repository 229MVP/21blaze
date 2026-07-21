import { create } from 'zustand';

import {
  GAME_DURATION_SECONDS,
  MAX_BUSTS,
  SCORE_CLEAR_21,
  SCORE_CLEAR_FIVE,
  START_COUNTDOWN_SECONDS,
} from '../game/constants';
import {
  createInitialGameState,
  getCardsRemaining,
  placeCardInLane,
} from '../game/gameEngine';
import {
  calculateElapsedGameMilliseconds,
  calculateTimeRemainingSeconds,
  isTimerExpired,
} from '../game/timerEngine';
import type {
  GameOverReason,
  GameState,
  LaneId,
  MoveEvent,
  MoveEventType,
} from '../game/types';
import { clearHighScore, saveHighScore } from '../storage/highScoreStorage';
import { createMatchId } from '../utils/createMatchId';
import { useScoreHistoryStore } from './useScoreHistoryStore';

type GameStore = GameState & {
  highScore: number;
  isProcessingMove: boolean;
  lastMoveEvent: MoveEvent | null;
  setHighScore: (score: number) => void;
  resetHighScore: () => Promise<void>;
  startGame: () => void;
  restartGame: () => void;
  resetGame: () => void;
  beginStartCountdown: () => void;
  updateStartCountdown: (value: number) => void;
  beginTimedGame: (now: number) => void;
  synchronizeTimer: (now: number) => void;
  pauseGame: (now: number) => void;
  resumeGame: (now: number) => void;
  endGame: (reason: GameOverReason) => void;
  quitGame: () => void;
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
  cardsPlayed: 0,
  timeRemainingSeconds: GAME_DURATION_SECONDS,
  timerStatus: 'ready',
  gameStartedAt: null,
  pauseStartedAt: null,
  totalPausedMilliseconds: 0,
  gameOverReason: null,
  startCountdownValue: START_COUNTDOWN_SECONDS,
  matchId: null,
};

function withNewMatchId(base: GameState): GameState {
  return {
    ...base,
    matchId: createMatchId(),
  };
}

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

function withFreshMatchState(base: GameState): GameState {
  return withNewMatchId({
    ...base,
    cardsPlayed: 0,
    timeRemainingSeconds: GAME_DURATION_SECONDS,
    timerStatus: base.activeCard ? 'countdown' : 'expired',
    gameStartedAt: null,
    pauseStartedAt: null,
    totalPausedMilliseconds: 0,
    gameOverReason: base.activeCard ? null : 'deckEmpty',
    startCountdownValue: START_COUNTDOWN_SECONDS,
  });
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

  resetHighScore: async () => {
    await clearHighScore();
    set({ highScore: 0 });
  },

  startGame: () => {
    const next = withFreshMatchState(createInitialGameState());
    set({
      ...next,
      isProcessingMove: false,
      lastMoveEvent: null,
    });
  },

  restartGame: () => {
    const next = withFreshMatchState(createInitialGameState());
    set({
      ...next,
      isProcessingMove: false,
      lastMoveEvent: null,
    });
  },

  resetGame: () => {
    set({
      ...idleGameState,
      highScore: get().highScore,
      isProcessingMove: false,
      lastMoveEvent: null,
    });
  },

  beginStartCountdown: () => {
    const current = get();
    if (current.status !== 'playing' || !current.activeCard) {
      return;
    }

    set({
      timerStatus: 'countdown',
      startCountdownValue: START_COUNTDOWN_SECONDS,
      gameStartedAt: null,
      pauseStartedAt: null,
      totalPausedMilliseconds: 0,
      timeRemainingSeconds: GAME_DURATION_SECONDS,
      gameOverReason: null,
    });
  },

  updateStartCountdown: (value) => {
    set({
      startCountdownValue: Math.max(0, value),
    });
  },

  beginTimedGame: (now) => {
    const current = get();
    if (current.status !== 'playing' || current.timerStatus === 'running') {
      return;
    }

    set({
      timerStatus: 'running',
      gameStartedAt: now,
      pauseStartedAt: null,
      totalPausedMilliseconds: 0,
      timeRemainingSeconds: GAME_DURATION_SECONDS,
      startCountdownValue: 0,
      gameOverReason: null,
    });
  },

  synchronizeTimer: (now) => {
    const current = get();

    if (
      current.status !== 'playing' ||
      current.timerStatus !== 'running' ||
      current.gameStartedAt === null
    ) {
      return;
    }

    const elapsed = calculateElapsedGameMilliseconds(
      now,
      current.gameStartedAt,
      current.totalPausedMilliseconds,
    );
    const remaining = calculateTimeRemainingSeconds(
      GAME_DURATION_SECONDS,
      elapsed,
    );

    if (isTimerExpired(remaining)) {
      get().endGame('timeExpired');
      return;
    }

    if (remaining !== current.timeRemainingSeconds) {
      set({ timeRemainingSeconds: remaining });
    }
  },

  pauseGame: (now) => {
    const current = get();

    if (
      current.status !== 'playing' ||
      current.timerStatus !== 'running' ||
      current.pauseStartedAt !== null
    ) {
      return;
    }

    set({
      timerStatus: 'paused',
      pauseStartedAt: now,
    });
  },

  resumeGame: (now) => {
    const current = get();

    if (
      current.status !== 'playing' ||
      current.timerStatus !== 'paused' ||
      current.pauseStartedAt === null
    ) {
      return;
    }

    const pauseDuration = Math.max(0, now - current.pauseStartedAt);

    set({
      timerStatus: 'running',
      pauseStartedAt: null,
      totalPausedMilliseconds: current.totalPausedMilliseconds + pauseDuration,
    });
  },

  endGame: (reason) => {
    const current = get();

    if (current.status === 'finished' && current.gameOverReason !== null) {
      return;
    }

    const nextHighScore = maybePersistHighScore(current.score, current.highScore);

    set({
      status: 'finished',
      timerStatus: reason === 'timeExpired' ? 'expired' : current.timerStatus,
      gameOverReason: reason,
      isProcessingMove: false,
      highScore: nextHighScore,
      pauseStartedAt: null,
    });

    const shouldRecord =
      reason === 'timeExpired' || reason === 'busts' || reason === 'deckEmpty';

    if (shouldRecord && current.matchId) {
      void useScoreHistoryStore.getState().recordScore({
        id: current.matchId,
        score: current.score,
        highScoreAtCompletion: nextHighScore,
        lanesCleared: current.clearedLanes,
        cardsPlayed: current.cardsPlayed,
        busts: current.busts,
        timeRemainingSeconds: current.timeRemainingSeconds,
        gameOverReason: reason,
        completedAt: new Date().toISOString(),
      });
    }
  },

  quitGame: () => {
    const current = get();
    if (current.status === 'playing' && current.gameOverReason === null) {
      // Mark quit without recording a leaderboard entry.
      set({
        status: 'finished',
        gameOverReason: 'quit',
        isProcessingMove: false,
        pauseStartedAt: null,
      });
    }

    const highScore = get().highScore;
    set({
      ...idleGameState,
      highScore,
      isProcessingMove: false,
      lastMoveEvent: null,
      gameOverReason: 'quit',
      status: 'idle',
      timerStatus: 'ready',
      matchId: null,
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
      current.timerStatus !== 'running' ||
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
      cardsPlayed: current.cardsPlayed,
      timeRemainingSeconds: current.timeRemainingSeconds,
      timerStatus: current.timerStatus,
      gameStartedAt: current.gameStartedAt,
      pauseStartedAt: current.pauseStartedAt,
      totalPausedMilliseconds: current.totalPausedMilliseconds,
      gameOverReason: current.gameOverReason,
      startCountdownValue: current.startCountdownValue,
      matchId: current.matchId,
    };

    const nextState = placeCardInLane(before, laneId);

    if (nextState === before) {
      set({ isProcessingMove: false });
      return;
    }

    const lastMoveEvent = createMoveEvent(before, nextState, laneId, cardId);
    const cardsPlayed = current.cardsPlayed + 1;

    set({
      ...nextState,
      cardsPlayed,
      lastMoveEvent,
      isProcessingMove: false,
    });

    if (nextState.busts >= MAX_BUSTS) {
      get().endGame('busts');
      return;
    }

    if (nextState.activeCard === null) {
      get().endGame('deckEmpty');
    }
  },

  getCardsRemaining: () => getCardsRemaining(get()),
}));
