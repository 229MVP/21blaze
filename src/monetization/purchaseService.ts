import type {
  CustomerEntitlements,
  PurchasePackage,
  PurchaseStatus,
  StoreOffering,
} from './types';
import {
  catalogIdToStoreProductId,
  productIdToCatalogId,
} from './productIds';
import { packageIdentifierToCatalogId } from './productIds.pure';
import { hasEntitlement, mapCustomerEntitlements } from './purchaseService.pure';
import {
  configureRevenueCat,
  getRevenueCatApiKey,
  isNativePurchasesSupported,
  wasPurchasesConfigured,
} from './revenueCatClient';

export { hasEntitlement, mapCustomerEntitlements };

export type PurchaseResult =
  | { status: Extract<PurchaseStatus, 'success'>; entitlements: CustomerEntitlements }
  | { status: Extract<PurchaseStatus, 'cancelled'> }
  | { status: Extract<PurchaseStatus, 'pending'> }
  | { status: Extract<PurchaseStatus, 'unavailable' | 'error'>; message: string };

let purchaseInFlight = false;

export async function refreshCustomerInfo(
  appUserId: string,
): Promise<CustomerEntitlements | null> {
  if (!isNativePurchasesSupported() || !getRevenueCatApiKey()) {
    return null;
  }
  const ready = await configureRevenueCat(appUserId);
  if (!ready || !wasPurchasesConfigured()) {
    return null;
  }
  try {
    const Purchases = (await import('react-native-purchases')).default;
    const info = await Purchases.getCustomerInfo();
    return mapCustomerEntitlements(Object.keys(info.entitlements.active));
  } catch {
    return null;
  }
}

export async function loadOfferings(
  appUserId: string,
): Promise<StoreOffering | null> {
  if (!isNativePurchasesSupported() || !getRevenueCatApiKey()) {
    return null;
  }
  const ready = await configureRevenueCat(appUserId);
  if (!ready) {
    return null;
  }
  try {
    const Purchases = (await import('react-native-purchases')).default;
    const offerings = await Purchases.getOfferings();
    const current = offerings.current;
    if (!current) {
      return null;
    }
    const packages: PurchasePackage[] = current.availablePackages.map((pkg) => ({
      identifier: pkg.identifier,
      productId: pkg.product.identifier,
      localizedPriceString: pkg.product.priceString,
      price: pkg.product.price,
      currencyCode: pkg.product.currencyCode,
      title: pkg.product.title,
      description: pkg.product.description,
    }));
    return { identifier: current.identifier, packages };
  } catch {
    return null;
  }
}

export async function purchaseProduct(
  appUserId: string,
  catalogProductId: string,
): Promise<PurchaseResult> {
  if (purchaseInFlight) {
    return { status: 'error', message: 'A purchase is already in progress.' };
  }
  if (!isNativePurchasesSupported()) {
    return {
      status: 'unavailable',
      message: 'In-app purchases are not available on this platform.',
    };
  }
  if (!getRevenueCatApiKey()) {
    return {
      status: 'unavailable',
      message: 'Store purchases are not configured.',
    };
  }

  const storeProductId = catalogIdToStoreProductId(catalogProductId);
  if (!storeProductId) {
    return { status: 'unavailable', message: 'Unknown product.' };
  }

  purchaseInFlight = true;
  try {
    const ready = await configureRevenueCat(appUserId);
    if (!ready) {
      return { status: 'unavailable', message: 'Unable to initialize purchases.' };
    }

    const Purchases = (await import('react-native-purchases')).default;
    const offerings = await Purchases.getOfferings();
    const pkg = offerings.current?.availablePackages.find(
      (item) =>
        item.product.identifier === storeProductId ||
        item.identifier === storeProductId ||
        item.identifier === catalogProductId ||
        packageIdentifierToCatalogId(item.identifier) === catalogProductId ||
        productIdToCatalogId(item.product.identifier) === catalogProductId,
    );
    if (!pkg) {
      return { status: 'unavailable', message: 'Product is not available.' };
    }

    const { customerInfo } = await Purchases.purchasePackage(pkg);
    return {
      status: 'success',
      entitlements: mapCustomerEntitlements(
        Object.keys(customerInfo.entitlements.active),
      ),
    };
  } catch (error: unknown) {
    const maybe = error as { userCancelled?: boolean; code?: string };
    if (maybe?.userCancelled) {
      return { status: 'cancelled' };
    }
    if (maybe?.code === 'PURCHASE_CANCELLED') {
      return { status: 'cancelled' };
    }
    if (maybe?.code === 'PAYMENT_PENDING') {
      return { status: 'pending' };
    }
    return {
      status: 'error',
      message: 'Purchase could not be completed. Please try again.',
    };
  } finally {
    purchaseInFlight = false;
  }
}

export async function restorePurchases(
  appUserId: string,
): Promise<PurchaseResult> {
  if (!isNativePurchasesSupported() || !getRevenueCatApiKey()) {
    return {
      status: 'unavailable',
      message: 'Restore is not available on this platform.',
    };
  }
  try {
    const ready = await configureRevenueCat(appUserId);
    if (!ready) {
      return { status: 'unavailable', message: 'Unable to initialize purchases.' };
    }
    const Purchases = (await import('react-native-purchases')).default;
    const info = await Purchases.restorePurchases();
    return {
      status: 'success',
      entitlements: mapCustomerEntitlements(Object.keys(info.entitlements.active)),
    };
  } catch {
    return {
      status: 'error',
      message: 'Unable to restore purchases.',
    };
  }
}

export function findPackageForCatalogId(
  offering: StoreOffering | null,
  catalogId: string,
): PurchasePackage | null {
  if (!offering) {
    return null;
  }
  const storeId = catalogIdToStoreProductId(catalogId);
  if (!storeId) {
    return null;
  }
  return (
    offering.packages.find((pkg) => pkg.productId === storeId) ??
    offering.packages.find((pkg) => pkg.identifier === storeId) ??
    offering.packages.find((pkg) => pkg.identifier === catalogId) ??
    offering.packages.find(
      (pkg) => productIdToCatalogId(pkg.productId) === catalogId,
    ) ??
    offering.packages.find(
      (pkg) => productIdToCatalogId(pkg.identifier) === catalogId,
    ) ??
    null
  );
}

export function __resetPurchaseInFlightForTests(): void {
  purchaseInFlight = false;
}
