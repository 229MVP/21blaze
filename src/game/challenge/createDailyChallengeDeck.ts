import { createOrderedDeck, shuffleDeckWithSeed } from '../deck';
import type { Card } from '../types';
import {
  deriveNumericSeedFromAuthoritative,
} from '../../challenge/seedDerivation';

/**
 * Deterministic Daily Challenge deck for an authoritative server seed string.
 *
 * Algorithm:
 * 1. Derive a signed 32-bit numeric seed from the authoritative string (FNV-1a).
 * 2. Build the canonical ordered 52-card deck via `createOrderedDeck()`.
 * 3. Fisher–Yates shuffle with Mulberry32 PRNG via `shuffleDeckWithSeed`.
 *
 * Does not call `Math.random()`. Does not mutate the canonical ordered deck.
 * Identical across iOS, Android, web, Node, Postgres-derived seeds, and tests.
 */
export function createDailyChallengeDeck(authoritativeSeed: string): Card[] {
  const numericSeed = deriveNumericSeedFromAuthoritative(authoritativeSeed);
  return shuffleDeckWithSeed(createOrderedDeck(), numericSeed);
}
