/**
 * Tiny, dependency-free shared state so `interstitialPolicy` consumers and
 * `adService` can both read/record "was a rewarded ad just shown" without
 * creating a circular import between `interstitialAdService.ts` and
 * `src/services/adService.ts`.
 */

let lastRewardedAdAtMs: number | null = null;

export function recordRewardedAdInteraction(): void {
  lastRewardedAdAtMs = Date.now();
}

export function getLastRewardedAdAtMs(): number | null {
  return lastRewardedAdAtMs;
}

export function __resetAdActivityForTests(): void {
  lastRewardedAdAtMs = null;
}
