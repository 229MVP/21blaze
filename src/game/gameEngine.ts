import { calculateHandTotal } from './cardValues';
import {
  FIVE_CARD_CLEAR_COUNT,
  GAME_DURATION_SECONDS,
  LANE_IDS,
  MAX_MULTIPLIER,
  SCORE_CLEAR_21,
  SCORE_CLEAR_FIVE,
  START_COUNTDOWN_SECONDS,
  TARGET_TOTAL,
} from './constants';
import { createShuffledDeck, drawCard } from './deck';
import type { Card, GameState, Lane, LaneId, LaneOutcome } from './types';

function createEmptyLanes(): Lane[] {
  return LANE_IDS.map((id) => ({
    id,
    cards: [],
  }));
}

export function evaluateLane(cards: readonly Card[]): LaneOutcome {
  const total = calculateHandTotal(cards);

  if (total > TARGET_TOTAL) {
    return 'bust';
  }

  if (total === TARGET_TOTAL) {
    return 'clear21';
  }

  if (cards.length >= FIVE_CARD_CLEAR_COUNT) {
    return 'clearFive';
  }

  return 'continue';
}

export function createInitialGameState(
  random: () => number = Math.random,
): GameState {
  const shuffled = createShuffledDeck(random);
  const { card: activeCard, remainingDeck } = drawCard(shuffled);

  return {
    status: activeCard ? 'playing' : 'finished',
    deck: remainingDeck,
    activeCard,
    lanes: createEmptyLanes(),
    score: 0,
    multiplier: 1,
    busts: 0,
    clearedLanes: 0,
    cardsPlayed: 0,
    timeRemainingSeconds: GAME_DURATION_SECONDS,
    timerStatus: activeCard ? 'countdown' : 'expired',
    gameStartedAt: null,
    pauseStartedAt: null,
    totalPausedMilliseconds: 0,
    gameOverReason: activeCard ? null : 'deckEmpty',
    startCountdownValue: START_COUNTDOWN_SECONDS,
  };
}

function resetLane(lanes: readonly Lane[], laneId: LaneId): Lane[] {
  return lanes.map((lane) =>
    lane.id === laneId
      ? {
          ...lane,
          cards: [],
        }
      : lane,
  );
}

function withCardInLane(
  lanes: readonly Lane[],
  laneId: LaneId,
  card: Card,
): Lane[] {
  return lanes.map((lane) =>
    lane.id === laneId
      ? {
          ...lane,
          cards: [...lane.cards, card],
        }
      : lane,
  );
}

export function placeCardInLane(state: GameState, laneId: LaneId): GameState {
  if (
    state.status !== 'playing' ||
    state.timerStatus !== 'running' ||
    state.activeCard === null
  ) {
    return state;
  }

  const activeCard = state.activeCard;
  const lanesWithCard = withCardInLane(state.lanes, laneId, activeCard);
  const targetLane = lanesWithCard.find((lane) => lane.id === laneId);

  if (!targetLane) {
    return state;
  }

  const outcome = evaluateLane(targetLane.cards);

  let score = state.score;
  let multiplier = state.multiplier;
  let busts = state.busts;
  let clearedLanes = state.clearedLanes;
  let lanes = lanesWithCard;

  if (outcome === 'clear21') {
    score += SCORE_CLEAR_21 * multiplier;
    clearedLanes += 1;
    multiplier = Math.min(MAX_MULTIPLIER, multiplier + 1);
    lanes = resetLane(lanes, laneId);
  } else if (outcome === 'clearFive') {
    score += SCORE_CLEAR_FIVE * multiplier;
    clearedLanes += 1;
    multiplier = Math.min(MAX_MULTIPLIER, multiplier + 1);
    lanes = resetLane(lanes, laneId);
  } else if (outcome === 'bust') {
    busts += 1;
    multiplier = 1;
    lanes = resetLane(lanes, laneId);
  }

  const { card: nextCard, remainingDeck } = drawCard(state.deck);

  return {
    ...state,
    status: 'playing',
    deck: remainingDeck,
    activeCard: nextCard,
    lanes,
    score,
    multiplier,
    busts,
    clearedLanes,
  };
}

export function getCardsRemaining(state: GameState): number {
  return state.deck.length + (state.activeCard ? 1 : 0);
}
