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
  createInitialGameStateFromAuthoritativeSeed,
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
import type { AsyncDuelSession } from '../asyncDuel/asyncDuelSession';
import type { LivePvpSession } from '../livePvp/livePvpSession';
import { buildLivePvpCheckpoint, applyLivePvpCheckpointToGameState } from '../livePvp/livePvpCheckpoint';
import {
  clearLivePvpCheckpoint,
  saveLivePvpCheckpoint,
  type LivePvpCheckpoint,
} from '../livePvp/livePvpCheckpointStorage';
import { useDailyChallengeStore } from './useDailyChallengeStore';
import { useAsyncDuelStore } from './useAsyncDuelStore';
import { useLivePvpStore, submitLiveMatchProgress } from './useLivePvpStore';
import { livePvpMatchCoordinator } from '../livePvp/livePvpCoordinator';
import { clearHighScore, saveHighScore } from '../storage/highScoreStorage';
import { createMatchId } from '../utils/createMatchId';
import { useScoreHistoryStore } from './useScoreHistoryStore';
import { useAuthStore } from './useAuthStore';

type GameStore = GameState &
  OnlineMatchState & {
    gameMode: GameMode;
    dailyChallengeSession: DailyChallengeSession | null;
    asyncDuelSession: AsyncDuelSession | null;
    livePvpSession: LivePvpSession | null;
    dailyChallengeFirstMoveRecorded: boolean;
    dailyExact21Count: number;
    dailyFiveCardClearCount: number;
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
    prepareAsyncDuelGame: (session: AsyncDuelSession) => Promise<void>;
    prepareLivePvpGame: (session: LivePvpSession) => Promise<void>;
    prepareLivePvpGameFromCheckpoint: (
      session: LivePvpSession,
      checkpoint: LivePvpCheckpoint,
    ) => Promise<void>;
    startGame: () => void;
    restartGame: () => void;
    resetGame: () => void;
    clearDailyChallengeMode: () => void;
    clearAsyncDuelMode: () => void;
    clearLivePvpMode: () => void;
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

function maybePersistLivePvpCheckpoint(state: GameStore): void {
  if (state.gameMode !== 'livePvp' || !state.livePvpSession) {
    return;
  }
  const userId = useAuthStore.getState().user?.id;
  if (!userId) {
    return;
  }
  const seq = livePvpMatchCoordinator.getProgressSequence();
  void saveLivePvpCheckpoint(
    buildLivePvpCheckpoint({
      userId,
      session: state.livePvpSession,
      game: toGameSlice(state),
      exact21Count: state.dailyExact21Count,
      fiveCardClearCount: state.dailyFiveCardClearCount,
      lastAcceptedProgressSequence: Math.max(0, seq - 1),
      lastAttemptedProgressSequence: seq,
    }),
  );
}

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
  asyncDuelSession: null,
  livePvpSession: null,
  dailyChallengeFirstMoveRecorded: false,
  dailyExact21Count: 0,
  dailyFiveCardClearCount: 0,
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
      asyncDuelSession: null,
      livePvpSession: null,
      dailyChallengeFirstMoveRecorded: false,
      highScore: get().highScore,
      isPreparingMatch: true,
      isProcessingMove: false,
      lastMoveEvent: null,
      status: 'idle',
      timerStatus: 'ready',
    });

    const next = withFreshMatchState(
      createInitialGameStateFromAuthoritativeSeed(session.authoritativeSeed),
    );
    set({
      ...next,
      gameMode: 'dailyChallenge',
      dailyChallengeSession: session,
      asyncDuelSession: null,
      livePvpSession: null,
      dailyChallengeFirstMoveRecorded: false,
      dailyExact21Count: 0,
      dailyFiveCardClearCount: 0,
      eligibility: session.attemptType === 'ranked' ? 'verified' : 'localOnly',
      onlineMatchId: session.attemptId,
      deckSeed: null,
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

  prepareAsyncDuelGame: async (session) => {
    if (get().isPreparingMatch) {
      return;
    }

    set({
      ...idleGameState,
      ...resetOnlineFields(),
      gameMode: 'asyncDuel',
      dailyChallengeSession: null,
      asyncDuelSession: session,
      dailyChallengeFirstMoveRecorded: false,
      highScore: get().highScore,
      isPreparingMatch: true,
      isProcessingMove: false,
      lastMoveEvent: null,
      status: 'idle',
      timerStatus: 'ready',
    });

    const next = withFreshMatchState(
      createInitialGameStateFromAuthoritativeSeed(session.authoritativeSeed),
    );
    set({
      ...next,
      // Server-stored duration is authoritative for both participants.
      timeRemainingSeconds: session.durationSeconds,
      gameMode: 'asyncDuel',
      dailyChallengeSession: null,
      asyncDuelSession: session,
      dailyChallengeFirstMoveRecorded: false,
      dailyExact21Count: 0,
      dailyFiveCardClearCount: 0,
      eligibility: 'verified',
      onlineMatchId: session.attemptId,
      deckSeed: null,
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

  prepareLivePvpGame: async (session) => {
    if (get().isPreparingMatch) {
      return;
    }

    set({
      ...idleGameState,
      ...resetOnlineFields(),
      gameMode: 'livePvp',
      dailyChallengeSession: null,
      asyncDuelSession: null,
      livePvpSession: session,
      dailyChallengeFirstMoveRecorded: false,
      highScore: get().highScore,
      isPreparingMatch: true,
      isProcessingMove: false,
      lastMoveEvent: null,
      status: 'idle',
      timerStatus: 'ready',
    });

    const next = withFreshMatchState(
      createInitialGameStateFromAuthoritativeSeed(session.authoritativeSeed),
    );
    set({
      ...next,
      timeRemainingSeconds: session.durationSeconds,
      gameMode: 'livePvp',
      dailyChallengeSession: null,
      asyncDuelSession: null,
      livePvpSession: session,
      dailyChallengeFirstMoveRecorded: false,
      dailyExact21Count: 0,
      dailyFiveCardClearCount: 0,
      eligibility: 'verified',
      onlineMatchId: session.attemptId,
      deckSeed: null,
      startedAtServer: session.scheduledStartAt,
      expiresAtServer: session.gameplayDeadlineAt,
      submissionStatus: 'idle',
      rejectionReason: null,
      moveLog: [],
      officialResult: null,
      isPreparingMatch: false,
      isProcessingMove: false,
      lastMoveEvent: null,
    });

    // Live lobby already rendered the server countdown. Enter running (or catch up)
    // from the authoritative schedule — never restart a local 3-2-1.
    const startMs = Date.parse(session.scheduledStartAt);
    const deadlineMs = Date.parse(session.gameplayDeadlineAt);
    const serverNow = livePvpMatchCoordinator.estimatedServerNowMs();
    if (Number.isFinite(startMs) && Number.isFinite(deadlineMs) && serverNow >= startMs) {
      const remainingMs = Math.max(0, deadlineMs - serverNow);
      const remainingSeconds = Math.ceil(remainingMs / 1000);
      if (remainingSeconds <= 0) {
        set({
          timerStatus: 'expired',
          timeRemainingSeconds: 0,
          gameStartedAt: startMs,
          startCountdownValue: 0,
        });
        get().endGame('timeExpired');
      } else {
        set({
          timerStatus: 'running',
          timeRemainingSeconds: Math.min(session.durationSeconds, remainingSeconds),
          gameStartedAt: startMs,
          startCountdownValue: 0,
          totalPausedMilliseconds: 0,
          pauseStartedAt: null,
        });
        livePvpMatchCoordinator.startProgressScheduler(async (sequence, fingerprint) => {
          const current = get();
          if (current.gameMode !== 'livePvp' || !current.livePvpSession) {
            return;
          }
          const parts = fingerprint.split('|');
          await submitLiveMatchProgress(current.livePvpSession.matchId, {
            sequence,
            score: Number(parts[0] ?? current.score),
            exact21Count: Number(parts[1] ?? current.dailyExact21Count),
            fiveCardClearCount: Number(parts[2] ?? current.dailyFiveCardClearCount),
            bustCount: Number(parts[3] ?? current.busts),
            cardsPlayed: Number(parts[4] ?? current.cardsPlayed),
            lanesCleared: Number(parts[5] ?? current.clearedLanes),
            clientElapsedMs: Math.max(
              0,
              livePvpMatchCoordinator.estimatedServerNowMs() - startMs,
            ),
          });
        });
      }
    }
  },

  prepareLivePvpGameFromCheckpoint: async (session, checkpoint) => {
    await get().prepareLivePvpGame(session);
    const current = get();
    if (current.gameMode !== 'livePvp' || !current.livePvpSession) {
      return;
    }
    const restored = applyLivePvpCheckpointToGameState(checkpoint, toGameSlice(current));
    set({
      ...restored,
      dailyExact21Count: checkpoint.engine.exact21Count,
      dailyFiveCardClearCount: checkpoint.engine.fiveCardClearCount,
    });
    livePvpMatchCoordinator.syncProgressSequenceFromSnapshot(
      {
        matchId: session.matchId,
        myLatestProgressSequence: checkpoint.lastAcceptedProgressSequence,
        progress: [],
        status: 'active',
        stateVersion: 0,
        protocolVersion: session.protocolVersion,
        realtimeTopic: '',
        participantRole: session.participantRole,
        challenger: { userId: '', displayName: '' },
        opponent: { userId: '', displayName: session.opponentDisplayName },
        challengerReady: true,
        opponentReady: true,
        scheduledStartAt: session.scheduledStartAt,
        gameplayDeadlineAt: session.gameplayDeadlineAt,
        submissionGraceUntil: session.submissionGraceUntil,
        expiresAt: session.gameplayDeadlineAt,
        rulesVersion: session.rulesVersion,
        deckVersion: session.deckVersion,
        durationSeconds: session.durationSeconds,
        bustLimit: session.bustLimit,
        seed: session.authoritativeSeed,
        seedAvailable: true,
        outcome: null,
        winnerUserId: null,
        decidingField: null,
        completionReason: null,
        settledAt: null,
        myAttempt: {
          attemptId: session.attemptId,
          status: 'active',
          score: restored.score,
          completedAt: null,
        },
        serverNow: new Date().toISOString(),
        gameplayEligible: true,
      },
      useAuthStore.getState().user?.id ?? checkpoint.userId,
    );
  },

  clearDailyChallengeMode: () => {
    set({
      gameMode: 'solo',
      dailyChallengeSession: null,
      dailyChallengeFirstMoveRecorded: false,
      dailyExact21Count: 0,
      dailyFiveCardClearCount: 0,
    });
  },

  clearAsyncDuelMode: () => {
    set({
      gameMode: 'solo',
      asyncDuelSession: null,
      livePvpSession: null,
      dailyExact21Count: 0,
      dailyFiveCardClearCount: 0,
    });
  },

  clearLivePvpMode: () => {
    livePvpMatchCoordinator.stopProgressScheduler();
    void clearLivePvpCheckpoint();
    set({
      gameMode: 'solo',
      livePvpSession: null,
      dailyExact21Count: 0,
      dailyFiveCardClearCount: 0,
    });
  },

  startGame: () => {
    void get().prepareAndStartGame();
  },

  restartGame: () => {
    if (
      get().gameMode === 'dailyChallenge' ||
      get().gameMode === 'asyncDuel' ||
      get().gameMode === 'livePvp'
    ) {
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
      asyncDuelSession: null,
      livePvpSession: null,
      dailyChallengeFirstMoveRecorded: false,
      dailyExact21Count: 0,
      dailyFiveCardClearCount: 0,
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

    if (current.gameMode === 'livePvp' && current.livePvpSession) {
      const deadlineMs = Date.parse(current.livePvpSession.gameplayDeadlineAt);
      const serverNow = livePvpMatchCoordinator.estimatedServerNowMs(now);
      const remainingMs = Math.max(0, deadlineMs - serverNow);
      const remaining = Math.ceil(remainingMs / 1000);
      livePvpMatchCoordinator.queueProgress(
        [
          current.score,
          current.dailyExact21Count,
          current.dailyFiveCardClearCount,
          current.busts,
          current.cardsPlayed,
          current.clearedLanes,
        ].join('|'),
      );
      if (remaining <= 0) {
        get().endGame('timeExpired');
        return;
      }
      if (remaining !== current.timeRemainingSeconds) {
        set({ timeRemainingSeconds: remaining });
      }
      maybePersistLivePvpCheckpoint(get());
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

    // Official Live PvP timer must not pause for background or local UX.
    if (current.gameMode === 'livePvp') {
      return;
    }

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
      current.gameMode === 'dailyChallenge' ||
      current.gameMode === 'asyncDuel' ||
      current.gameMode === 'livePvp'
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

    if (current.gameMode === 'livePvp') {
      const session = current.livePvpSession;
      if (!session) {
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

      livePvpMatchCoordinator.stopProgressScheduler();
      set({ submissionStatus: 'submitting', rejectionReason: null });

      try {
        const elapsedMs = calculateElapsedGameMilliseconds(
          Date.now(),
          current.gameStartedAt ?? Date.now(),
          current.totalPausedMilliseconds,
        );

        const result = await useLivePvpStore.getState().submitCompletion(session, {
          score: current.score,
          exact21Count: current.dailyExact21Count,
          fiveCardClearCount: current.dailyFiveCardClearCount,
          bustCount: current.busts,
          cardsPlayed: current.cardsPlayed,
          lanesCleared: current.clearedLanes,
          completionMs: elapsedMs,
        });

        if (result) {
          void clearLivePvpCheckpoint();
          set({
            submissionStatus: 'verified',
            officialResult: {
              score: current.score,
              lanesCleared: current.clearedLanes,
              cardsPlayed: current.cardsPlayed,
              busts: current.busts,
              timeRemainingSeconds: current.timeRemainingSeconds,
              gameOverReason: reason as Exclude<GameOverReason, 'quit'>,
            },
            rejectionReason: null,
          });
          return;
        }

        set({
          submissionStatus: 'failed',
          rejectionReason:
            useLivePvpStore.getState().errorMessage ?? 'Live PvP submission failed.',
        });
      } catch (error) {
        set({
          submissionStatus: 'failed',
          rejectionReason:
            error instanceof Error ? error.message : 'Live PvP submission failed.',
        });
      }
      return;
    }

    if (current.gameMode === 'asyncDuel') {
      const session = current.asyncDuelSession;
      if (!session) {
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
        const elapsedMs = calculateElapsedGameMilliseconds(
          Date.now(),
          current.gameStartedAt ?? Date.now(),
          current.totalPausedMilliseconds,
        );

        const result = await useAsyncDuelStore.getState().submitCompletion({
          attemptId: session.attemptId,
          score: current.score,
          exact21Count: current.dailyExact21Count,
          fiveCardClearCount: current.dailyFiveCardClearCount,
          bustCount: current.busts,
          cardsPlayed: current.cardsPlayed,
          lanesCleared: current.clearedLanes,
          completionMs: elapsedMs,
          rulesVersion: session.rulesVersion,
          deckVersion: session.deckVersion,
        });

        if (result) {
          set({
            submissionStatus: 'verified',
            officialResult: {
              score: current.score,
              lanesCleared: current.clearedLanes,
              cardsPlayed: current.cardsPlayed,
              busts: current.busts,
              timeRemainingSeconds: current.timeRemainingSeconds,
              gameOverReason: reason as Exclude<GameOverReason, 'quit'>,
            },
            rejectionReason: null,
          });
          return;
        }

        set({
          submissionStatus: 'failed',
          rejectionReason:
            useAsyncDuelStore.getState().errorMessage ??
            'Async Duel submission failed.',
        });
      } catch (error) {
        set({
          submissionStatus: 'failed',
          rejectionReason:
            error instanceof Error ? error.message : 'Async Duel submission failed.',
        });
      }
      return;
    }

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
        const elapsedMs = calculateElapsedGameMilliseconds(
          Date.now(),
          current.gameStartedAt ?? Date.now(),
          current.totalPausedMilliseconds,
        );

        await useDailyChallengeStore.getState().submitRankedCompletion({
          score: current.score,
          exact21Count: current.dailyExact21Count,
          fiveCardClearCount: current.dailyFiveCardClearCount,
          bustCount: current.busts,
          cardsPlayed: current.cardsPlayed,
          completionMs: elapsedMs,
        });

        const challengeState = useDailyChallengeStore.getState();
        if (challengeState.submissionStatus === 'completed' && challengeState.completionSummary) {
          const result = challengeState.completionSummary;
          set({
            submissionStatus: 'verified',
            officialResult: {
              score: result.score,
              lanesCleared: current.clearedLanes,
              cardsPlayed: current.cardsPlayed,
              busts: result.bustCount,
              timeRemainingSeconds: Math.max(
                0,
                GAME_DURATION_SECONDS - Math.floor(result.completionMs / 1000),
              ),
              gameOverReason: reason as Exclude<GameOverReason, 'quit'>,
            },
            rejectionReason: null,
            score: result.score,
            clearedLanes: current.clearedLanes,
            busts: result.bustCount,
          });
          return;
        }

        set({
          submissionStatus: 'failed',
          rejectionReason:
            challengeState.submissionError ?? 'Daily Challenge submission failed.',
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
      const session = current.dailyChallengeSession;
      if (session.attemptType === 'ranked') {
        void useDailyChallengeStore.getState().persistActiveSession(session);
      } else {
        useDailyChallengeStore.getState().clearActiveSession();
      }
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
      asyncDuelSession: null,
      livePvpSession: null,
      dailyChallengeFirstMoveRecorded: false,
      dailyExact21Count: 0,
      dailyFiveCardClearCount: 0,
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
    }

    const lastMoveEvent = createMoveEvent(before, nextState, laneId, cardId);
    const exact21Delta = lastMoveEvent.type === 'cleared21' ? 1 : 0;
    const fiveCardDelta = lastMoveEvent.type === 'clearedFiveCard' ? 1 : 0;
    const cardsPlayed = current.cardsPlayed + 1;

    set({
      ...nextState,
      cardsPlayed,
      lastMoveEvent,
      isProcessingMove: false,
      moveLog: [...current.moveLog, moveEntry],
      dailyExact21Count: current.dailyExact21Count + exact21Delta,
      dailyFiveCardClearCount: current.dailyFiveCardClearCount + fiveCardDelta,
    });
    maybePersistLivePvpCheckpoint(get());

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
