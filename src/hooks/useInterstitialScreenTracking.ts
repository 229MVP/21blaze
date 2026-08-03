import { useEffect } from 'react';

import { setInterstitialCurrentScreen } from '../monetization/interstitialAdService';
import type { InterstitialScreen } from '../monetization/interstitialPolicy';

/**
 * Reports the current screen to the interstitial policy so `isInterstitialEligible`
 * always blocks correctly if an interstitial trigger is ever added elsewhere.
 * Resets to `fallback` (default 'home') on unmount.
 */
export function useInterstitialScreenTracking(
  screen: InterstitialScreen,
  fallback: InterstitialScreen = 'home',
): void {
  useEffect(() => {
    setInterstitialCurrentScreen(screen);
    return () => {
      setInterstitialCurrentScreen(fallback);
    };
  }, [screen, fallback]);
}
