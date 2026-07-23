import { RANKS, SUITS } from './constants';
import { createSeededRandom } from './seededRandom';
import type { Card } from './types';

export function createOrderedDeck(): Card[] {
  const cards: Card[] = [];

  for (const suit of SUITS) {
    for (const rank of RANKS) {
      cards.push({
        id: `${rank}-${suit}`,
        suit,
        rank,
      });
    }
  }

  return cards;
}

/** Fisher–Yates shuffle. Uses an optional RNG for testing / seeded online play. */
export function shuffleDeck(
  cards: readonly Card[],
  random: () => number = Math.random,
): Card[] {
  const shuffled = [...cards];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    const current = shuffled[index];
    shuffled[index] = shuffled[swapIndex];
    shuffled[swapIndex] = current;
  }

  return shuffled;
}

/**
 * Deterministic Fisher–Yates using Mulberry32.
 * Does not mutate the input deck. Does not call Math.random.
 */
export function shuffleDeckWithSeed(deck: readonly Card[], seed: number): Card[] {
  return shuffleDeck(deck, createSeededRandom(seed));
}

export function createShuffledDeck(random: () => number = Math.random): Card[] {
  return shuffleDeck(createOrderedDeck(), random);
}

export function createSeededShuffledDeck(seed: number): Card[] {
  return shuffleDeckWithSeed(createOrderedDeck(), seed);
}

export function drawCard(deck: readonly Card[]): {
  card: Card | null;
  remainingDeck: Card[];
} {
  if (deck.length === 0) {
    return { card: null, remainingDeck: [] };
  }

  const [card, ...remainingDeck] = deck;
  return { card, remainingDeck };
}
