import type { CustomerEntitlements, PurchaseStatus } from './types';
import { mapCustomerEntitlements } from './purchaseService.pure';
import {
  BLAZE_PRO_ENTITLEMENT_ID,
  hasBlazeProFromActiveIds,
} from './proConfig';
import {
  configureRevenueCat,
  getRevenueCatApiKey,
  isNativePurchasesSupported,
  wasPurchasesConfigured,
} from './revenueCatClient';
import { trackEvent } from './analytics';

export type PaywallPresentationResult = {
  status: Extract<
    PurchaseStatus,
    'success' | 'cancelled' | 'unavailable' | 'error'
  >;
  purchasedOrRestored: boolean;
  entitlements: CustomerEntitlements | null;
  message?: string;
};

async function refreshMappedEntitlements(): Promise<CustomerEntitlements | null> {
  try {
    const Purchases = (await import('react-native-purchases')).default;
    const info = await Purchases.getCustomerInfo();
    return mapCustomerEntitlements(Object.keys(info.entitlements.active));
  } catch {
    return null;
  }
}

/**
 * Present the RevenueCat Paywall for the current offering.
 * Requires a Paywall attached to the offering in the RevenueCat dashboard.
 */
export async function presentBlazeProPaywall(
  appUserId: string,
): Promise<PaywallPresentationResult> {
  if (!isNativePurchasesSupported() || !getRevenueCatApiKey()) {
    return {
      status: 'unavailable',
      purchasedOrRestored: false,
      entitlements: null,
      message:
        'Paywalls require a native development build with RevenueCat configured.',
    };
  }

  const ready = await configureRevenueCat(appUserId);
  if (!ready || !wasPurchasesConfigured()) {
    return {
      status: 'unavailable',
      purchasedOrRestored: false,
      entitlements: null,
      message: 'Unable to initialize purchases.',
    };
  }

  trackEvent('purchase_started', { source: 'paywall' });

  try {
    const RevenueCatUI = (await import('react-native-purchases-ui')).default;
    const { PAYWALL_RESULT } = await import('react-native-purchases-ui');
    const result = await RevenueCatUI.presentPaywall({
      displayCloseButton: true,
    });

    if (
      result === PAYWALL_RESULT.PURCHASED ||
      result === PAYWALL_RESULT.RESTORED
    ) {
      const entitlements = await refreshMappedEntitlements();
      trackEvent('purchase_completed', { source: 'paywall' });
      return {
        status: 'success',
        purchasedOrRestored: true,
        entitlements,
      };
    }

    if (result === PAYWALL_RESULT.CANCELLED) {
      trackEvent('purchase_cancelled', { source: 'paywall' });
      return {
        status: 'cancelled',
        purchasedOrRestored: false,
        entitlements: null,
      };
    }

    if (result === PAYWALL_RESULT.NOT_PRESENTED) {
      return {
        status: 'unavailable',
        purchasedOrRestored: false,
        entitlements: null,
        message:
          'Paywall was not presented. Attach a Paywall to your current Offering in RevenueCat.',
      };
    }

    trackEvent('purchase_failed', { source: 'paywall' });
    return {
      status: 'error',
      purchasedOrRestored: false,
      entitlements: null,
      message: 'Paywall could not complete the purchase.',
    };
  } catch {
    trackEvent('purchase_failed', { source: 'paywall' });
    return {
      status: 'error',
      purchasedOrRestored: false,
      entitlements: null,
      message: 'Unable to present the paywall.',
    };
  }
}

/**
 * Present paywall only when the player does not already have 21 Blaze Pro.
 */
export async function presentBlazeProPaywallIfNeeded(
  appUserId: string,
): Promise<PaywallPresentationResult> {
  if (!isNativePurchasesSupported() || !getRevenueCatApiKey()) {
    return {
      status: 'unavailable',
      purchasedOrRestored: false,
      entitlements: null,
      message:
        'Paywalls require a native development build with RevenueCat configured.',
    };
  }

  const ready = await configureRevenueCat(appUserId);
  if (!ready) {
    return {
      status: 'unavailable',
      purchasedOrRestored: false,
      entitlements: null,
      message: 'Unable to initialize purchases.',
    };
  }

  try {
    // Short-circuit if already entitled (handles alias entitlement ids).
    const existing = await refreshMappedEntitlements();
    if (existing?.hasPro || hasBlazeProFromActiveIds(existing?.rawActiveIds ?? [])) {
      return {
        status: 'success',
        purchasedOrRestored: false,
        entitlements: existing,
        message: 'Already subscribed to 21 Blaze Pro.',
      };
    }

    const RevenueCatUI = (await import('react-native-purchases-ui')).default;
    const { PAYWALL_RESULT } = await import('react-native-purchases-ui');
    const result = await RevenueCatUI.presentPaywallIfNeeded({
      requiredEntitlementIdentifier: BLAZE_PRO_ENTITLEMENT_ID,
      displayCloseButton: true,
    });

    if (
      result === PAYWALL_RESULT.PURCHASED ||
      result === PAYWALL_RESULT.RESTORED
    ) {
      return {
        status: 'success',
        purchasedOrRestored: true,
        entitlements: await refreshMappedEntitlements(),
      };
    }

    if (result === PAYWALL_RESULT.NOT_PRESENTED) {
      return {
        status: 'success',
        purchasedOrRestored: false,
        entitlements: await refreshMappedEntitlements(),
        message: 'Already subscribed to 21 Blaze Pro.',
      };
    }

    if (result === PAYWALL_RESULT.CANCELLED) {
      return {
        status: 'cancelled',
        purchasedOrRestored: false,
        entitlements: null,
      };
    }

    return {
      status: 'error',
      purchasedOrRestored: false,
      entitlements: null,
      message: 'Paywall could not complete.',
    };
  } catch {
    return {
      status: 'error',
      purchasedOrRestored: false,
      entitlements: null,
      message: 'Unable to present the paywall.',
    };
  }
}
