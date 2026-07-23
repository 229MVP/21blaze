import { Platform } from 'react-native';

function readEnv(name: string): string {
  const value = process.env[name];
  return typeof value === 'string' ? value.trim() : '';
}

export function isNativePurchasesSupported(): boolean {
  return Platform.OS === 'ios' || Platform.OS === 'android';
}

/**
 * Public SDK keys only. Prefer platform-specific keys; fall back to shared
 * EXPO_PUBLIC_REVENUECAT_API_KEY (RevenueCat Test Store uses a single test_ key).
 */
export function getRevenueCatApiKey(): string | null {
  if (!isNativePurchasesSupported()) {
    return null;
  }

  const shared = readEnv('EXPO_PUBLIC_REVENUECAT_API_KEY');
  if (Platform.OS === 'ios') {
    const ios = readEnv('EXPO_PUBLIC_REVENUECAT_IOS_API_KEY');
    const key = ios || shared;
    return key.length > 0 ? key : null;
  }

  const android = readEnv('EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY');
  const key = android || shared;
  return key.length > 0 ? key : null;
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
 */
export async function configureRevenueCat(appUserId: string): Promise<boolean> {
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

    try {
      const PurchasesModule = await import('react-native-purchases');
      const Purchases = PurchasesModule.default;
      Purchases.setLogLevel(
        __DEV__ ? PurchasesModule.LOG_LEVEL.DEBUG : PurchasesModule.LOG_LEVEL.WARN,
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
