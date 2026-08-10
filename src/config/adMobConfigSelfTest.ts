/**
 * AdMob native + EAS profile consistency tests.
 * Run: npm run test:admob-config
 */

const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const {
  ADMOB_NATIVE_TEST,
  assertAdMobProfileConsistency,
  isGoogleSampleAdMobAppId,
  isValidProductionAdMobAppId,
  resolveAdMobNativeConfig,
} = require(join(process.cwd(), 'src/config/expoAdMobNativeConfig.js'));

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`AdMob config self-test failed: ${message}`);
  }
}

function loadEasProfiles(): Record<string, { env?: Record<string, string> }> {
  const eas = JSON.parse(readFileSync(join(process.cwd(), 'eas.json'), 'utf8'));
  return eas.build ?? {};
}

function profileEnv(
  profileName: string,
  profiles: Record<string, { env?: Record<string, string> }>,
): Record<string, string> {
  return { ...(profiles[profileName]?.env ?? {}) };
}

function resolvedNativeForProfile(
  profileName: string,
  profiles: Record<string, { env?: Record<string, string> }>,
) {
  const env = profileEnv(profileName, profiles);
  return resolveAdMobNativeConfig(env);
}

export function runAdMobConfigSelfTests() {
  const profiles = loadEasProfiles();

  // Preview / QA use test native IDs
  const preview = resolvedNativeForProfile('preview', profiles);
  assert(preview.useTestNativeAppIds, 'preview uses test native app ids');
  assert(
    isGoogleSampleAdMobAppId(preview.iosAppId),
    'preview ios native id is google sample',
  );

  const qa = resolvedNativeForProfile('live-pvp-qa', profiles);
  assert(qa.useTestNativeAppIds, 'live-pvp-qa uses test native ids');
  assert(profileEnv('live-pvp-qa', profiles).EXPO_PUBLIC_ADMOB_USE_TEST_ADS === 'true', 'qa forces test ads');

  // Production without EAS AdMob secrets blocks live ads
  const prodNoSecrets = resolveAdMobNativeConfig({
    EXPO_PUBLIC_APP_ENV: 'production',
    EXPO_PUBLIC_ADMOB_USE_TEST_ADS: 'false',
  });
  assert(prodNoSecrets.productionMonetizationAdsDisabled, 'prod without ids disables monetization ads');
  assert(prodNoSecrets.useTestNativeAppIds, 'prod without ids uses test native at build (ads disabled in JS)');

  const prodWithIds = resolveAdMobNativeConfig({
    EXPO_PUBLIC_APP_ENV: 'production',
    EXPO_PUBLIC_ADMOB_USE_TEST_ADS: 'false',
    EXPO_PUBLIC_ADMOB_IOS_APP_ID: 'ca-app-pub-1234567890123456~1234567890',
    EXPO_PUBLIC_ADMOB_ANDROID_APP_ID: 'ca-app-pub-1234567890123456~0987654321',
  });
  assert(!prodWithIds.useTestNativeAppIds, 'prod with verified ids uses production native');
  assert(!prodWithIds.productionMonetizationAdsDisabled, 'prod with ids keeps ads enabled flag path');

  // Never sample native + live ads in production profile env
  const prodProfile = { ...profileEnv('production', profiles) };
  const prodResolved = resolveAdMobNativeConfig(prodProfile);
  if (prodResolved.productionMonetizationAdsDisabled) {
    prodProfile.EXPO_PUBLIC_ENABLE_REWARDED_ADS = 'false';
    prodProfile.EXPO_PUBLIC_ENABLE_INTERSTITIAL_ADS = 'false';
  }
  const consistency = assertAdMobProfileConsistency({
    appEnv: prodProfile.EXPO_PUBLIC_APP_ENV ?? 'production',
    testAdsForced: prodProfile.EXPO_PUBLIC_ADMOB_USE_TEST_ADS === 'true',
    iosAppId: prodResolved.iosAppId,
    androidAppId: prodResolved.androidAppId,
    rewardedAdsEnabled: prodProfile.EXPO_PUBLIC_ENABLE_REWARDED_ADS === 'true',
    interstitialAdsEnabled: prodProfile.EXPO_PUBLIC_ENABLE_INTERSTITIAL_ADS === 'true',
  });
  assert(consistency.ok, `production eas profile consistent: ${consistency.reason ?? 'ok'}`);

  assert(
    isValidProductionAdMobAppId('ca-app-pub-1234567890123456~1234567890'),
    'valid production id pattern',
  );
  assert(
    !isValidProductionAdMobAppId(ADMOB_NATIVE_TEST.iosAppId),
    'google sample is not valid production',
  );

  // app.config applies AdMob plugin with resolved ids
  const appConfigSrc = readFileSync(join(process.cwd(), 'app.config.js'), 'utf8');
  assert(appConfigSrc.includes('resolveAdMobNativeConfig'), 'app.config resolves admob dynamically');
  assert(appConfigSrc.includes('productionMonetizationAdsDisabled'), 'app.config can disable prod ads');
}

if (require.main === module) {
  runAdMobConfigSelfTests();
  console.log('AdMob configuration self-tests passed.');
}
