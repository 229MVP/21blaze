/**
 * Pure AdMob native + JS resolution for Expo config and self-tests.
 * Google sample publisher id 3940256099942544 is test-only.
 */

const ADMOB_GOOGLE_TEST_PUBLISHER = '3940256099942544';

const ADMOB_NATIVE_TEST = {
  iosAppId: `ca-app-pub-${ADMOB_GOOGLE_TEST_PUBLISHER}~1458002511`,
  androidAppId: `ca-app-pub-${ADMOB_GOOGLE_TEST_PUBLISHER}~3347511713`,
};

function readEnv(name, env) {
  const value = env[name];
  return typeof value === 'string' ? value.trim() : '';
}

function isTruthyFlag(value) {
  if (!value) return false;
  const n = value.trim().toLowerCase();
  return n === '1' || n === 'true' || n === 'yes';
}

function isGoogleSampleAdMobAppId(appId) {
  return appId.includes(ADMOB_GOOGLE_TEST_PUBLISHER);
}

function isValidProductionAdMobAppId(appId) {
  if (!appId) return false;
  if (!/^ca-app-pub-\d+~[\w]+$/.test(appId)) return false;
  return !isGoogleSampleAdMobAppId(appId);
}

function resolveAdMobNativeConfig(env = process.env) {
  const appEnv = readEnv('EXPO_PUBLIC_APP_ENV', env) || 'development';
  const testAdsForced = isTruthyFlag(env.EXPO_PUBLIC_ADMOB_USE_TEST_ADS);
  const configuredIos = readEnv('EXPO_PUBLIC_ADMOB_IOS_APP_ID', env);
  const configuredAndroid = readEnv('EXPO_PUBLIC_ADMOB_ANDROID_APP_ID', env);

  const hasProductionNativeIds =
    isValidProductionAdMobAppId(configuredIos) &&
    isValidProductionAdMobAppId(configuredAndroid);

  if (appEnv !== 'production' || testAdsForced) {
    return {
      iosAppId: ADMOB_NATIVE_TEST.iosAppId,
      androidAppId: ADMOB_NATIVE_TEST.androidAppId,
      iosGadApplicationIdentifier: ADMOB_NATIVE_TEST.iosAppId,
      useTestNativeAppIds: true,
      productionLiveAdsBlocked: false,
      productionMonetizationAdsDisabled: false,
    };
  }

  if (!hasProductionNativeIds) {
    return {
      iosAppId: ADMOB_NATIVE_TEST.iosAppId,
      androidAppId: ADMOB_NATIVE_TEST.androidAppId,
      iosGadApplicationIdentifier: ADMOB_NATIVE_TEST.iosAppId,
      useTestNativeAppIds: true,
      productionLiveAdsBlocked: true,
      productionMonetizationAdsDisabled: true,
    };
  }

  return {
    iosAppId: configuredIos,
    androidAppId: configuredAndroid,
    iosGadApplicationIdentifier: configuredIos,
    useTestNativeAppIds: false,
    productionLiveAdsBlocked: false,
    productionMonetizationAdsDisabled: false,
  };
}

function assertAdMobProfileConsistency(input) {
  const sampleNative =
    isGoogleSampleAdMobAppId(input.iosAppId) ||
    isGoogleSampleAdMobAppId(input.androidAppId);

  if (input.appEnv === 'production' && !input.testAdsForced && sampleNative) {
    if (input.rewardedAdsEnabled || input.interstitialAdsEnabled) {
      return {
        ok: false,
        reason: 'production_sample_native_ids_with_live_ads_enabled',
      };
    }
  }

  if (
    input.appEnv === 'production' &&
    !input.testAdsForced &&
    !sampleNative &&
    (!isValidProductionAdMobAppId(input.iosAppId) ||
      !isValidProductionAdMobAppId(input.androidAppId))
  ) {
    return { ok: false, reason: 'production_invalid_native_app_ids' };
  }

  return { ok: true };
}

module.exports = {
  ADMOB_GOOGLE_TEST_PUBLISHER,
  ADMOB_NATIVE_TEST,
  isGoogleSampleAdMobAppId,
  isValidProductionAdMobAppId,
  resolveAdMobNativeConfig,
  assertAdMobProfileConsistency,
};
