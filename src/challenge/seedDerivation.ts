import { DAILY_CHALLENGE_SEED_PREFIX } from './dailyChallengeRegistry';

/**
 * Authoritative server seed string for a UTC calendar date.
 * The mobile client must never choose this value for ranked play.
 */
export function deriveAuthoritativeSeed(challengeDate: string): string {
  return `${DAILY_CHALLENGE_SEED_PREFIX}${challengeDate}`;
}

/**
 * FNV-1a style 32-bit hash → deterministic numeric seed for Mulberry32.
 * Must match `derive_daily_challenge_numeric_seed` in Postgres migration 0012.
 */
export function deriveNumericSeedFromAuthoritative(authoritativeSeed: string): number {
  let hash = 2_166_136_261 >>> 0;

  for (let index = 0; index < authoritativeSeed.length; index += 1) {
    hash ^= authoritativeSeed.charCodeAt(index);
    hash = Math.imul(hash, 1_677_761_9) >>> 0;
  }

  return (hash % 0x8000_0000) | 0;
}

/** Legacy date-based derivation (same as authoritative seed for official challenges). */
export function deriveDailyChallengeSeed(challengeDate: string): number {
  return deriveNumericSeedFromAuthoritative(deriveAuthoritativeSeed(challengeDate));
}
