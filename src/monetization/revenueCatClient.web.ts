/** Web stub — RevenueCat / StoreKit / Play Billing unavailable on Expo Web. */

export function isNativePurchasesSupported(): boolean {
  return false;
}

export function getRevenueCatApiKey(): string | null {
  return null;
}

export function wasPurchasesConfigured(): boolean {
  return false;
}

export function getConfiguredPurchasesUserId(): string | null {
  return null;
}

export async function configureRevenueCat(_appUserId: string): Promise<boolean> {
  return false;
}

export function __resetRevenueCatClientForTests(): void {
  // no-op
}
