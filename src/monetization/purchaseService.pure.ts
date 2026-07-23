import type { CustomerEntitlements, EntitlementKey } from './types';
import { hasBlazeProFromActiveIds } from './proConfig';

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
  if (key === 'pro') {
    return entitlements.hasPro;
  }
  return entitlements.active.includes(key);
}

export function mapCustomerEntitlements(
  activeKeys: ReadonlyArray<string>,
): CustomerEntitlements {
  const known: EntitlementKey[] = [];
  for (const key of activeKeys) {
    if (
      key === 'remove_ads' ||
      key === 'cards_inferno' ||
      key === 'cards_blue_flame' ||
      key === 'cards_lava_gold' ||
      key === 'arena_volcano' ||
      key === 'arena_neon_casino' ||
      key === 'founders_bundle' ||
      key === 'founder_frame' ||
      key === 'founder_title' ||
      key === 'pro'
    ) {
      known.push(key);
    }
  }

  const hasPro = hasBlazeProFromActiveIds(activeKeys) || known.includes('pro');
  if (hasPro && !known.includes('pro')) {
    known.push('pro');
  }

  return {
    active: known,
    removeAds:
      hasPro ||
      known.includes('remove_ads') ||
      known.includes('founders_bundle'),
    hasPro,
    rawActiveIds: activeKeys,
  };
}
