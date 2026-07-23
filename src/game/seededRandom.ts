/**
 * Mulberry32 — deterministic 32-bit PRNG.
 *
 * Algorithm:
 * 1. Treat `seed` as an unsigned 32-bit integer.
 * 2. On each call, add the constant 0x6D2B79F5.
 * 3. Apply the Mulberry32 mix (imul / xor / shift).
 * 4. Return a float in [0, 1).
 *
 * Same seed ⇒ same sequence. Must stay identical on client and Edge Functions.
 */
export function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;

  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
