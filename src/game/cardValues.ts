import { TARGET_TOTAL } from './constants';
import type { Card, Rank } from './types';

export function getRankValue(rank: Rank): number {
  if (rank === 'A') {
    return 11;
  }

  if (rank === 'J' || rank === 'Q' || rank === 'K') {
    return 10;
  }

  return Number(rank);
}

/**
 * Blackjack-style total: aces count as 11 unless converting
 * one or more aces to 1 is required to avoid a bust.
 */
export function calculateHandTotal(cards: readonly Card[]): number {
  let total = 0;
  let aceCount = 0;

  for (const card of cards) {
    const value = getRankValue(card.rank);
    total += value;

    if (card.rank === 'A') {
      aceCount += 1;
    }
  }

  while (total > TARGET_TOTAL && aceCount > 0) {
    total -= 10;
    aceCount -= 1;
  }

  return total;
}
