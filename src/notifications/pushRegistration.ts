/**
 * Push permission + token registration facade.
 * Does not ship Expo push credentials. Uses optional expo-notifications when present;
 * otherwise documents unavailable state without inventing delivery success.
 */

import { Platform } from 'react-native';

import type { PushPermissionState, PushRegistrationState } from '../notifications/duelNotificationRegistry';
import { trackEvent } from '../monetization/analytics';
import {
  registerPushToken,
  revokePushToken,
} from '../services/duelNotificationService';

let cachedToken: string | null = null;
let registrationState: PushRegistrationState = 'idle';

export function getPushRegistrationState(): PushRegistrationState {
  return registrationState;
}

async function tryLoadExpoNotifications(): Promise<null | {
  getPermissionsAsync: () => Promise<{ status: string }>;
  requestPermissionsAsync: () => Promise<{ status: string }>;
  getExpoPushTokenAsync: (opts?: { projectId?: string }) => Promise<{ data: string }>;
}> {
  try {
    // Dynamic import keeps builds working when the optional package is absent.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('expo-notifications') as {
      getPermissionsAsync: () => Promise<{ status: string }>;
      requestPermissionsAsync: () => Promise<{ status: string }>;
      getExpoPushTokenAsync: (opts?: { projectId?: string }) => Promise<{ data: string }>;
    };
    return mod;
  } catch {
    return null;
  }
}

function mapPermission(status: string): PushPermissionState {
  if (status === 'granted') {
    return 'granted';
  }
  if (status === 'denied') {
    return 'denied';
  }
  if (status === 'provisional') {
    return 'provisional';
  }
  if (status === 'undetermined') {
    return 'undetermined';
  }
  return 'unavailable';
}

export async function getPushPermissionState(): Promise<PushPermissionState> {
  const notifications = await tryLoadExpoNotifications();
  if (!notifications) {
    return 'unavailable';
  }
  const result = await notifications.getPermissionsAsync();
  return mapPermission(result.status);
}

export async function requestPushPermissionWithContext(): Promise<PushPermissionState> {
  trackEvent('push_permission_prompt_viewed');
  const notifications = await tryLoadExpoNotifications();
  if (!notifications) {
    trackEvent('push_permission_result', { status: 'unavailable' });
    return 'unavailable';
  }
  const result = await notifications.requestPermissionsAsync();
  const mapped = mapPermission(result.status);
  trackEvent('push_permission_result', { status: mapped });
  return mapped;
}

function resolveEnvironment(): 'development' | 'preview' | 'production' {
  if (__DEV__) {
    return 'development';
  }
  const channel = process.env.EXPO_PUBLIC_APP_ENV ?? process.env.APP_ENV;
  if (channel === 'preview' || channel === 'production' || channel === 'development') {
    return channel;
  }
  return 'production';
}

export async function registerCurrentDevicePushToken(): Promise<{
  ok: boolean;
  reason?: string;
}> {
  const notifications = await tryLoadExpoNotifications();
  if (!notifications) {
    registrationState = 'error';
    return {
      ok: false,
      reason:
        'expo-notifications is not installed. Add the package and configure Expo push credentials to enable delivery.',
    };
  }

  const permission = await getPushPermissionState();
  if (permission !== 'granted' && permission !== 'provisional') {
    return { ok: false, reason: 'permission_not_granted' };
  }

  registrationState = 'registering';
  try {
    const projectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
    const tokenResult = await notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    const token = tokenResult.data;
    if (!token || token.length < 16) {
      registrationState = 'error';
      return { ok: false, reason: 'invalid_token' };
    }

    const platform =
      Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web';

    await registerPushToken({
      token,
      platform,
      appEnvironment: resolveEnvironment(),
    });
    cachedToken = token;
    registrationState = 'registered';
    return { ok: true };
  } catch {
    registrationState = 'error';
    return { ok: false, reason: 'registration_failed' };
  }
}

export async function revokeCurrentDevicePushToken(): Promise<void> {
  if (!cachedToken) {
    registrationState = 'revoked';
    return;
  }
  try {
    await revokePushToken(cachedToken);
  } catch {
    // Best-effort on logout.
  }
  cachedToken = null;
  registrationState = 'revoked';
}
