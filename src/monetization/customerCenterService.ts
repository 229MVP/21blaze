import {
  configureRevenueCat,
  getRevenueCatApiKey,
  isNativePurchasesSupported,
} from './revenueCatClient';
import { trackEvent } from './analytics';

export type CustomerCenterResult =
  | { status: 'opened' }
  | { status: 'unavailable'; message: string }
  | { status: 'error'; message: string };

/**
 * Present RevenueCat Customer Center for subscription management,
 * restores, and support paths configured in the dashboard.
 */
export async function presentCustomerCenter(
  appUserId: string,
): Promise<CustomerCenterResult> {
  if (!isNativePurchasesSupported() || !getRevenueCatApiKey()) {
    return {
      status: 'unavailable',
      message:
        'Customer Center requires a native development build with RevenueCat configured.',
    };
  }

  const ready = await configureRevenueCat(appUserId);
  if (!ready) {
    return {
      status: 'unavailable',
      message: 'Unable to initialize purchases.',
    };
  }

  try {
    const RevenueCatUI = (await import('react-native-purchases-ui')).default;
    await RevenueCatUI.presentCustomerCenter({
      callbacks: {
        onRestoreStarted: () => {
          trackEvent('restore_started', { source: 'customer_center' });
        },
        onRestoreCompleted: () => {
          trackEvent('restore_completed', { source: 'customer_center' });
        },
        onRestoreFailed: () => {
          trackEvent('restore_failed', { source: 'customer_center' });
        },
      },
    });
    return { status: 'opened' };
  } catch {
    return {
      status: 'error',
      message: 'Unable to open Customer Center.',
    };
  }
}
