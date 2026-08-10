import { createDailyChallengeDeck } from '../game/challenge/createDailyChallengeDeck';
import type { Card } from '../game/types';

/**
 * Deterministic Live PvP deck from the server-issued authoritative seed.
 * Reuses the canonical Daily Challenge / Solo shuffle — no Live-specific scoring fork.
 */
export function createLivePvpDeck(seed: string): Card[] {
  if (!seed || typeof seed !== 'string') {
    throw new Error('Live PvP seed is required.');
  }
  return createDailyChallengeDeck(seed);
}

export function livePvpDeckFingerprint(seed: string): string {
  const ids = createLivePvpDeck(seed).map((card) => card.id);
  let hash = 2166136261 >>> 0;
  const joined = ids.join('|');
  for (let i = 0; i < joined.length; i += 1) {
    hash ^= joined.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}
