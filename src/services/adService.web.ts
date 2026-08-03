/** Web stub — the ad SDK is never bundled or initialized on Expo Web. */

export type AdLifecycleState =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'showing'
  | 'completed'
  | 'failed'
  | 'dismissed';

export function getAdState(_kind: 'rewarded' | 'interstitial'): AdLifecycleState {
  return 'idle';
}

export function subscribeAdState(
  _kind: 'rewarded' | 'interstitial',
  _listener: () => void,
): () => void {
  return () => undefined;
}

export function isAdSdkSupported(): boolean {
  return false;
}

export async function initializeAdsOnce(): Promise<boolean> {
  return false;
}

export async function preloadRewardedAd(): Promise<void> {
  // no-op
}

export async function preloadInterstitialAd(): Promise<void> {
  // no-op
}

export async function showRewardedAdViaService(): Promise<
  { status: 'earned' } | { status: 'dismissed' } | { status: 'failed' }
> {
  return { status: 'failed' };
}

export async function showRewardedAdForServerVerification(_options: {
  userId: string;
  customData: string;
}): Promise<{ status: 'earned' } | { status: 'dismissed' } | { status: 'failed' }> {
  return { status: 'failed' };
}

export function __resetAdServiceForTests(): void {
  // no-op
}
