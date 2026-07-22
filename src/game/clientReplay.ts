import { GAME_DURATION_SECONDS, LANE_IDS, MAX_BUSTS } from './constants';
import {
  createInitialGameStateFromSeed,
  placeCardInLane,
} from './gameEngine';
import type { GameOverReason, GameState, LaneId } from './types';
import type { MoveLogEntry, OfficialMatchResult } from '../online/types';

const MAX_MOVES = 52;
const NETWORK_TOLERANCE_MS = 5_000;

export type ClientReplayOutcome =
  | { ok: true; result: OfficialMatchResult }
  | { ok: false; reason: string };

function isLaneId(value: number): value is LaneId {
  return (LANE_IDS as readonly number[]).includes(value);
}

/** Validates a move log with the same rules as the Edge Function replay. */
export function validateMoveLog(moves: unknown):
  | { ok: true; moves: MoveLogEntry[] }
  | { ok: false; reason: string } {
  if (!Array.isArray(moves)) {
    return { ok: false, reason: 'Move log must be an array.' };
  }

  if (moves.length > MAX_MOVES) {
    return { ok: false, reason: 'Move log exceeds 52 placements.' };
  }

  const normalized: MoveLogEntry[] = [];
  let previousElapsed = -1;

  for (let index = 0; index < moves.length; index += 1) {
    const raw = moves[index];

    if (!raw || typeof raw !== 'object') {
      return { ok: false, reason: `Move ${index + 1} is malformed.` };
    }

    const entry = raw as Record<string, unknown>;
    const sequence = entry.sequence;
    const laneId = entry.laneId;
    const elapsedMilliseconds = entry.elapsedMilliseconds;

    if (typeof sequence !== 'number' || !Number.isInteger(sequence)) {
      return { ok: false, reason: `Move ${index + 1} has an invalid sequence.` };
    }

    if (sequence !== index + 1) {
      return { ok: false, reason: 'Move sequences must start at 1 and increase by 1.' };
    }

    if (typeof laneId !== 'number' || !Number.isInteger(laneId) || !isLaneId(laneId)) {
      return { ok: false, reason: `Move ${sequence} has an invalid laneId.` };
    }

    if (
      typeof elapsedMilliseconds !== 'number' ||
      !Number.isFinite(elapsedMilliseconds) ||
      elapsedMilliseconds < 0
    ) {
      return { ok: false, reason: `Move ${sequence} has invalid elapsedMilliseconds.` };
    }

    if (elapsedMilliseconds < previousElapsed) {
      return { ok: false, reason: 'Elapsed time cannot move backward.' };
    }

    if (elapsedMilliseconds > GAME_DURATION_SECONDS * 1000 + NETWORK_TOLERANCE_MS) {
      return { ok: false, reason: 'Elapsed time exceeds the allowed match duration.' };
    }

    previousElapsed = elapsedMilliseconds;
    normalized.push({ sequence, laneId, elapsedMilliseconds });
  }

  return { ok: true, moves: normalized };
}

function toPlaceableState(state: GameState): GameState {
  return {
    ...state,
    status: 'playing',
    timerStatus: 'running',
  };
}

/**
 * Client-side replay used for self-tests and parity checks.
 * Official production verification happens only in the Edge Function.
 */
export function replayMatchClient(
  seed: number,
  moves: MoveLogEntry[],
): ClientReplayOutcome {
  const validation = validateMoveLog(moves);
  if (!validation.ok) {
    return validation;
  }

  let state = createInitialGameStateFromSeed(seed);

  if (!state.activeCard && validation.moves.length > 0) {
    return { ok: false, reason: 'Deck could not deal an opening card.' };
  }

  for (const move of validation.moves) {
    if (state.gameOverReason !== null || state.status === 'finished') {
      return { ok: false, reason: 'Moves continue after a terminal game state.' };
    }

    if (state.busts >= MAX_BUSTS) {
      return { ok: false, reason: 'Moves continue after three busts.' };
    }

    if (state.activeCard === null) {
      return { ok: false, reason: 'Moves continue after the deck is exhausted.' };
    }

    const before = toPlaceableState(state);
    const next = placeCardInLane(before, move.laneId as LaneId);

    if (next === before || next.cardsPlayed !== before.cardsPlayed + 1) {
      // placeCardInLane does not increment cardsPlayed; client store does.
      // Compare active card / deck length instead.
    }

    if (next === before) {
      return { ok: false, reason: `Lane ${move.laneId} rejected move ${move.sequence}.` };
    }

    state = {
      ...next,
      cardsPlayed: state.cardsPlayed + 1,
    };

    if (state.busts >= MAX_BUSTS) {
      state = {
        ...state,
        status: 'finished',
        gameOverReason: 'busts',
      };
    } else if (state.activeCard === null) {
      state = {
        ...state,
        status: 'finished',
        gameOverReason: 'deckEmpty',
      };
    }
  }

  const lastElapsed =
    validation.moves.length > 0
      ? validation.moves[validation.moves.length - 1].elapsedMilliseconds
      : 0;

  let gameOverReason: Exclude<GameOverReason, 'quit'>;

  if (state.gameOverReason === 'busts' || state.busts >= MAX_BUSTS) {
    gameOverReason = 'busts';
  } else if (state.gameOverReason === 'deckEmpty' || state.activeCard === null) {
    gameOverReason = 'deckEmpty';
  } else if (lastElapsed >= GAME_DURATION_SECONDS * 1000) {
    gameOverReason = 'timeExpired';
  } else if (validation.moves.length === 0) {
    return { ok: false, reason: 'Empty move log is not a complete match.' };
  } else {
    return { ok: false, reason: 'Submission is not a terminal match state.' };
  }

  const remainingMs = Math.max(0, GAME_DURATION_SECONDS * 1000 - lastElapsed);
  const timeRemainingSeconds = Math.min(
    GAME_DURATION_SECONDS,
    Math.ceil(remainingMs / 1000),
  );

  return {
    ok: true,
    result: {
      score: state.score,
      lanesCleared: state.clearedLanes,
      cardsPlayed: state.cardsPlayed,
      busts: state.busts,
      timeRemainingSeconds: gameOverReason === 'timeExpired' ? 0 : timeRemainingSeconds,
      gameOverReason,
    },
  };
}
