import { Platform } from 'react-native';

import { recordRewardedAdInteraction } from '../monetization/adActivityTracker';
import {
  canRequestPersonalizedAds,
  requestAdConsentIfNeeded,
} from '../monetization/adConsentService';
import { getInterstitialAdUnitId, getRewardedAdUnitId } from '../monetization/adUnitIds';
import { trackEvent } from '../monetization/analytics';
import {
  isInterstitialAdsEnabled,
  isRewardedAdsEnabled,
} from '../config/featureFlags';

/**
 * Version 1.1C — single centralized owner of all direct ad-SDK calls.
 *
 * `rewardedAdService.ts` / `interstitialAdService.ts` and any screen that
 * wants to show an ad go through this module instead of importing
 * `react-native-google-mobile-ads` directly. Native ad objects
 * (`RewardedAd`/`InterstitialAd` instances) live only in module-level
 * closures here — never in Zustand state — so they are never persisted,
 * serialized, or re-created on every render.
 */

export type AdLifecycleState =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'showing'
  | 'completed'
  | 'failed'
  | 'dismissed';

type AdKind = 'rewarded' | 'interstitial';

type AdSlot = {
  state: AdLifecycleState;
  instance: unknown | null;
  listeners: Set<() => void>;
};

function createSlot(): AdSlot {
  return { state: 'idle', instance: null, listeners: new Set() };
}

const slots: Record<AdKind, AdSlot> = {
  rewarded: createSlot(),
  interstitial: createSlot(),
};

let sdkInitPromise: Promise<boolean> | null = null;
let sdkReady = false;

function setState(kind: AdKind, state: AdLifecycleState): void {
  const slot = slots[kind];
  if (slot.state === state) {
    return;
  }
  slot.state = state;
  for (const listener of slot.listeners) {
    listener();
  }
}

export function getAdState(kind: AdKind): AdLifecycleState {
  return slots[kind].state;
}

/** Subscribe to lifecycle changes for one ad kind. Returns an unsubscribe function. */
export function subscribeAdState(kind: AdKind, listener: () => void): () => void {
  slots[kind].listeners.add(listener);
  return () => {
    slots[kind].listeners.delete(listener);
  };
}

export function isAdSdkSupported(): boolean {
  return Platform.OS !== 'web';
}

/**
 * Initializes the mobile ads SDK exactly once for the lifetime of the app
 * process. Respects UMP consent (requested first) and never throws — a
 * failure here always resolves to `false` so callers can fail safely
 * without blocking Solo Play or app startup.
 */
export async function initializeAdsOnce(): Promise<boolean> {
  if (!isAdSdkSupported()) {
    return false;
  }
  if (sdkReady) {
    return true;
  }
  if (sdkInitPromise) {
    return sdkInitPromise;
  }

  sdkInitPromise = (async () => {
    try {
      await requestAdConsentIfNeeded();
      const { default: mobileAds } = await import('react-native-google-mobile-ads');
      await mobileAds().initialize();
      sdkReady = true;
      return true;
    } catch {
      return false;
    } finally {
      sdkInitPromise = null;
    }
  })();

  return sdkInitPromise;
}

function buildRequestOptions(): { requestNonPersonalizedAdsOnly?: boolean } | undefined {
  return canRequestPersonalizedAds() ? undefined : { requestNonPersonalizedAdsOnly: true };
}

/**
 * Preloads a rewarded ad so it is instantly available the moment the
 * player taps a "WATCH AD" button. Safe to call repeatedly — a no-op
 * while an ad is already loading or ready. Never blocks app startup;
 * callers should invoke this lazily (e.g. when a rewarded-ad placement
 * mounts), not from `App.tsx`.
 */
export async function preloadRewardedAd(): Promise<void> {
  if (!isRewardedAdsEnabled() || !isAdSdkSupported()) {
    return;
  }
  const slot = slots.rewarded;
  if (slot.state === 'loading' || slot.state === 'ready' || slot.state === 'showing') {
    return;
  }
  const unitId = getRewardedAdUnitId();
  if (!unitId) {
    return;
  }
  const ready = await initializeAdsOnce();
  if (!ready) {
    setState('rewarded', 'failed');
    return;
  }

  try {
    const ads = await import('react-native-google-mobile-ads');
    const rewarded = ads.RewardedAd.createForAdRequest(unitId, buildRequestOptions());
    setState('rewarded', 'loading');

    const unsubLoaded = rewarded.addAdEventListener(ads.RewardedAdEventType.LOADED, () => {
      setState('rewarded', 'ready');
    });
    const unsubError = rewarded.addAdEventListener(ads.AdEventType.ERROR, () => {
      setState('rewarded', 'failed');
      unsubLoaded();
      unsubError();
    });

    slot.instance = { ad: rewarded, unsubLoaded, unsubError };
    rewarded.load();
  } catch {
    setState('rewarded', 'failed');
  }
}

export async function preloadInterstitialAd(): Promise<void> {
  if (!isInterstitialAdsEnabled() || !isAdSdkSupported()) {
    return;
  }
  const slot = slots.interstitial;
  if (slot.state === 'loading' || slot.state === 'ready' || slot.state === 'showing') {
    return;
  }
  const unitId = getInterstitialAdUnitId();
  if (!unitId) {
    return;
  }
  const ready = await initializeAdsOnce();
  if (!ready) {
    setState('interstitial', 'failed');
    return;
  }

  try {
    const ads = await import('react-native-google-mobile-ads');
    const interstitial = ads.InterstitialAd.createForAdRequest(unitId, buildRequestOptions());
    setState('interstitial', 'loading');

    const unsubLoaded = interstitial.addAdEventListener(ads.AdEventType.LOADED, () => {
      setState('interstitial', 'ready');
    });
    const unsubError = interstitial.addAdEventListener(ads.AdEventType.ERROR, () => {
      setState('interstitial', 'failed');
      unsubLoaded();
      unsubError();
    });

    slot.instance = { ad: interstitial, unsubLoaded, unsubError };
    interstitial.load();
  } catch {
    setState('interstitial', 'failed');
  }
}

