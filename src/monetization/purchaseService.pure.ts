import type { CustomerEntitlements, EntitlementKey } from './types';
import { hasBlazeProFromActiveIds } from './proConfig';
import { isAdFreeEntitlementId } from './productIds.pure';

const KNOWN_ENTITLEMENTS: ReadonlyArray<EntitlementKey> = [
  'ad_free',
  'inferno_pack',
  'neon_pack',
  'founders_pack',
  'remove_ads',
  'cards_inferno',
  'cards_blue_flame',
  'cards_lava_gold',
  'arena_volcano',
  'arena_neon_casino',
  'founders_bundle',
  'founder_frame',
  'founder_title',
  'pro',
];

/** Pure entitlement checks — safe for Node self-tests without React Native. */
export function hasEntitlement(
  entitlements: CustomerEntitlements | null | undefined,
  key: EntitlementKey,
): boolean {
  if (!entitlements) {
    return false;
  }
  if (key === 'ad_free' || key === 'remove_ads') {
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
    if ((KNOWN_ENTITLEMENTS as readonly string[]).includes(key)) {
      known.push(key as EntitlementKey);
    }
  }

  const hasPro = hasBlazeProFromActiveIds(activeKeys) || known.includes('pro');
  if (hasPro && !known.includes('pro')) {
    known.push('pro');
  }

  const removeAds =
    hasPro ||
    activeKeys.some(isAdFreeEntitlementId) ||
    known.includes('ad_free') ||
    known.includes('remove_ads') ||
    known.includes('founders_pack') ||
    known.includes('founders_bundle');

  if (removeAds && !known.includes('ad_free')) {
    known.push('ad_free');
  }
  if (removeAds && !known.includes('remove_ads')) {
    known.push('remove_ads');
  }

  // Expand Founders Pack to the full RC entitlement set.
  if (known.includes('founders_pack') || known.includes('founders_bundle')) {
    for (const key of [
      'founders_pack',
      'ad_free',
      'remove_ads',
      'inferno_pack',
      'neon_pack',
      'cards_inferno',
      'cards_blue_flame',
      'arena_neon_casino',
      'founder_frame',
      'founder_title',
    ] as const) {
      if (!known.includes(key)) {
        known.push(key);
      }
    }
  }

  // Expand pack entitlements to legacy cosmetic entitlement keys for ownership checks.
  if (known.includes('inferno_pack') && !known.includes('cards_inferno')) {
    known.push('cards_inferno');
  }
  if (known.includes('neon_pack') && !known.includes('cards_blue_flame')) {
    known.push('cards_blue_flame');
  }
  if (known.includes('neon_pack') && !known.includes('arena_neon_casino')) {
    known.push('arena_neon_casino');
  }

  return {
    active: known,
    removeAds,
    hasPro,
    rawActiveIds: activeKeys,
  };
}
