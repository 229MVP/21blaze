import { Platform } from 'react-native';

import { recordRewardedAdInteraction } from './adActivityTracker';
import { getRewardedAdUnitId } from './adUnitIds';
import { canRequestPersonalizedAds } from './adConsentService';
import { trackEvent } from './analytics';
import type { AdRewardType } from './types';
import { isRewardedAdsEnabled } from '../config/featureFlags';
import { initializeAdsOnce } from '../services/adService';

export type RewardedAdOutcome =
  | { status: 'earned'; clientRewardId: string }
  | { status: 'dismissed' }
  | { status: 'unavailable'; message: string }
  | { status: 'error'; message: string };

function createClientRewardId(rewardType: AdRewardType): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `${rewardType}:${Date.now()}:${rand}`;
}

/**
 * Show a rewarded ad after an explicit player tap.
 * Reward is NOT granted here — only the earned callback produces a clientRewardId
 * for the secure claim-ad-reward Edge Function.
 */
export async function showRewardedAd(
  rewardType: AdRewardType,
): Promise<RewardedAdOutcome> {
  if (!isRewardedAdsEnabled()) {
    return { status: 'unavailable', message: 'Rewarded ads are disabled.' };
  }
  if (Platform.OS === 'web') {
    return {
      status: 'unavailable',
      message: 'Rewarded ads are not available on web.',
    };
  }

  const unitId = getRewardedAdUnitId();
  if (!unitId) {
    return { status: 'unavailable', message: 'Ad unit is not configured.' };
  }

  const ready = await initializeAdsOnce();
  if (!ready) {
    return { status: 'unavailable', message: 'Ads could not be initialized.' };
  }

  try {
    const ads = await import('react-native-google-mobile-ads');
    const requestOptions = canRequestPersonalizedAds()
      ? undefined
      : { requestNonPersonalizedAdsOnly: true };

    const rewarded = ads.RewardedAd.createForAdRequest(unitId, requestOptions);
    const clientRewardId = createClientRewardId(rewardType);

    const outcome = await new Promise<RewardedAdOutcome>((resolve) => {
      let earned = false;
      let settled = false;

      const finish = (result: RewardedAdOutcome) => {
        if (settled) {
          return;
        }
        settled = true;
        resolve(result);
      };

      const loadedUnsub = rewarded.addAdEventListener(ads.RewardedAdEventType.LOADED, () => {
        recordRewardedAdInteraction();
        trackEvent('rewarded_ad_loaded');
        void rewarded.show();
      });
      const earnedUnsub = rewarded.addAdEventListener(
        ads.RewardedAdEventType.EARNED_REWARD,
        () => {
          earned = true;
        },
      );
      const closedUnsub = rewarded.addAdEventListener(
        ads.AdEventType.CLOSED,
        () => {
          loadedUnsub();
          earnedUnsub();
          closedUnsub();
          errorUnsub();
          if (earned) {
            finish({ status: 'earned', clientRewardId });
          } else {
            finish({ status: 'dismissed' });
          }
        },
      );
      const errorUnsub = rewarded.addAdEventListener(ads.AdEventType.ERROR, () => {
        loadedUnsub();
        earnedUnsub();
        closedUnsub();
        errorUnsub();
        finish({ status: 'error', message: 'Rewarded ad failed to load.' });
      });

      rewarded.load();
    });

    return outcome;
  } catch {
    return { status: 'error', message: 'Unable to show rewarded ad.' };
  }
}
