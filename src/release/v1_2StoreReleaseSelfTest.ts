import { readFileSync } from 'node:fs';
import path from 'node:path';

import { runV1_2FinalReleaseSelfTests } from './v1_2FinalReleaseSelfTest';

const REPO_ROOT = path.resolve(__dirname, '../..');

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Self-test failed: ${message}`);
  }
}

export function runV1_2StoreReleaseSelfTests(): void {
  runV1_2FinalReleaseSelfTests();

  const easConfig = JSON.parse(readFileSync(path.join(REPO_ROOT, 'eas.json'), 'utf8'));

  assert(easConfig.build.production, 'production profile exists');
  assert(
    easConfig.build.production.distribution === 'store',
    'production profile uses store distribution',
  );
  assert(easConfig.build.production.autoIncrement === true, 'production autoIncrement enabled');
  assert(
    easConfig.build.production.developmentClient === undefined,
    'production profile does not set developmentClient',
  );
  assert(
    easConfig.build.production.ios?.simulator === false,
    'production iOS builds device binaries only',
  );
  assert(
    easConfig.build.production.android === undefined,
    'production profile is iOS-only; Android uses android-production',
  );

  assert(easConfig.build['android-production'], 'android-production profile exists');
  assert(
    easConfig.build['android-production'].distribution === 'store',
    'android-production uses store distribution',
  );
  assert(
    easConfig.build['android-production'].android?.buildType === 'app-bundle',
    'android-production builds AAB not APK',
  );
  assert(
    easConfig.build['android-production'].developmentClient === undefined,
    'android-production does not set developmentClient',
  );
  assert(
    easConfig.build.preview.android?.buildType === 'apk',
    'preview profile preserves APK for internal Android QA',
  );

  assert(
    easConfig.build['android-production'].env.EXPO_PUBLIC_ENABLE_STORE_PURCHASES === 'false',
    'android-production keeps purchases disabled',
  );
  assert(
    easConfig.build['android-production'].env.EXPO_PUBLIC_ADMOB_USE_TEST_ADS === 'false',
    'android-production does not force test ads',
  );

  const appConfigSource = readFileSync(path.join(REPO_ROOT, 'app.config.js'), 'utf8');
  assert(
    appConfigSource.includes('EXPO_PUBLIC_ADMOB_IOS_APP_ID'),
    'app.config.js supports production AdMob app ID injection',
  );

  const sabotageSpec = readFileSync(
    path.join(REPO_ROOT, 'docs/FUTURE_SABOTAGE_MODE_SPEC.md'),
    'utf8',
  );
  assert(sabotageSpec.includes('Time Burn'), 'Sabotage spec documents Time Burn');
  assert(sabotageSpec.includes('Mirror Flame'), 'Sabotage spec documents Mirror Flame');
  assert(
    sabotageSpec.includes('Not implemented'),
    'Sabotage spec marked not implemented for 1.2.0',
  );

  const storeMatrix = readFileSync(
    path.join(REPO_ROOT, 'docs/STORE_RELEASE_FEATURE_MATRIX.md'),
    'utf8',
  );
  assert(storeMatrix.includes('SHIPPING'), 'Store release feature matrix exists');
  assert(storeMatrix.includes('Sabotage Battle Mode'), 'Sabotage deferred in store matrix');
}

if (require.main === module) {
  runV1_2StoreReleaseSelfTests();
  console.log('Version 1.2.0 store release self-tests passed.');
}
