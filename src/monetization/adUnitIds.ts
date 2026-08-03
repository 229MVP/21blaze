import { Platform } from 'react-native';

import { isAdMobTestModeForced } from '../config/featureFlags';
import { resolveAdUnitId, type AdSupportedPlatform } from './adUnitResolution';

/** Google sample / test IDs — used whenever production IDs are not configured. */
export const ADMOB_TEST = {
  androidAppId: 'ca-app-pub-3940256099942544~3347511713',
  iosAppId: 'ca-app-pub-3940256099942544~1458002511',
  rewardedAndroid: 'ca-app-pub-3940256099942544/5224354917',
  rewardedIos: 'ca-app-pub-3940256099942544/1712485313',
  interstitialAndroid: 'ca-app-pub-3940256099942544/1033173712',
  interstitialIos: 'ca-app-pub-3940256099942544/4411468910',
} as const;

function readEnv(name: string): string {
  const value = process.env[name];
  return typeof value === 'string' ? value.trim() : '';
}

function currentPlatform(): AdSupportedPlatform | null {
  if (Platform.OS === 'ios' || Platform.OS === 'android') {
    return Platform.OS;
  }
  return null;
}

export function getAdMobAppId(): string | null {
  const platform = currentPlatform();
  if (!platform) {
    return null;
  }
  return resolveAdUnitId({
    platform,
    isTestModeForced: isAdMobTestModeForced(),
    configuredValue:
      platform === 'ios'
        ? readEnv('EXPO_PUBLIC_ADMOB_IOS_APP_ID')
        : readEnv('EXPO_PUBLIC_ADMOB_ANDROID_APP_ID'),
    testValue: platform === 'ios' ? ADMOB_TEST.iosAppId : ADMOB_TEST.androidAppId,
  });
}

export function getRewardedAdUnitId(): string | null {
  const platform = currentPlatform();
  if (!platform) {
    return null;
  }
  return resolveAdUnitId({
    platform,
    isTestModeForced: isAdMobTestModeForced(),
    configuredValue:
      platform === 'ios'
        ? readEnv('EXPO_PUBLIC_ADMOB_REWARDED_IOS_ID')
        : readEnv('EXPO_PUBLIC_ADMOB_REWARDED_ANDROID_ID'),
    testValue: platform === 'ios' ? ADMOB_TEST.rewardedIos : ADMOB_TEST.rewardedAndroid,
  });
}

export function getInterstitialAdUnitId(): string | null {
  const platform = currentPlatform();
  if (!platform) {
    return null;
  }
  return resolveAdUnitId({
    platform,
    isTestModeForced: isAdMobTestModeForced(),
    configuredValue:
      platform === 'ios'
        ? readEnv('EXPO_PUBLIC_ADMOB_INTERSTITIAL_IOS_ID')
        : readEnv('EXPO_PUBLIC_ADMOB_INTERSTITIAL_ANDROID_ID'),
    testValue:
      platform === 'ios' ? ADMOB_TEST.interstitialIos : ADMOB_TEST.interstitialAndroid,
  });
}

export function isUsingTestAdUnits(): boolean {
  if (isAdMobTestModeForced()) {
    return true;
  }
  const rewarded = getRewardedAdUnitId();
  const interstitial = getInterstitialAdUnitId();
  return (
    rewarded === ADMOB_TEST.rewardedAndroid ||
    rewarded === ADMOB_TEST.rewardedIos ||
    interstitial === ADMOB_TEST.interstitialAndroid ||
    interstitial === ADMOB_TEST.interstitialIos
  );
}
