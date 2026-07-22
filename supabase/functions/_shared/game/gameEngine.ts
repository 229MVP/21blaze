import { calculateHandTotal } from './cardValues.ts';
import {
  FIVE_CARD_CLEAR_COUNT,
  LANE_IDS,
  MAX_MULTIPLIER,
  SCORE_CLEAR_21,
  SCORE_CLEAR_FIVE,
  TARGET_TOTAL,
} from './constants.ts';
import { createSeededShuffledDeck, drawCard } from './deck.ts';
import type { Card, Lane, LaneId } from './types.ts';

export type ServerGameState = {
  deck: Card[];
  activeCard: Card | null;
  lanes: Lane[];
  score: number;
  multiplier: number;
  busts: number;
  clearedLanes: number;
  cardsPlayed: number;
  finished: boolean;
  finishReason: 'busts' | 'deckEmpty' | null;
};

function createEmptyLanes(): Lane[] {
  return LANE_IDS.map((id) => ({ id, cards: [] }));
}

function resetLane(lanes: readonly Lane[], laneId: LaneId): Lane[] {
  return lanes.map((lane) =>
    lane.id === laneId ? { ...lane, cards: [] } : lane,
  );
}

function withCardInLane(
  lanes: readonly Lane[],
  laneId: LaneId,
  card: Card,
): Lane[] {
  return lanes.map((lane) =>
    lane.id === laneId
      ? { ...lane, cards: [...lane.cards, card] }
      : lane,
  );
}

export function createServerGameState(seed: number): ServerGameState {
  const shuffled = createSeededShuffledDeck(seed);
  const { card: activeCard, remainingDeck } = drawCard(shuffled);

  return {
    deck: remainingDeck,
    activeCard,
    lanes: createEmptyLanes(),
    score: 0,
    multiplier: 1,
    busts: 0,
    clearedLanes: 0,
    cardsPlayed: 0,
    finished: activeCard === null,
    finishReason: activeCard === null ? 'deckEmpty' : null,
  };
}

export function placeServerCard(
  state: ServerGameState,
  laneId: LaneId,
): ServerGameState {
  if (state.finished || state.activeCard === null) {
    return state;
  }

  const activeCard = state.activeCard;
  const lanesWithCard = withCardInLane(state.lanes, laneId, activeCard);
  const targetLane = lanesWithCard.find((lane) => lane.id === laneId);

  if (!targetLane) {
    return state;
  }

  const total = calculateHandTotal(targetLane.cards);
  let score = state.score;
  let multiplier = state.multiplier;
  let busts = state.busts;
  let clearedLanes = state.clearedLanes;
  let lanes = lanesWithCard;

  if (total === TARGET_TOTAL) {
    score += SCORE_CLEAR_21 * multiplier;
    clearedLanes += 1;
    multiplier = Math.min(MAX_MULTIPLIER, multiplier + 1);
    lanes = resetLane(lanes, laneId);
  } else if (total < TARGET_TOTAL && targetLane.cards.length >= FIVE_CARD_CLEAR_COUNT) {
    score += SCORE_CLEAR_FIVE * multiplier;
    clearedLanes += 1;
    multiplier = Math.min(MAX_MULTIPLIER, multiplier + 1);
    lanes = resetLane(lanes, laneId);
  } else if (total > TARGET_TOTAL) {
    busts += 1;
    multiplier = 1;
    lanes = resetLane(lanes, laneId);
  }

  const { card: nextCard, remainingDeck } = drawCard(state.deck);
  const cardsPlayed = state.cardsPlayed + 1;
  let finished = false;
  let finishReason: ServerGameState['finishReason'] = null;

  if (busts >= 3) {
    finished = true;
    finishReason = 'busts';
  } else if (nextCard === null) {
    finished = true;
    finishReason = 'deckEmpty';
  }

  return {
    deck: remainingDeck,
    activeCard: nextCard,
    lanes,
    score,
    multiplier,
    busts,
    clearedLanes,
    cardsPlayed,
    finished,
    finishReason,
  };
}
