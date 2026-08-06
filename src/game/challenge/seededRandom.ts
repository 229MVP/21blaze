/**
 * Re-export the canonical Mulberry32 PRNG used by Solo online play.
 * Daily Challenge deck order must use the same algorithm as the main engine.
 */
export { createSeededRandom } from '../seededRandom';
