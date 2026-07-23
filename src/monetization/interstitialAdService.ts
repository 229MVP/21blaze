import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import { getInterstitialAdUnitId } from './adUnitIds';
import {
  canRequestPersonalizedAds,
  requestAdConsentIfNeeded,
} from './adConsentService';
import { isInterstitialAdsEnabled } from '../config/featureFlags';

const STORAGE_KEY = '21blaze.interstitialCaps.v1';
const MIN_INTERVAL_MS = 8 * 60 * 1000;
const MATCHES_PER_AD = 3;
const MAX_PER_SESSION = 3;

type CapState = {
  completedSoloMatches: number;
  lastShownAt: number | null;
};

let sessionShown = 0;
let caps: CapState = { completedSoloMatches: 0, lastShownAt: null };
let mobileAdsReady = false;

export async function hydrateInterstitialCaps(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return;
    }
    const parsed = JSON.parse(raw) as CapState;
    if (typeof parsed.completedSoloMatches === 'number') {
      caps = {
        completedSoloMatches: parsed.completedSoloMatches,
        lastShownAt:
          typeof parsed.lastShownAt === 'number' ? parsed.lastShownAt : null,
      };
    }
  } catch {
    // ignore
  }
}

async function persistCaps(): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(caps));
  } catch {
    // ignore
  }
}

export function recordSoloMatchCompletedForInterstitial(): void {
  caps.completedSoloMatches += 1;
  void persistCaps();
}

export function canShowInterstitial(hasRemoveAds: boolean): boolean {
  if (!isInterstitialAdsEnabled()) {
    return false;
  }
  if (hasRemoveAds) {
    return false;
  }
  if (Platform.OS === 'web') {
    return false;
  }
  if (sessionShown >= MAX_PER_SESSION) {
    return false;
  }
  if (caps.completedSoloMatches < MATCHES_PER_AD) {
    return false;
  }
  if (
    caps.lastShownAt !== null &&
    Date.now() - caps.lastShownAt < MIN_INTERVAL_MS
  ) {
    return false;
  }
  return true;
}

async function ensureMobileAds(): Promise<boolean> {
  if (Platform.OS === 'web') {
    return false;
  }
  if (mobileAdsReady) {
    return true;
  }
  try {
    await requestAdConsentIfNeeded();
    const { default: mobileAds } = await import('react-native-google-mobile-ads');
    await mobileAds().initialize();
    mobileAdsReady = true;
    return true;
  } catch {
    return false;
  }
}

/**
 * Attempt interstitial after Solo → Home. Never blocks navigation.
 */
export async function maybeShowInterstitialAfterSoloHome(
  hasRemoveAds: boolean,
): Promise<boolean> {
  if (!canShowInterstitial(hasRemoveAds)) {
    return false;
  }

  const unitId = getInterstitialAdUnitId();
  if (!unitId) {
    return false;
  }

  try {
    const ready = await ensureMobileAds();
    if (!ready) {
      return false;
    }

    const ads = await import('react-native-google-mobile-ads');
    const requestOptions = canRequestPersonalizedAds()
      ? undefined
      : { requestNonPersonalizedAdsOnly: true };
    const interstitial = ads.InterstitialAd.createForAdRequest(
      unitId,
      requestOptions,
    );

    const shown = await new Promise<boolean>((resolve) => {
      let settled = false;
      const done = (value: boolean) => {
        if (settled) {
          return;
        }
        settled = true;
        resolve(value);
      };

      const loaded = interstitial.addAdEventListener(
        ads.AdEventType.LOADED,
        () => {
          void interstitial.show().then(
            () => done(true),
            () => done(false),
          );
        },
      );
      const error = interstitial.addAdEventListener(ads.AdEventType.ERROR, () => {
        loaded();
        error();
        closed();
        done(false);
      });
      const closed = interstitial.addAdEventListener(ads.AdEventType.CLOSED, () => {
        loaded();
        error();
        closed();
        done(true);
      });

      // Timeout so Home never waits forever.
      setTimeout(() => done(false), 4000);
      interstitial.load();
    });

    if (shown) {
      sessionShown += 1;
      caps.completedSoloMatches = 0;
      caps.lastShownAt = Date.now();
      await persistCaps();
    }
    return shown;
  } catch {
    return false;
  }
}

export function __resetInterstitialForTests(): void {
  sessionShown = 0;
  caps = { completedSoloMatches: 0, lastShownAt: null };
  mobileAdsReady = false;
}
