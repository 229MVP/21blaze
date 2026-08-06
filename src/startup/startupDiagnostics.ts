import AsyncStorage from '@react-native-async-storage/async-storage';

import { APP_VERSION } from '../game/constants';
import { isExpoUpdatesEnabled } from '../config/featureFlags';
import { isBasicStartupModeActive } from './basicStartupMode';

/**
 * Sanitized startup diagnostics — stage name + timestamp only.
 * Optional metadata: app version, build profile flags, basic mode.
 * Never stores tokens, user ids, wallet values, or secrets.
 */
export type StartupStage =
  | 'native_entry'
  | 'react_registered'
  | 'rescue_root_rendered'
  | 'providers_loading'
  | 'navigation_loading'
  | 'navigation_ready'
  | 'storage_loading'
  | 'storage_ready'
  | 'optional_services_loading'
  | 'optional_services_finished'
  | 'app_ready'
  | 'startup_watchdog_triggered'
  | 'startup_failed'
  | 'startup_error_boundary_triggered'
  | 'classic_theme_ready';

const STORAGE_KEY = '@21blaze/startupDiagnostics';
const META_KEY = '@21blaze/startupDiagnosticsMeta';

export type StartupDiagnosticsMeta = {
  appVersion: string;
  buildNumber: string | null;
  expoUpdatesEnabled: boolean;
  basicModeUsed: boolean;
  recordedAtMs: number;
};

let lastStageInMemory: { stage: StartupStage; atMs: number } | null = null;
let lastMetaInMemory: StartupDiagnosticsMeta | null = null;

function readBuildNumber(): string | null {
  try {
    // Expo injects at build time when available.
    const fromEnv = process.env.EXPO_PUBLIC_IOS_BUILD_NUMBER;
    if (fromEnv && fromEnv.trim().length > 0) {
      return fromEnv.trim();
    }
  } catch {
    // ignore
  }
  return null;
}

export function recordStartupStage(stage: StartupStage): void {
  const entry = { stage, atMs: Date.now() };
  lastStageInMemory = entry;
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(entry)).catch(() => undefined);

  const meta: StartupDiagnosticsMeta = {
    appVersion: APP_VERSION,
    buildNumber: readBuildNumber(),
    expoUpdatesEnabled: isExpoUpdatesEnabled(),
    basicModeUsed: isBasicStartupModeActive(),
    recordedAtMs: Date.now(),
  };
  lastMetaInMemory = meta;
  AsyncStorage.setItem(META_KEY, JSON.stringify(meta)).catch(() => undefined);
}

export function recordStartupFailed(): void {
  recordStartupStage('startup_failed');
}

export function getLastStartupStageSync(): { stage: StartupStage; atMs: number } | null {
  return lastStageInMemory;
}

export function getStartupDiagnosticsMetaSync(): StartupDiagnosticsMeta | null {
  return lastMetaInMemory;
}

export async function getLastStartupStageAsync(): Promise<{ stage: StartupStage; atMs: number } | null> {
  if (lastStageInMemory) {
    return lastStageInMemory;
  }
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as unknown;
    if (
      parsed &&
      typeof parsed === 'object' &&
      typeof (parsed as { stage?: unknown }).stage === 'string' &&
      typeof (parsed as { atMs?: unknown }).atMs === 'number'
    ) {
      return parsed as { stage: StartupStage; atMs: number };
    }
    return null;
  } catch {
    return null;
  }
}

export function __resetStartupDiagnosticsForTests(): void {
  lastStageInMemory = null;
  lastMetaInMemory = null;
}
