import { createSeededShuffledDeck } from '../deck';
import type { Card } from '../types';

/** Deterministic deck order for a Daily Challenge seed. */
export function createChallengeDeck(seed: number): Card[] {
  return createSeededShuffledDeck(seed);
}
