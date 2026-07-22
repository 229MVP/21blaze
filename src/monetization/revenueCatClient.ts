import { Platform } from 'react-native';

function readEnv(name: string): string {
  const value = process.env[name];
  return typeof value === 'string' ? value.trim() : '';
}

export function isNativePurchasesSupported(): boolean {
  return Platform.OS === 'ios' || Platform.OS === 'android';
}

export function getRevenueCatApiKey(): string | null {
  if (!isNativePurchasesSupported()) {
    return null;
  }
  if (Platform.OS === 'ios') {
    const key = readEnv('EXPO_PUBLIC_REVENUECAT_IOS_API_KEY');
    return key.length > 0 ? key : null;
  }
  const key = readEnv('EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY');
  return key.length > 0 ? key : null;
}

let configured = false;
let configuredUserId: string | null = null;

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

  const apiKey = getRevenueCatApiKey();
  if (!apiKey) {
    return false;
  }

  try {
    const Purchases = (await import('react-native-purchases')).default;
    Purchases.setLogLevel(
      __DEV__
        ? (await import('react-native-purchases')).LOG_LEVEL.DEBUG
        : (await import('react-native-purchases')).LOG_LEVEL.WARN,
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
  }
}

/** Test helper — resets module configure state. */
export function __resetRevenueCatClientForTests(): void {
  configured = false;
  configuredUserId = null;
}
