/**
 * Prints resolved Expo config for testflight-rescue without secret values.
 * Usage: node scripts/print-rescue-config.mjs
 */
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function loadConfig(profile) {
  const envVars = {
    EAS_BUILD_PROFILE: profile,
    EXPO_PUBLIC_RESCUE_STARTUP_PROFILE: profile === 'testflight-rescue' ? 'true' : 'false',
    EXPO_PUBLIC_EXPO_UPDATES_ENABLED: profile === 'testflight-rescue' ? 'false' : '',
    EXPO_PUBLIC_DISABLE_STARTUP_ADS: profile === 'testflight-rescue' ? 'true' : '',
    EXPO_PUBLIC_DISABLE_STARTUP_UMP: profile === 'testflight-rescue' ? 'true' : '',
    EXPO_PUBLIC_DISABLE_STARTUP_NOTIFICATIONS: profile === 'testflight-rescue' ? 'true' : '',
    EXPO_PUBLIC_DISABLE_STARTUP_VISUAL_PRELOAD: profile === 'testflight-rescue' ? 'true' : '',
    EXPO_PUBLIC_ENABLE_STORE_PURCHASES: 'false',
  };

  const serialized = Object.entries(envVars)
    .map(([key, value]) => `${key}=${value}`)
    .join(' ');

  const raw = execSync(`${serialized} npx expo config --type public --json`, {
    encoding: 'utf8',
    cwd: REPO_ROOT,
    env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' },
  });

  return JSON.parse(raw);
}

const rescue = loadConfig('testflight-rescue');

const summary = {
  version: rescue.version,
  ios: {
    bundleIdentifier: rescue.ios?.bundleIdentifier,
    buildNumber: rescue.ios?.buildNumber,
    deploymentTarget: rescue.ios?.deploymentTarget,
  },
  updates: rescue.updates ?? null,
  extra: {
    rescueStartupProfile: rescue.extra?.rescueStartupProfile ?? null,
    expoUpdatesEnabled: rescue.extra?.expoUpdatesEnabled ?? null,
    easProjectIdPresent: Boolean(rescue.extra?.eas?.projectId),
  },
  plugins: (rescue.plugins ?? []).map((plugin) =>
    Array.isArray(plugin) ? plugin[0] : plugin,
  ),
  main: rescue.main ?? 'index.ts',
};

console.log(JSON.stringify(summary, null, 2));
