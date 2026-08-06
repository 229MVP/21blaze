/** @type {import('@expo/config').ExpoConfig} */
const appJson = require('./app.json');

/**
 * Dynamic Expo config — testflight-rescue disables EAS Update so an OTA
 * cannot override the embedded rescue JavaScript bundle.
 */
module.exports = ({ config }) => {
  const profile = process.env.EAS_BUILD_PROFILE ?? '';
  const isRescue = profile === 'testflight-rescue';

  const expo = {
    ...appJson.expo,
    ...(config?.expo ?? {}),
  };

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
