import type { CustomerEntitlements, PurchaseStatus } from './types';

export type PaywallPresentationResult = {
  status: Extract<
    PurchaseStatus,
    'success' | 'cancelled' | 'unavailable' | 'error'
  >;
  purchasedOrRestored: boolean;
  entitlements: CustomerEntitlements | null;
  message?: string;
};

const WEB_MESSAGE =
  'Paywalls require a native development build. Unavailable on Expo Web.';

export async function presentBlazeProPaywall(
  _appUserId: string,
): Promise<PaywallPresentationResult> {
  return {
    status: 'unavailable',
    purchasedOrRestored: false,
    entitlements: null,
    message: WEB_MESSAGE,
  };
}

export async function presentBlazeProPaywallIfNeeded(
  _appUserId: string,
): Promise<PaywallPresentationResult> {
  return {
    status: 'unavailable',
    purchasedOrRestored: false,
    entitlements: null,
    message: WEB_MESSAGE,
  };
}
