/** Web stub — interstitials are unsupported on Expo Web. */

export async function hydrateInterstitialCaps(): Promise<void> {
  // no-op
}

export function recordSoloMatchCompletedForInterstitial(): void {
  // no-op
}

export function canShowInterstitial(_hasRemoveAds: boolean): boolean {
  return false;
}

export async function maybeShowInterstitialAfterSoloHome(
  _hasRemoveAds: boolean,
): Promise<boolean> {
  return false;
}

export function __resetInterstitialForTests(): void {
  // no-op
}
