import { createDailyChallengeDeck } from '../game/challenge/createDailyChallengeDeck';
import type { Card } from '../game/types';

/**
 * Deterministic Async Duel deck from the server-issued authoritative seed string.
 * Reuses the canonical Daily Challenge / Solo shuffle pipeline — no forked engine.
 *
 * For the same seed + deck version, both participants receive identical card order
 * on every supported platform.
 */
export function createAsyncDuelDeck(seed: string): Card[] {
  if (!seed || typeof seed !== 'string') {
    throw new Error('Async Duel seed is required.');
  }
  return createDailyChallengeDeck(seed);
}

/** Stable hash of card ids for diagnostics (not cryptographic). */
export function asyncDuelDeckFingerprint(seed: string): string {
  const ids = createAsyncDuelDeck(seed).map((card) => card.id);
  let hash = 2166136261 >>> 0;
  const joined = ids.join('|');
  for (let i = 0; i < joined.length; i += 1) {
    hash ^= joined.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}
