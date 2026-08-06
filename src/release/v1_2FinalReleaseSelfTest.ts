import { readFileSync } from 'node:fs';
import path from 'node:path';

import { APP_VERSION } from '../game/constants';
import { runGameStartCountdownLayoutSelfTests } from '../components/GameTimer/gameStartCountdownLayoutSelfTest';

const REPO_ROOT = path.resolve(__dirname, '../..');

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Self-test failed: ${message}`);
  }
}

export function runV1_2FinalReleaseSelfTests(): void {
  assert(APP_VERSION === '1.2.0', 'APP_VERSION must be 1.2.0');

  const appJson = JSON.parse(readFileSync(path.join(REPO_ROOT, 'app.json'), 'utf8'));
  assert(appJson.expo.version === '1.2.0', 'app.json version must be 1.2.0');
  assert(
    appJson.expo.ios.bundleIdentifier === 'com.twentyoneblaze.app',
    'iOS bundle identifier must be com.twentyoneblaze.app',
  );
  assert(
    appJson.expo.android.package === 'com.twentyoneblaze.app',
    'Android package must be com.twentyoneblaze.app',
  );

  const easConfig = JSON.parse(readFileSync(path.join(REPO_ROOT, 'eas.json'), 'utf8'));
  assert(
    easConfig.build.testflight.env.EXPO_PUBLIC_ENABLE_STORE_PURCHASES === 'false',
    'testflight profile keeps purchases disabled',
  );
  assert(
    easConfig.build.production.env.EXPO_PUBLIC_ENABLE_STORE_PURCHASES === 'false',
    'production profile keeps purchases disabled',
  );
  assert(
    easConfig.build.testflight.env.EXPO_PUBLIC_ADMOB_USE_TEST_ADS === 'true',
    'testflight must force test ads',
  );
  assert(
    easConfig.build.production.env.EXPO_PUBLIC_ADMOB_USE_TEST_ADS === 'false',
    'production must not force test ads',
  );
  assert(
    easConfig.build.testflight.env.EXPO_PUBLIC_ENABLE_V1_1_LOCKER === 'true',
    'testflight enables locker for 1.2.0',
  );
  assert(
    easConfig.build.testflight.env.EXPO_PUBLIC_ENABLE_V1_2_VISUAL_SYSTEM === 'true',
    'testflight enables visual system for 1.2.0',
  );
  assert(
    !('EXPO_PUBLIC_ENABLE_DAILY_CHALLENGE' in easConfig.build.testflight.env),
    'daily challenge env must not be present on 1.2.0 testflight profile',
  );

  const navigatorSource = readFileSync(
    path.join(REPO_ROOT, 'src/navigation/AppNavigator.tsx'),
    'utf8',
  );
  assert(
    navigatorSource.includes('isLiveDuelEnabled()'),
    'Live duel routes are flag-gated',
  );
  assert(
    navigatorSource.includes('isQuickMatchEnabled()'),
    'Quick match routes are flag-gated',
  );
  assert(
    navigatorSource.includes('isRankedBetaEnabled()'),
    'Ranked routes are flag-gated',
  );
  assert(
    !navigatorSource.includes('DailyChallenge'),
    'Daily challenge routes must not be registered',
  );

  const highScoresSource = readFileSync(
    path.join(REPO_ROOT, 'src/screens/HighScoresScreen.tsx'),
    'utf8',
  );
  assert(
    !highScoresSource.includes("label: 'FRIENDS'"),
    'Friends leaderboard tab must be hidden for 1.2.0',
  );

  const appSource = readFileSync(path.join(REPO_ROOT, 'App.tsx'), 'utf8');
  const appShellSource = readFileSync(path.join(REPO_ROOT, 'AppShell.tsx'), 'utf8');
  assert(
    appSource.includes('lazy') || appSource.includes('StartupFallbackView'),
    'Startup hardening (lazy shell or fallback) must remain',
  );
  assert(appShellSource.includes('ErrorBoundary'), 'Root ErrorBoundary must remain in AppShell');

  runGameStartCountdownLayoutSelfTests();
}

if (require.main === module) {
  runV1_2FinalReleaseSelfTests();
  console.log('Version 1.2.0 final release self-tests passed.');
}
