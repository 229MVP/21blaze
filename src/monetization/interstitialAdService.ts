import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import { getInterstitialAdUnitId } from './adUnitIds';
import {
  canRequestPersonalizedAds,
  requestAdConsentIfNeeded,
} from './adConsentService';
import { isInterstitialAdsEnabled } from '../config/featureFlags';

const STORAGE_KEY = '21blaze.interstitialCaps.v2';
const FIRST_SESSION_KEY = '21blaze.hasLaunchedSession.v1';
const MIN_INTERVAL_MS = 10 * 60 * 1000;
const MATCHES_PER_AD = 3;
const MAX_PER_SESSION = 3;
const MAX_PER_UTC_DAY = 3;

type CapState = {
  completedSoloMatches: number;
  lastShownAt: number | null;
  /** UTC yyyy-mm-dd of the last day an interstitial was shown. */
  dailyKey: string | null;
  dailyCount: number;
};

const DEFAULT_CAPS: CapState = {
  completedSoloMatches: 0,
  lastShownAt: null,
  dailyKey: null,
  dailyCount: 0,
};

let sessionShown = 0;
let caps: CapState = { ...DEFAULT_CAPS };
let mobileAdsReady = false;
/** True until this process has completed one full hydrate — blocks ads on first launch. */
let isFirstAppSession = true;

function utcDayKey(nowMs: number): string {
  return new Date(nowMs).toISOString().slice(0, 10);
}

export async function hydrateInterstitialCaps(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<CapState>;
      caps = {
        completedSoloMatches:
          typeof parsed.completedSoloMatches === 'number'
            ? parsed.completedSoloMatches
            : 0,
        lastShownAt:
          typeof parsed.lastShownAt === 'number' ? parsed.lastShownAt : null,
        dailyKey: typeof parsed.dailyKey === 'string' ? parsed.dailyKey : null,
        dailyCount:
          typeof parsed.dailyCount === 'number' ? parsed.dailyCount : 0,
      };
    }
  } catch {
    // ignore — keep defaults
  }

  try {
    const seen = await AsyncStorage.getItem(FIRST_SESSION_KEY);
    isFirstAppSession = !seen;
    if (!seen) {
      await AsyncStorage.setItem(FIRST_SESSION_KEY, '1');
    }
  } catch {
    // Fail safe: treat as first session so we never show ads before launch is confirmed.
    isFirstAppSession = true;
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
  if (isFirstAppSession) {
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
  const todayKey = utcDayKey(Date.now());
  const dailyCountToday = caps.dailyKey === todayKey ? caps.dailyCount : 0;
  if (dailyCountToday >= MAX_PER_UTC_DAY) {
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
      const todayKey = utcDayKey(Date.now());
      if (caps.dailyKey === todayKey) {
        caps.dailyCount += 1;
      } else {
        caps.dailyKey = todayKey;
        caps.dailyCount = 1;
      }
      await persistCaps();
    }
    return shown;
  } catch {
    return false;
  }
}

export function __resetInterstitialForTests(): void {
  sessionShown = 0;
  caps = { ...DEFAULT_CAPS };
  mobileAdsReady = false;
  isFirstAppSession = false;
}
