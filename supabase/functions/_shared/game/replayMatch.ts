import {
  GAME_DURATION_SECONDS,
  LANE_IDS,
  MAX_BUSTS,
  MAX_MOVES,
} from './constants.ts';
import { createServerGameState, placeServerCard } from './gameEngine.ts';
import type {
  LaneId,
  MoveLogEntry,
  OfficialMatchResult,
  ReplayOutcome,
} from './types.ts';

const NETWORK_TOLERANCE_MS = 5_000;

function isLaneId(value: number): value is LaneId {
  return LANE_IDS.includes(value as LaneId);
}

export function validateMoveLog(moves: unknown): {
  ok: true;
  moves: MoveLogEntry[];
} | { ok: false; reason: string } {
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

export function replayMatch(seed: number, moves: MoveLogEntry[]): ReplayOutcome {
  const validation = validateMoveLog(moves);
  if (!validation.ok) {
    return validation;
  }

  let state = createServerGameState(seed);

  if (state.finished && validation.moves.length > 0) {
    return { ok: false, reason: 'Deck could not deal an opening card.' };
  }

  for (const move of validation.moves) {
    if (state.finished) {
      return { ok: false, reason: 'Moves continue after a terminal game state.' };
    }

    if (state.busts >= MAX_BUSTS) {
      return { ok: false, reason: 'Moves continue after three busts.' };
    }

    if (state.activeCard === null) {
      return { ok: false, reason: 'Moves continue after the deck is exhausted.' };
    }

    const beforeCardId = state.activeCard.id;
    const next = placeServerCard(state, move.laneId as LaneId);

    if (next === state || next.cardsPlayed !== state.cardsPlayed + 1) {
      return { ok: false, reason: `Lane ${move.laneId} rejected move ${move.sequence}.` };
    }

    // Guarantees each placed card is unique by construction of the deck draw.
    if (next.cardsPlayed > 0 && beforeCardId.length === 0) {
      return { ok: false, reason: 'Invalid card identity during replay.' };
    }

    state = next;
  }

  const lastElapsed =
    validation.moves.length > 0
      ? validation.moves[validation.moves.length - 1].elapsedMilliseconds
      : 0;

  let gameOverReason: OfficialMatchResult['gameOverReason'];

  if (state.finishReason === 'busts') {
    gameOverReason = 'busts';
  } else if (state.finishReason === 'deckEmpty') {
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

  // timeExpired should report 0 remaining.
  const officialTime =
    gameOverReason === 'timeExpired' ? 0 : timeRemainingSeconds;

  return {
    ok: true,
    result: {
      score: state.score,
      lanesCleared: state.clearedLanes,
      cardsPlayed: state.cardsPlayed,
      busts: state.busts,
      timeRemainingSeconds: officialTime,
      gameOverReason,
    },
  };
}
