import { RANKS, SUITS } from './constants';
import type { Card } from './types';

function createOrderedDeck(): Card[] {
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

/** Fisher–Yates shuffle. Uses an optional RNG for testing. */
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

export function createShuffledDeck(random: () => number = Math.random): Card[] {
  return shuffleDeck(createOrderedDeck(), random);
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
