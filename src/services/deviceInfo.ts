import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { APP_VERSION } from '../game/constants';

/**
 * Version 1.1C — safe, non-identifying device/app info for the TestFlight
 * feedback route. Never includes access tokens, raw user IDs, or private
 * match logs.
 */
export function getAppVersion(): string {
  return Constants.expoConfig?.version ?? Constants.nativeApplicationVersion ?? APP_VERSION;
}

export function getBuildNumber(): string {
  return (
    Constants.nativeBuildVersion ??
    (Platform.OS === 'ios'
      ? String(Constants.expoConfig?.ios?.buildNumber ?? 'unknown')
      : String(Constants.expoConfig?.android?.versionCode ?? 'unknown'))
  );
}

export function getRuntimeEnvironment(): string {
  return (process.env.EXPO_PUBLIC_APP_ENV ?? 'unknown').trim() || 'unknown';
}

export function getPlatformSummary(): string {
  return `${Platform.OS} ${Platform.Version ?? ''}`.trim();
}

export type AnonymizedDiagnostics = {
  appVersion: string;
  buildNumber: string;
  platform: string;
  environment: string;
};

export function getAnonymizedDiagnostics(): AnonymizedDiagnostics {
  return {
    appVersion: getAppVersion(),
    buildNumber: getBuildNumber(),
    platform: getPlatformSummary(),
    environment: getRuntimeEnvironment(),
  };
}

export function formatDiagnosticsForClipboard(diagnostics: AnonymizedDiagnostics): string {
  return [
    `21 Blaze v${diagnostics.appVersion} (build ${diagnostics.buildNumber})`,
    `Platform: ${diagnostics.platform}`,
    `Environment: ${diagnostics.environment}`,
  ].join('\n');
}
