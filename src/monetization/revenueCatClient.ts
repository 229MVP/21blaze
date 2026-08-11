import { Platform } from 'react-native';

import {
  getAppEnv,
  isProductionBuild,
  isStorePurchasesEnabled,
} from '../config/featureFlags';
import { readPublicEnv } from '../config/publicEnv';

function isTestStoreApiKey(key: string): boolean {
  return key.startsWith('test_');
}

export function isNativePurchasesSupported(): boolean {
  return Platform.OS === 'ios' || Platform.OS === 'android';
}

/**
 * Public SDK keys only.
 *
 * Development / preview physical builds: prefer EXPO_PUBLIC_REVENUECAT_API_KEY
 * (RevenueCat Test Store `test_…` key).
 *
 * Production: prefer platform-specific keys and never accept a Test Store key.
 */
export function getRevenueCatApiKey(): string | null {
  if (!isNativePurchasesSupported()) {
    return null;
  }

  const shared = readPublicEnv('EXPO_PUBLIC_REVENUECAT_API_KEY');
  const platformKey =
    Platform.OS === 'ios'
      ? readPublicEnv('EXPO_PUBLIC_REVENUECAT_IOS_API_KEY')
      : readPublicEnv('EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY');

  if (isProductionBuild()) {
    if (platformKey.length > 0 && !isTestStoreApiKey(platformKey)) {
      return platformKey;
    }
    if (shared.length > 0 && !isTestStoreApiKey(shared)) {
      return shared;
    }
    return null;
  }

  // development | preview | unknown/__DEV__: Test Store first, then platform.
  if (shared.length > 0) {
    return shared;
  }
  if (platformKey.length > 0) {
    return platformKey;
  }
  return null;
}

/** True when the resolved public key is a RevenueCat Test Store key. */
export function isUsingRevenueCatTestStore(): boolean {
  const key = getRevenueCatApiKey();
  return Boolean(key && isTestStoreApiKey(key));
}

let configured = false;
let configuredUserId: string | null = null;
let configureInFlight: Promise<boolean> | null = null;

export function wasPurchasesConfigured(): boolean {
  return configured;
}

export function getConfiguredPurchasesUserId(): string | null {
  return configuredUserId;
}

/**
 * Configure RevenueCat exactly once per process. No-ops on web / missing keys.
 * Uses the Supabase auth user id as the RevenueCat app user id.
 *
 * This is the single choke point for `Purchases.configure` — every purchase
 * flow (offerings, purchase, restore, paywall, customer center) routes
 * through here, so gating on `isStorePurchasesEnabled()` here guarantees
 * RevenueCat is never initialized while purchases are intentionally
 * disabled (ads-first releases).
 */
export async function configureRevenueCat(appUserId: string): Promise<boolean> {
  if (!isStorePurchasesEnabled()) {
    return false;
  }
  if (!isNativePurchasesSupported()) {
    return false;
  }
  if (!appUserId) {
    return false;
  }
  if (configured && configuredUserId === appUserId) {
    return true;
  }
  if (configureInFlight) {
    return configureInFlight;
  }

  configureInFlight = (async () => {
    const apiKey = getRevenueCatApiKey();
    if (!apiKey) {
      return false;
    }

    // Hard stop: never configure Test Store keys into production binaries.
    if (isProductionBuild() && isTestStoreApiKey(apiKey)) {
      return false;
    }

    try {
      const PurchasesModule = await import('react-native-purchases');
      const Purchases = PurchasesModule.default;
      const verboseLogs =
        !isProductionBuild() &&
        (getAppEnv() === 'development' ||
          (typeof __DEV__ !== 'undefined' && __DEV__));
      Purchases.setLogLevel(
        verboseLogs
          ? PurchasesModule.LOG_LEVEL.DEBUG
          : PurchasesModule.LOG_LEVEL.WARN,
      );

      if (!configured) {
        Purchases.configure({ apiKey, appUserID: appUserId });
        configured = true;
        configuredUserId = appUserId;
        return true;
      }

      if (configuredUserId !== appUserId) {
        await Purchases.logIn(appUserId);
        configuredUserId = appUserId;
      }
      return true;
    } catch {
      return false;
    } finally {
      configureInFlight = null;
    }
  })();

  return configureInFlight;
}

/** Test helper — resets module configure state. */
export function __resetRevenueCatClientForTests(): void {
  configured = false;
  configuredUserId = null;
  configureInFlight = null;
}