type RewardedShowResult =
  | { status: 'earned' }
  | { status: 'dismissed' }
  | { status: 'failed' };

/**
 * Shows the preloaded rewarded ad if ready, otherwise attempts a fresh
 * load first. Prevents duplicate concurrent show requests — a second call
 * while one is already `showing` resolves immediately to `dismissed`.
 * Always reloads a fresh ad after dismissal/completion so the next
 * placement has one ready.
 */
export async function showRewardedAdViaService(): Promise<RewardedShowResult> {
  const slot = slots.rewarded;
  if (slot.state === 'showing') {
    return { status: 'dismissed' };
  }
  if (slot.state !== 'ready') {
    await preloadRewardedAd();
    // Give the freshly-requested load a short window; callers using the
    // higher-level rewarded flow do their own longer wait/timeout.
    if (slots.rewarded.state !== 'ready') {
      return { status: 'failed' };
    }
  }

  const instance = slots.rewarded.instance as
    | { ad: import('react-native-google-mobile-ads').RewardedAd }
    | null;
  if (!instance) {
    return { status: 'failed' };
  }

  recordRewardedAdInteraction();
  trackEvent('rewarded_ad_requested');

  try {
    const ads = await import('react-native-google-mobile-ads');
    const result = await new Promise<RewardedShowResult>((resolve) => {
      let earned = false;
      let settled = false;
      const finish = (value: RewardedShowResult) => {
        if (settled) {
          return;
        }
        settled = true;
        resolve(value);
      };

      const unsubEarned = instance.ad.addAdEventListener(
        ads.RewardedAdEventType.EARNED_REWARD,
        () => {
          earned = true;
          trackEvent('rewarded_ad_completed');
        },
      );
      const unsubClosed = instance.ad.addAdEventListener(ads.AdEventType.CLOSED, () => {
        unsubEarned();
        unsubClosed();
        if (!earned) {
          trackEvent('rewarded_ad_dismissed');
        }
        finish(earned ? { status: 'earned' } : { status: 'dismissed' });
      });

      setState('rewarded', 'showing');
      void instance.ad.show();
    });

    // Preload the next one for the following placement.
    slot.instance = null;
    setState('rewarded', 'idle');
    void preloadRewardedAd();

    return result;
  } catch {
    slot.instance = null;
    setState('rewarded', 'idle');
    void preloadRewardedAd();
    return { status: 'failed' };
  }
}

/**
 * Version 1.1C — shows a freshly-requested rewarded ad carrying
 * `serverSideVerificationOptions`, so AdMob's SSV callback can be matched
 * back to a specific pending reward request. This intentionally does not
 * reuse the generic preloaded rewarded slot (that ad was created without
 * SSV options); a small load delay is an acceptable trade-off for
 * correctness here. Reports `earned` only when the SDK confirms the
 * reward was earned locally — the actual coin grant always waits for the
 * server-verified callback, tracked separately by the caller.
 */
export async function showRewardedAdForServerVerification(options: {
  userId: string;
  customData: string;
}): Promise<RewardedShowResult> {
  if (!isRewardedAdsEnabled() || !isAdSdkSupported()) {
    return { status: 'failed' };
  }
  const unitId = getRewardedAdUnitId();
  if (!unitId) {
    return { status: 'failed' };
  }
  const ready = await initializeAdsOnce();
  if (!ready) {
    return { status: 'failed' };
  }

  try {
    const ads = await import('react-native-google-mobile-ads');
    const rewarded = ads.RewardedAd.createForAdRequest(unitId, {
      ...buildRequestOptions(),
      serverSideVerificationOptions: {
        userId: options.userId,
        customData: options.customData,
      },
    });

    setState('rewarded', 'loading');

    const result = await new Promise<RewardedShowResult>((resolve) => {
      let earned = false;
      let settled = false;
      const finish = (value: RewardedShowResult) => {
        if (settled) {
          return;
        }
        settled = true;
        resolve(value);
      };

      const unsubLoaded = rewarded.addAdEventListener(ads.RewardedAdEventType.LOADED, () => {
        setState('rewarded', 'showing');
        recordRewardedAdInteraction();
        trackEvent('rewarded_ad_loaded');
        void rewarded.show();
      });
      const unsubEarned = rewarded.addAdEventListener(
        ads.RewardedAdEventType.EARNED_REWARD,
        () => {
          earned = true;
        },
      );
      const unsubClosed = rewarded.addAdEventListener(ads.AdEventType.CLOSED, () => {
        unsubLoaded();
        unsubEarned();
        unsubClosed();
        unsubError();
        finish(earned ? { status: 'earned' } : { status: 'dismissed' });
      });
      const unsubError = rewarded.addAdEventListener(ads.AdEventType.ERROR, () => {
        unsubLoaded();
        unsubEarned();
        unsubClosed();
        unsubError();
        finish({ status: 'failed' });
      });

      rewarded.load();
    });

    setState('rewarded', result.status === 'earned' ? 'completed' : result.status);
    return result;
  } catch {
    setState('rewarded', 'failed');
    return { status: 'failed' };
  }
}

export function __resetAdServiceForTests(): void {
  for (const kind of Object.keys(slots) as AdKind[]) {
    slots[kind] = createSlot();
  }
  sdkInitPromise = null;
  sdkReady = false;
}
