import type { CustomerEntitlements, EntitlementKey } from './types';

/** Pure entitlement checks — safe for Node self-tests without React Native. */
export function hasEntitlement(
  entitlements: CustomerEntitlements | null | undefined,
  key: EntitlementKey,
): boolean {
  if (!entitlements) {
    return false;
  }
  if (key === 'remove_ads') {
    return entitlements.removeAds;
  }
  return entitlements.active.includes(key);
}
