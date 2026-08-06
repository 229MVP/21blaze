import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import { getLastRewardedAdAtMs } from './adActivityTracker';
import { getInterstitialAdUnitId } from './adUnitIds';
import { canRequestPersonalizedAds } from './adConsentService';
import { trackEvent } from './analytics';
import {
  isInterstitialEligible,
  utcDayKey,
  type InterstitialEligibilityContext,
  type InterstitialScreen,
} from './interstitialPolicy';
import { isInterstitialAdsEnabled } from '../config/featureFlags';
import { isBasicStartupModeActive } from '../startup/basicStartupMode';
import { initializeAdsOnce } from '../services/adService';

const STORAGE_KEY = '21blaze.interstitialCaps.v2';
const FIRST_SESSION_KEY = '21blaze.hasLaunchedSession.v1';

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

let caps: CapState = { ...DEFAULT_CAPS };
/** True until this process has completed one full hydrate — blocks ads on first launch. */
let isFirstAppSession = true;
let currentScreen: InterstitialScreen = 'home';

/** Called by screens as they mount/unmount so the pure policy always has an
 * accurate "never during" signal without any screen owning ad logic. */
export function setInterstitialCurrentScreen(screen: InterstitialScreen): void {
  currentScreen = screen;
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

function buildEligibilityContext(hasRemoveAds: boolean): InterstitialEligibilityContext {
  const nowMs = Date.now();
  return {
    interstitialAdsEnabled: isInterstitialAdsEnabled(),
    isWeb: Platform.OS === 'web',
    hasRemoveAds,
    isFirstAppSession,
    completedEligibleMatches: caps.completedSoloMatches,
    lastShownAtMs: caps.lastShownAt,
    nowMs,
    utcDailyCount: caps.dailyCount,
    utcDailyKey: caps.dailyKey,
    todayUtcKey: utcDayKey(nowMs),
    currentScreen,
    lastRewardedAdAtMs: getLastRewardedAdAtMs(),
  };
}

export function canShowInterstitial(hasRemoveAds: boolean): boolean {
  if (isBasicStartupModeActive()) {
    return false;
  }
  return isInterstitialEligible(buildEligibilityContext(hasRemoveAds)).eligible;
}

/**
 * Attempt interstitial after Solo → Home. Never blocks navigation.
 */
export async function maybeShowInterstitialAfterSoloHome(
  hasRemoveAds: boolean,
): Promise<boolean> {
  if (isBasicStartupModeActive()) {
    return false;
  }
  const context = buildEligibilityContext(hasRemoveAds);
  const decision = isInterstitialEligible(context);
  trackEvent('interstitial_eligible', {
    eligible: decision.eligible,
    reason: decision.eligible ? undefined : decision.reason,
  });
  if (!decision.eligible) {
    return false;
  }

  const unitId = getInterstitialAdUnitId();
  if (!unitId) {
    return false;
  }

  try {
    const ready = await initializeAdsOnce();
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
          trackEvent('interstitial_loaded');
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
        trackEvent('interstitial_failed');
        done(false);
      });
      const closed = interstitial.addAdEventListener(ads.AdEventType.CLOSED, () => {
        loaded();
        error();
        closed();
        trackEvent('interstitial_dismissed');
        done(true);
      });

      // Timeout so Home never waits forever.
      setTimeout(() => done(false), 4000);
      interstitial.load();
    });

    if (shown) {
      trackEvent('interstitial_shown');
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
  caps = { ...DEFAULT_CAPS };
  isFirstAppSession = false;
  currentScreen = 'home';
}
