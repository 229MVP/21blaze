import { Platform } from 'react-native';

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

export function getAdMobAppId(): string | null {
  if (Platform.OS === 'web') {
    return null;
  }
  if (Platform.OS === 'ios') {
    return readEnv('EXPO_PUBLIC_ADMOB_IOS_APP_ID') || ADMOB_TEST.iosAppId;
  }
  if (Platform.OS === 'android') {
    return readEnv('EXPO_PUBLIC_ADMOB_ANDROID_APP_ID') || ADMOB_TEST.androidAppId;
  }
  return null;
}

export function getRewardedAdUnitId(): string | null {
  if (Platform.OS === 'web') {
    return null;
  }
  if (Platform.OS === 'ios') {
    return readEnv('EXPO_PUBLIC_ADMOB_REWARDED_IOS_ID') || ADMOB_TEST.rewardedIos;
  }
  if (Platform.OS === 'android') {
    return (
      readEnv('EXPO_PUBLIC_ADMOB_REWARDED_ANDROID_ID') || ADMOB_TEST.rewardedAndroid
    );
  }
  return null;
}

export function getInterstitialAdUnitId(): string | null {
  if (Platform.OS === 'web') {
    return null;
  }
  if (Platform.OS === 'ios') {
    return (
      readEnv('EXPO_PUBLIC_ADMOB_INTERSTITIAL_IOS_ID') || ADMOB_TEST.interstitialIos
    );
  }
  if (Platform.OS === 'android') {
    return (
      readEnv('EXPO_PUBLIC_ADMOB_INTERSTITIAL_ANDROID_ID') ||
      ADMOB_TEST.interstitialAndroid
    );
  }
  return null;
}

export function isUsingTestAdUnits(): boolean {
  const rewarded = getRewardedAdUnitId();
  const interstitial = getInterstitialAdUnitId();
  return (
    rewarded === ADMOB_TEST.rewardedAndroid ||
    rewarded === ADMOB_TEST.rewardedIos ||
    interstitial === ADMOB_TEST.interstitialAndroid ||
    interstitial === ADMOB_TEST.interstitialIos
  );
}
