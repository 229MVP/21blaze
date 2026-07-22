import type { createServiceClient } from './supabaseAdmin.ts';

export type AdminClient = ReturnType<typeof createServiceClient>;

export type CosmeticUnlock = {
  key: string;
  category: string;
};

/** Store product ids (iOS + Android) → entitlement keys granted by that SKU. */
export const PRODUCT_ID_TO_ENTITLEMENTS: Record<string, readonly string[]> = {
  // iOS
  'com.twentyoneblaze.remove_ads': ['remove_ads'],
  'com.twentyoneblaze.cards.inferno': ['cards_inferno'],
  'com.twentyoneblaze.cards.blue_flame': ['cards_blue_flame'],
  'com.twentyoneblaze.cards.lava_gold': ['cards_lava_gold'],
  'com.twentyoneblaze.arena.volcano': ['arena_volcano'],
  'com.twentyoneblaze.arena.neon_casino': ['arena_neon_casino'],
  'com.twentyoneblaze.bundle.founders': [
    'founders_bundle',
    'remove_ads',
    'cards_inferno',
    'arena_volcano',
    'founder_frame',
    'founder_title',
  ],
  // Android
  remove_ads: ['remove_ads'],
  cards_inferno: ['cards_inferno'],
  cards_blue_flame: ['cards_blue_flame'],
  cards_lava_gold: ['cards_lava_gold'],
  arena_volcano: ['arena_volcano'],
  arena_neon_casino: ['arena_neon_casino'],
  bundle_founders: [
    'founders_bundle',
    'remove_ads',
    'cards_inferno',
    'arena_volcano',
    'founder_frame',
    'founder_title',
  ],
  founders_bundle: [
    'founders_bundle',
    'remove_ads',
    'cards_inferno',
    'arena_volcano',
    'founder_frame',
    'founder_title',
  ],
};

/** Entitlement key → cosmetic unlocked when that entitlement is active. */
export const ENTITLEMENT_TO_COSMETIC: Record<string, CosmeticUnlock> = {
  cards_inferno: { key: 'inferno_cards', category: 'card_theme' },
  cards_blue_flame: { key: 'blue_flame_cards', category: 'card_theme' },
  cards_lava_gold: { key: 'lava_gold_cards', category: 'card_theme' },
  arena_volcano: { key: 'volcano_arena', category: 'arena' },
  arena_neon_casino: { key: 'neon_casino_arena', category: 'arena' },
  founder_frame: { key: 'founder_frame', category: 'profile_frame' },
  founder_title: { key: 'founder_title', category: 'title' },
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

export function resolveEntitlementKeys(
  productId: string | null | undefined,
  entitlementIds: string[] | null | undefined,
): string[] {
  const keys = new Set<string>();

  if (productId && PRODUCT_ID_TO_ENTITLEMENTS[productId]) {
    for (const key of PRODUCT_ID_TO_ENTITLEMENTS[productId]) {
      keys.add(key);
    }
  }

  if (Array.isArray(entitlementIds)) {
    for (const raw of entitlementIds) {
      if (typeof raw !== 'string' || raw.length === 0) {
        continue;
      }
      if (PRODUCT_ID_TO_ENTITLEMENTS[raw]) {
        for (const key of PRODUCT_ID_TO_ENTITLEMENTS[raw]) {
          keys.add(key);
        }
      } else {
        keys.add(raw);
      }
    }
  }

  return Array.from(keys);
}

export function includesFoundersBenefits(keys: readonly string[]): boolean {
  if (keys.includes('founders_bundle')) {
    return true;
  }
  return (
    keys.includes('remove_ads') &&
    keys.includes('cards_inferno') &&
    keys.includes('arena_volcano')
  );
}

export async function unlockCosmeticsForEntitlements(
  admin: AdminClient,
  userId: string,
  entitlementKeys: readonly string[],
): Promise<void> {
  for (const entitlementKey of entitlementKeys) {
    const cosmetic = ENTITLEMENT_TO_COSMETIC[entitlementKey];
    if (!cosmetic) {
      continue;
    }
    await admin.rpc('unlock_cosmetic', {
      p_user_id: userId,
      p_cosmetic_key: cosmetic.key,
      p_category: cosmetic.category,
      p_source: 'revenuecat',
    });
  }
}

export async function grantEntitlementKeys(
  admin: AdminClient,
  userId: string,
  entitlementKeys: readonly string[],
  productId: string | null,
): Promise<void> {
  for (const key of entitlementKeys) {
    await admin.rpc('grant_entitlement', {
      p_user_id: userId,
      p_key: key,
      p_source: 'revenuecat',
      p_product_id: productId,
      p_metadata: {},
    });
  }
}

export async function revokeEntitlementKeys(
  admin: AdminClient,
  userId: string,
  entitlementKeys: readonly string[],
  reason: string,
): Promise<void> {
  for (const key of entitlementKeys) {
    const { error } = await admin.rpc('revoke_entitlement', {
      p_user_id: userId,
      p_key: key,
      p_reason: reason,
    });
    // Missing entitlement rows should not fail the whole webhook.
    if (error) {
      continue;
    }
  }
}

export function walletBalance(row: { blaze_coins?: unknown } | null): number {
  if (!row || row.blaze_coins == null) {
    return 0;
  }
  return Number(row.blaze_coins);
}
