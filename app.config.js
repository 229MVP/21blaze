/** @type {import('@expo/config').ExpoConfig} */
const appJson = require('./app.json');

const ADMOB_PLUGIN = 'react-native-google-mobile-ads';

function readEnv(name) {
  const value = process.env[name];
  return typeof value === 'string' ? value.trim() : '';
}

function withProductionAdMobPluginIds(plugins) {
  const androidAppId = readEnv('EXPO_PUBLIC_ADMOB_ANDROID_APP_ID');
  const iosAppId = readEnv('EXPO_PUBLIC_ADMOB_IOS_APP_ID');
  if (!androidAppId && !iosAppId) {
    return plugins;
  }

  return plugins.map((entry) => {
    if (entry === ADMOB_PLUGIN) {
      return [
        ADMOB_PLUGIN,
        {
          androidAppId: androidAppId || appJson.expo.plugins.find(
            (p) => Array.isArray(p) && p[0] === ADMOB_PLUGIN,
          )?.[1]?.androidAppId,
          iosAppId: iosAppId || appJson.expo.plugins.find(
            (p) => Array.isArray(p) && p[0] === ADMOB_PLUGIN,
          )?.[1]?.iosAppId,
        },
      ];
    }
    if (Array.isArray(entry) && entry[0] === ADMOB_PLUGIN) {
      return [
        ADMOB_PLUGIN,
        {
          ...entry[1],
          ...(androidAppId ? { androidAppId } : {}),
          ...(iosAppId ? { iosAppId } : {}),
        },
      ];
    }
    return entry;
  });
}

/**
 * Dynamic Expo config — testflight-rescue disables EAS Update; production
 * builds may inject live AdMob app IDs from EAS environment variables.
 */
module.exports = ({ config }) => {
  const profile = process.env.EAS_BUILD_PROFILE ?? '';
  const isRescue = profile === 'testflight-rescue';
  const isProductionProfile =
    profile === 'production' || profile === 'android-production';

  const expo = {
    ...appJson.expo,
    ...(config?.expo ?? {}),
  };

  if (isProductionProfile) {
    expo.plugins = withProductionAdMobPluginIds(expo.plugins ?? []);
    const iosAppId = readEnv('EXPO_PUBLIC_ADMOB_IOS_APP_ID');
    if (iosAppId && expo.ios?.infoPlist) {
      expo.ios.infoPlist.GADApplicationIdentifier = iosAppId;
    }
  }

  if (isRescue) {
    expo.updates = {
      ...(expo.updates ?? {}),
      enabled: false,
    };
    expo.extra = {
      ...(expo.extra ?? {}),
      rescueStartupProfile: true,
      expoUpdatesEnabled: false,
    };
  }

  return {
    ...config,
    expo,
  };
};
