/** Non-secret fingerprint of an authoritative seed string (for dev diagnostics). */
export function hashAuthoritativeSeedFingerprint(authoritativeSeed: string): string {
  let hash = 2_166_136_261 >>> 0;

  for (let index = 0; index < authoritativeSeed.length; index += 1) {
    hash ^= authoritativeSeed.charCodeAt(index);
    hash = Math.imul(hash, 1_677_761_9) >>> 0;
  }

  return (hash >>> 0).toString(16).padStart(8, '0');
}
