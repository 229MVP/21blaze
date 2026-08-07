import { deriveNumericSeedFromAuthoritative } from '../../challenge/seedDerivation';
import { createSeededShuffledDeck } from '../deck';
import type { Card } from '../types';
import { createDailyChallengeDeck } from './createDailyChallengeDeck';

/** Deterministic deck order for a numeric Daily Challenge seed. */
export function createChallengeDeck(seed: number): Card[] {
  return createSeededShuffledDeck(seed);
}

/** Deterministic deck order for an authoritative server seed string. */
export function createChallengeDeckFromAuthoritativeSeed(authoritativeSeed: string): Card[] {
  return createDailyChallengeDeck(authoritativeSeed);
}

/** Numeric seed helper for legacy callers that still store integer seeds. */
export function createChallengeDeckFromAuthoritative(authoritativeSeed: string): Card[] {
  return createSeededShuffledDeck(deriveNumericSeedFromAuthoritative(authoritativeSeed));
}
