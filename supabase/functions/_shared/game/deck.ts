import { RANKS, SUITS } from './constants.ts';
import { createSeededRandom } from './seededRandom.ts';
import type { Card } from './types.ts';

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

export function shuffleDeck(
  cards: readonly Card[],
  random: () => number,
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

export function createSeededShuffledDeck(seed: number): Card[] {
  return shuffleDeck(createOrderedDeck(), createSeededRandom(seed));
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
