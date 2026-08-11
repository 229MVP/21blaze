/** @type {import('@expo/config').ExpoConfig} */
const appJson = require('./app.json');
const {
  resolveAdMobNativeConfig,
} = require('./src/config/expoAdMobNativeConfig.js');

const ADMOB_PLUGIN = 'react-native-google-mobile-ads';

function isTruthy(value) {
  if (!value) return false;
  const n = String(value).trim().toLowerCase();
  return n === '1' || n === 'true' || n === 'yes';
}

function applyAdMobPlugin(expo, admob) {
  const plugins = (expo.plugins ?? []).map((entry) => {
    if (entry === ADMOB_PLUGIN) {
      return [
        ADMOB_PLUGIN,
        {
          androidAppId: admob.androidAppId,
          iosAppId: admob.iosAppId,
        },
      ];
    }
    if (Array.isArray(entry) && entry[0] === ADMOB_PLUGIN) {
      return [
        ADMOB_PLUGIN,
        {
          androidAppId: admob.androidAppId,
          iosAppId: admob.iosAppId,
        },
      ];
    }
    return entry;
  });
  return { ...expo, plugins };
}

function applyIosGadPlist(expo, gadId) {
  const ios = { ...(expo.ios ?? {}) };
  const infoPlist = { ...(ios.infoPlist ?? {}) };
  infoPlist.GADApplicationIdentifier = gadId;
  ios.infoPlist = infoPlist;
  return { ...expo, ios };
}

function applyExpoAudioPlaybackOnly(expo) {
  const plugins = (expo.plugins ?? []).map((entry) => {
    if (entry === 'expo-audio') {
      return [
        'expo-audio',
        {
          microphonePermission: false,
          recordAudioAndroid: false,
          enableBackgroundPlayback: false,
          enableBackgroundRecording: false,
        },
      ];
    }
    return entry;
  });
  const android = { ...(expo.android ?? {}) };
  // Let expo-audio plugin declare MODIFY_AUDIO_SETTINGS only.
  delete android.permissions;
  return { ...expo, plugins, android };
}

/**
 * Dynamic Expo config — environment-specific AdMob native IDs, audio permissions,
 * and testflight-rescue update disable.
 */
module.exports = ({ config }) => {
  const profile = process.env.EAS_BUILD_PROFILE ?? '';
  const isRescue = profile === 'testflight-rescue';

  const admob = resolveAdMobNativeConfig(process.env);

  if (admob.productionMonetizationAdsDisabled) {
    process.env.EXPO_PUBLIC_ENABLE_REWARDED_ADS = 'false';
    process.env.EXPO_PUBLIC_ENABLE_INTERSTITIAL_ADS = 'false';
  }

  let expo = {
    ...appJson.expo,
    ...(config?.expo ?? {}),
  };

  expo = applyExpoAudioPlaybackOnly(expo);
  expo = applyAdMobPlugin(expo, admob);
  expo = applyIosGadPlist(expo, admob.iosGadApplicationIdentifier);

  expo.extra = {
    ...(expo.extra ?? {}),
    admobNativeTestIds: admob.useTestNativeAppIds,
    productionLiveAdsBlocked: admob.productionLiveAdsBlocked,
    productionMonetizationAdsDisabled: admob.productionMonetizationAdsDisabled,
    easBuildProfile: profile || undefined,
  };

  if (!expo.extra.note || expo.extra.note.includes('PLACEHOLDER')) {
    expo.extra = {
      ...expo.extra,
      note:
        'EAS projectId links this repo to the Expo project at expo.dev. Configure EXPO_PUBLIC_ADMOB_* via EAS environment variables for production store builds; when unset, production ads are disabled at build time.',
    };
  }

  if (isRescue) {
    expo.updates = {
      ...(expo.updates ?? {}),
      enabled: false,
    };
    expo.extra = {
      ...expo.extra,
      rescueStartupProfile: true,
      expoUpdatesEnabled: false,
    };
  }

  return {
    ...config,
    expo,
  };
};
