/**
 * Non-secret fingerprint of a deterministic deck order for dev diagnostics.
 * Does not expose the authoritative seed.
 */
export function hashDailyChallengeDeckOrder(cardIds: readonly string[]): string {
  let hash = 2_166_136_261 >>> 0;

  for (let index = 0; index < cardIds.length; index += 1) {
    const id = cardIds[index];
    for (let charIndex = 0; charIndex < id.length; charIndex += 1) {
      hash ^= id.charCodeAt(charIndex);
      hash = Math.imul(hash, 1_677_761_9) >>> 0;
    }
    hash ^= 0x7c;
    hash = Math.imul(hash, 1_677_761_9) >>> 0;
  }

  return (hash >>> 0).toString(16).padStart(8, '0');
}
