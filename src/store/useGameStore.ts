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
  createInitialGameStateFromSeed,
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
import {
  IDLE_ONLINE_MATCH_STATE,
  type GameMode,
  type MoveLogEntry,
  type OfficialMatchResult,
  type OnlineMatchState,
  type SubmissionStatus,
} from '../online/types';
import {
  OnlineMatchServiceError,
  startOnlineMatch,
  submitOnlineMatch,
} from '../services/onlineMatchService';
import type { DailyChallengeSession } from '../game/challenge/types';
import { useDailyChallengeStore } from './useDailyChallengeStore';
import { clearHighScore, saveHighScore } from '../storage/highScoreStorage';
import { createMatchId } from '../utils/createMatchId';
import { useScoreHistoryStore } from './useScoreHistoryStore';

type GameStore = GameState &
  OnlineMatchState & {
    gameMode: GameMode;
    dailyChallengeSession: DailyChallengeSession | null;
    dailyChallengeFirstMoveRecorded: boolean;
    highScore: number;
    isProcessingMove: boolean;
    lastMoveEvent: MoveEvent | null;
    moveLog: MoveLogEntry[];
    officialResult: OfficialMatchResult | null;
    isPreparingMatch: boolean;
    setHighScore: (score: number) => void;
    resetHighScore: () => Promise<void>;
    prepareAndStartGame: () => Promise<void>;
    prepareDailyChallengeGame: (session: DailyChallengeSession) => Promise<void>;
    startGame: () => void;
    restartGame: () => void;
    resetGame: () => void;
    clearDailyChallengeMode: () => void;
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
    submitVerifiedMatchIfNeeded: () => Promise<void>;
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
const submittedOnlineMatchIds = new Set<string>();
let submissionPromise: Promise<void> | null = null;

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

function toGameSlice(state: GameState): GameState {
  return {
    status: state.status,
    deck: state.deck,
    activeCard: state.activeCard,
    lanes: state.lanes,
    score: state.score,
    multiplier: state.multiplier,
    busts: state.busts,
    clearedLanes: state.clearedLanes,
    cardsPlayed: state.cardsPlayed,
    timeRemainingSeconds: state.timeRemainingSeconds,
    timerStatus: state.timerStatus,
    gameStartedAt: state.gameStartedAt,
    pauseStartedAt: state.pauseStartedAt,
    totalPausedMilliseconds: state.totalPausedMilliseconds,
    gameOverReason: state.gameOverReason,
    startCountdownValue: state.startCountdownValue,
    matchId: state.matchId,
  };
}

function resetOnlineFields(): OnlineMatchState & {
  moveLog: MoveLogEntry[];
  officialResult: OfficialMatchResult | null;
} {
  return {
    ...IDLE_ONLINE_MATCH_STATE,
    moveLog: [],
    officialResult: null,
  };
}

export const useGameStore = create<GameStore>((set, get) => ({
  ...idleGameState,
  ...IDLE_ONLINE_MATCH_STATE,
  gameMode: 'solo',
  dailyChallengeSession: null,
  dailyChallengeFirstMoveRecorded: false,
  highScore: 0,
  isProcessingMove: false,
  lastMoveEvent: null,
  moveLog: [],
  officialResult: null,
  isPreparingMatch: false,

  setHighScore: (score) => {
    const normalized = Number.isFinite(score) && score > 0 ? Math.floor(score) : 0;
    set({ highScore: normalized });
  },

  resetHighScore: async () => {
    await clearHighScore();
    set({ highScore: 0 });
  },

  prepareAndStartGame: async () => {
    if (get().isPreparingMatch) {
      return;
    }

    set({
      ...idleGameState,
      ...resetOnlineFields(),
      highScore: get().highScore,
      isPreparingMatch: true,
      isProcessingMove: false,
      lastMoveEvent: null,
      status: 'idle',
      timerStatus: 'ready',
    });

    try {
      const online = await startOnlineMatch();
      const next = withFreshMatchState(createInitialGameStateFromSeed(online.seed));
      set({
        ...next,
        eligibility: 'verified',
        onlineMatchId: online.matchId,
        deckSeed: online.seed,
        startedAtServer: online.startedAt,
        expiresAtServer: online.expiresAt,
        submissionStatus: 'idle',
        rejectionReason: null,
        moveLog: [],
        officialResult: null,
        isPreparingMatch: false,
        isProcessingMove: false,
        lastMoveEvent: null,
      });
    } catch {
      const next = withFreshMatchState(createInitialGameState());
      set({
        ...next,
        ...resetOnlineFields(),
        eligibility: 'localOnly',
        isPreparingMatch: false,
        isProcessingMove: false,
        lastMoveEvent: null,
      });
    }
  },

  prepareDailyChallengeGame: async (session) => {
    if (get().isPreparingMatch) {
      return;
    }

    set({
      ...idleGameState,
      ...resetOnlineFields(),
      gameMode: 'dailyChallenge',
      dailyChallengeSession: session,
      dailyChallengeFirstMoveRecorded: false,
      highScore: get().highScore,
      isPreparingMatch: true,
      isProcessingMove: false,
      lastMoveEvent: null,
      status: 'idle',
      timerStatus: 'ready',
    });

    const next = withFreshMatchState(createInitialGameStateFromSeed(session.seed));
    set({
      ...next,
      gameMode: 'dailyChallenge',
      dailyChallengeSession: session,
      dailyChallengeFirstMoveRecorded: false,
      eligibility: session.attemptType === 'ranked' ? 'verified' : 'localOnly',
      onlineMatchId: session.attemptId,
      deckSeed: session.seed,
      startedAtServer: session.serverStartTime,
      expiresAtServer: session.expiresAt,
      submissionStatus: 'idle',
      rejectionReason: null,
      moveLog: [],
      officialResult: null,
      isPreparingMatch: false,
      isProcessingMove: false,
      lastMoveEvent: null,
    });
  },

  clearDailyChallengeMode: () => {
    set({
      gameMode: 'solo',
      dailyChallengeSession: null,
      dailyChallengeFirstMoveRecorded: false,
    });
  },

  startGame: () => {
    void get().prepareAndStartGame();
  },

  restartGame: () => {
    if (get().gameMode === 'dailyChallenge') {
      return;
    }
    void get().prepareAndStartGame();
  },

  resetGame: () => {
    set({
      ...idleGameState,
      ...resetOnlineFields(),
      gameMode: 'solo',
      dailyChallengeSession: null,
      dailyChallengeFirstMoveRecorded: false,
      highScore: get().highScore,
      isProcessingMove: false,
      lastMoveEvent: null,
      isPreparingMatch: false,
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

    const nextHighScore =
      current.gameMode === 'dailyChallenge'
        ? current.highScore
        : maybePersistHighScore(current.score, current.highScore);

    set({
      status: 'finished',
      timerStatus: reason === 'timeExpired' ? 'expired' : current.timerStatus,
      gameOverReason: reason,
      isProcessingMove: false,
      highScore: nextHighScore,
      pauseStartedAt: null,
    });

    const shouldRecord =
      current.gameMode === 'solo' &&
      (reason === 'timeExpired' || reason === 'busts' || reason === 'deckEmpty');

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

    if (shouldRecord) {
      void get().submitVerifiedMatchIfNeeded();
    }
  },

  submitVerifiedMatchIfNeeded: async () => {
    const current = get();

    if (current.gameMode === 'dailyChallenge') {
      const session = current.dailyChallengeSession;
      if (!session || session.attemptType !== 'ranked') {
        return;
      }

      const reason = current.gameOverReason;
      if (
        reason === null ||
        reason === 'quit' ||
        (reason !== 'timeExpired' && reason !== 'busts' && reason !== 'deckEmpty')
      ) {
        return;
      }

      if (
        current.submissionStatus === 'submitting' ||
        current.submissionStatus === 'verified'
      ) {
        return;
      }

      set({ submissionStatus: 'submitting', rejectionReason: null });

      try {
        await useDailyChallengeStore.getState().submitAttempt(get().moveLog);
        const challengeState = useDailyChallengeStore.getState();
        if (challengeState.verificationStatus === 'verified' && challengeState.verifiedResult) {
          const result = challengeState.verifiedResult;
          set({
            submissionStatus: 'verified',
            officialResult: {
              score: result.score,
              lanesCleared: result.lanesCleared,
              cardsPlayed: get().cardsPlayed,
              busts: result.bustCount,
              timeRemainingSeconds: Math.max(
                0,
                GAME_DURATION_SECONDS - Math.floor(result.elapsedTimeMs / 1000),
              ),
              gameOverReason: result.gameOverReason as Exclude<GameOverReason, 'quit'>,
            },
            rejectionReason: null,
            score: result.score,
            clearedLanes: result.lanesCleared,
            busts: result.bustCount,
          });
          return;
        }

        set({
          submissionStatus:
            challengeState.verificationStatus === 'rejected' ? 'rejected' : 'failed',
          rejectionReason:
            challengeState.rejectionReason ?? 'Daily Challenge verification failed.',
        });
      } catch (error) {
        set({
          submissionStatus: 'failed',
          rejectionReason:
            error instanceof Error ? error.message : 'Daily Challenge verification failed.',
        });
      }
      return;
    }

    const matchId = current.onlineMatchId;
    const reason = current.gameOverReason;

    if (
      current.eligibility !== 'verified' ||
      !matchId ||
      reason === null ||
      reason === 'quit'
    ) {
      return;
    }

    if (
      reason !== 'timeExpired' &&
      reason !== 'busts' &&
      reason !== 'deckEmpty'
    ) {
      return;
    }

    if (
      submittedOnlineMatchIds.has(matchId) ||
      current.submissionStatus === 'submitting' ||
      current.submissionStatus === 'verified'
    ) {
      return;
    }

    if (submissionPromise) {
      await submissionPromise;
      return;
    }

    submittedOnlineMatchIds.add(matchId);
    set({ submissionStatus: 'submitting', rejectionReason: null });

    submissionPromise = (async () => {
      try {
        const response = await submitOnlineMatch(matchId, get().moveLog);

        if (response.verified && response.officialResult) {
          set({
            submissionStatus: 'verified',
            officialResult: response.officialResult,
            rejectionReason: null,
            score: response.officialResult.score,
            clearedLanes: response.officialResult.lanesCleared,
            cardsPlayed: response.officialResult.cardsPlayed,
            busts: response.officialResult.busts,
            timeRemainingSeconds: response.officialResult.timeRemainingSeconds,
            gameOverReason: response.officialResult.gameOverReason,
          });
          return;
        }

        set({
          submissionStatus: 'rejected',
          rejectionReason: response.rejectionReason ?? 'Score was not verified.',
        });
      } catch (error) {
        submittedOnlineMatchIds.delete(matchId);
        const message =
          error instanceof OnlineMatchServiceError
            ? error.message
            : error instanceof Error
              ? error.message
              : 'Verification failed.';
        set({
          submissionStatus: 'failed',
          rejectionReason: message,
        });
      } finally {
        submissionPromise = null;
      }
    })();

    await submissionPromise;
  },

  quitGame: () => {
    const current = get();
    if (current.gameMode === 'dailyChallenge' && current.dailyChallengeSession) {
      void useDailyChallengeStore.getState().abandonActiveAttempt();
    }

    if (current.status === 'playing' && current.gameOverReason === null) {
      set({
        status: 'finished',
        gameOverReason: 'quit',
        isProcessingMove: false,
        pauseStartedAt: null,
        submissionStatus: 'idle',
      });
    }

    const highScore = get().highScore;
    set({
      ...idleGameState,
      ...resetOnlineFields(),
      gameMode: 'solo',
      dailyChallengeSession: null,
      dailyChallengeFirstMoveRecorded: false,
      highScore,
      isProcessingMove: false,
      lastMoveEvent: null,
      gameOverReason: 'quit',
      status: 'idle',
      timerStatus: 'ready',
      matchId: null,
      isPreparingMatch: false,
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
      current.activeCard === null ||
      current.gameStartedAt === null
    ) {
      return;
    }

    const cardId = current.activeCard.id;
    set({ isProcessingMove: true });

    const before = toGameSlice(current);
    const nextState = placeCardInLane(before, laneId);

    if (nextState === before) {
      set({ isProcessingMove: false });
      return;
    }

    const elapsedMilliseconds = calculateElapsedGameMilliseconds(
      Date.now(),
      current.gameStartedAt,
      current.totalPausedMilliseconds,
    );

    const moveEntry: MoveLogEntry = {
      sequence: current.moveLog.length + 1,
      laneId,
      elapsedMilliseconds,
    };

    if (
      current.gameMode === 'dailyChallenge' &&
      !current.dailyChallengeFirstMoveRecorded
    ) {
      set({ dailyChallengeFirstMoveRecorded: true });
      void useDailyChallengeStore.getState().recordFirstMove();
    }

    const lastMoveEvent = createMoveEvent(before, nextState, laneId, cardId);
    const cardsPlayed = current.cardsPlayed + 1;

    set({
      ...nextState,
      cardsPlayed,
      lastMoveEvent,
      isProcessingMove: false,
      moveLog: [...current.moveLog, moveEntry],
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
