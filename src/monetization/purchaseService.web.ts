import type {
  CustomerEntitlements,
  EntitlementKey,
  PurchasePackage,
  PurchaseStatus,
  StoreOffering,
} from './types';
import { hasEntitlement } from './purchaseService.pure';
import { productIdToCatalogId } from './productIds.pure';

export { hasEntitlement };

export type PurchaseResult =
  | { status: Extract<PurchaseStatus, 'success'>; entitlements: CustomerEntitlements }
  | { status: Extract<PurchaseStatus, 'cancelled'> }
  | { status: Extract<PurchaseStatus, 'pending'> }
  | { status: Extract<PurchaseStatus, 'unavailable' | 'error'>; message: string };

const WEB_UNAVAILABLE =
  'Mobile purchases require the iOS or Android app. Web cannot complete store purchases.';

export async function refreshCustomerInfo(
  _appUserId: string,
): Promise<CustomerEntitlements | null> {
  return null;
}

export async function loadOfferings(_appUserId: string): Promise<StoreOffering | null> {
  return null;
}

export async function purchaseProduct(
  _appUserId: string,
  _catalogProductId: string,
): Promise<PurchaseResult> {
  return { status: 'unavailable', message: WEB_UNAVAILABLE };
}

export async function restorePurchases(
  _appUserId: string,
): Promise<PurchaseResult> {
  return { status: 'unavailable', message: WEB_UNAVAILABLE };
}

export function findPackageForCatalogId(
  offering: StoreOffering | null,
  catalogId: string,
): PurchasePackage | null {
  // Web never loads native offerings; keep signature parity with native.
  if (!offering) {
    return null;
  }
  return (
    offering.packages.find(
      (pkg) => productIdToCatalogId(pkg.productId) === catalogId,
    ) ??
    offering.packages.find((pkg) => pkg.identifier === catalogId) ??
    null
  );
}

export function __resetPurchaseInFlightForTests(): void {
  // no-op
}

// Keep EntitlementKey referenced for type-parity with native module consumers.
export type { EntitlementKey };
