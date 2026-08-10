import type { GameState } from '../game/types';
import type { LivePvpSession } from './livePvpSession';
import type { LivePvpCheckpoint, LivePvpCheckpointEngine } from './livePvpCheckpointStorage';

export function buildLivePvpCheckpoint(input: {
  userId: string;
  session: LivePvpSession;
  game: GameState;
  exact21Count: number;
  fiveCardClearCount: number;
  lastAcceptedProgressSequence: number;
  lastAttemptedProgressSequence: number;
}): LivePvpCheckpoint {
  const engine: LivePvpCheckpointEngine = {
    deck: input.game.deck,
    activeCard: input.game.activeCard,
    lanes: input.game.lanes,
    score: input.game.score,
    multiplier: input.game.multiplier,
    busts: input.game.busts,
    clearedLanes: input.game.clearedLanes,
    cardsPlayed: input.game.cardsPlayed,
    exact21Count: input.exact21Count,
    fiveCardClearCount: input.fiveCardClearCount,
    timerStatus: input.game.timerStatus,
    gameStartedAt: input.game.gameStartedAt,
    timeRemainingSeconds: input.game.timeRemainingSeconds,
  };
  return {
    schemaVersion: 1,
    userId: input.userId,
    matchId: input.session.matchId,
    attemptId: input.session.attemptId,
    participantRole: input.session.participantRole,
    protocolVersion: input.session.protocolVersion,
    rulesVersion: input.session.rulesVersion,
    deckVersion: input.session.deckVersion,
    durationSeconds: input.session.durationSeconds,
    bustLimit: input.session.bustLimit,
    scheduledStartAt: input.session.scheduledStartAt,
    gameplayDeadlineAt: input.session.gameplayDeadlineAt,
    submissionGraceUntil: input.session.submissionGraceUntil,
    authoritativeSeed: input.session.authoritativeSeed,
    opponentDisplayName: input.session.opponentDisplayName,
    lastAcceptedProgressSequence: input.lastAcceptedProgressSequence,
    lastAttemptedProgressSequence: input.lastAttemptedProgressSequence,
    updatedAtMs: Date.now(),
    engine,
  };
}

export function applyLivePvpCheckpointToGameState(
  checkpoint: LivePvpCheckpoint,
  base: GameState,
): GameState {
  const engine = checkpoint.engine;
  return {
    ...base,
    deck: engine.deck,
    activeCard: engine.activeCard,
    lanes: engine.lanes,
    score: engine.score,
    multiplier: engine.multiplier,
    busts: engine.busts,
    clearedLanes: engine.clearedLanes,
    cardsPlayed: engine.cardsPlayed,
    timerStatus: engine.timerStatus,
    gameStartedAt: engine.gameStartedAt,
    timeRemainingSeconds: engine.timeRemainingSeconds,
    status: base.status === 'finished' ? 'playing' : base.status,
    gameOverReason: null,
  };
}
