/**
 * 21 Blaze Pro subscription entitlement + product identifiers.
 *
 * Dashboard setup (RevenueCat):
 * 1. Create entitlement identifier: "21 Blaze Pro"
 * 2. Attach products: lifetime, yearly, monthly
 * 3. Add packages to the current Offering with identifiers:
 *    lifetime | yearly | monthly
 *    (also accepts $rc_lifetime, $rc_annual, $rc_monthly)
 * 4. Attach a Paywall to the current Offering
 * 5. Enable Customer Center in the dashboard
 */

/** Primary entitlement id as configured in RevenueCat. */
export const BLAZE_PRO_ENTITLEMENT_ID = '21 Blaze Pro';

/** Accepted aliases if the dashboard id differs slightly. */
export const BLAZE_PRO_ENTITLEMENT_ALIASES = [
  '21 Blaze Pro',
  '21_blaze_pro',
  'pro',
] as const;

export const PRO_PRODUCT_IDS = {
  lifetime: 'lifetime',
  yearly: 'yearly',
  monthly: 'monthly',
} as const;

export type ProProductId = (typeof PRO_PRODUCT_IDS)[keyof typeof PRO_PRODUCT_IDS];

export const PRO_PACKAGE_IDENTIFIERS = [
  'lifetime',
  'yearly',
  'monthly',
  '$rc_lifetime',
  '$rc_annual',
  '$rc_monthly',
] as const;

export function isBlazeProEntitlementId(value: string): boolean {
  return (BLAZE_PRO_ENTITLEMENT_ALIASES as readonly string[]).includes(value);
}

export function hasBlazeProFromActiveIds(
  activeEntitlementIds: ReadonlyArray<string>,
): boolean {
  return activeEntitlementIds.some(isBlazeProEntitlementId);
}

export function isProProductId(value: string): value is ProProductId {
  return (
    value === PRO_PRODUCT_IDS.lifetime ||
    value === PRO_PRODUCT_IDS.yearly ||
    value === PRO_PRODUCT_IDS.monthly
  );
}

export function packageIdentifierToProProductId(
  packageIdentifier: string,
  storeProductId: string,
): ProProductId | null {
  const id = packageIdentifier.toLowerCase();
  const product = storeProductId.toLowerCase();

  if (
    id === 'lifetime' ||
    id === '$rc_lifetime' ||
    product === 'lifetime' ||
    product.includes('lifetime')
  ) {
    return 'lifetime';
  }
  if (
    id === 'yearly' ||
    id === 'annual' ||
    id === '$rc_annual' ||
    product === 'yearly' ||
    product.includes('yearly') ||
    product.includes('annual')
  ) {
    return 'yearly';
  }
  if (
    id === 'monthly' ||
    id === '$rc_monthly' ||
    product === 'monthly' ||
    product.includes('monthly')
  ) {
    return 'monthly';
  }
  return null;
}
