import type { EntitlementKey, PurchasableProduct } from './types';

/**
 * Production RC 0.9.0 store catalog identifiers.
 * Legacy SKUs remain mapped for restore/webhook compatibility.
 */
export const RC_PRODUCTS = {
  adFree: 'blaze_ad_free',
  infernoPack: 'blaze_inferno_pack',
  neonPack: 'blaze_neon_pack',
  foundersPack: 'blaze_founders_pack',
} as const;

export const RC_PACKAGE_IDS = {
  adFree: 'ad_free',
  inferno: 'inferno',
  neon: 'neon',
  founders: 'founders',
} as const;

export const RC_OFFERING_ID = 'default';

/** Primary + legacy store product identifiers (iOS App Store Connect style). */
export const IOS_PRODUCTS = {
  adFree: 'blaze_ad_free',
  infernoPack: 'blaze_inferno_pack',
  neonPack: 'blaze_neon_pack',
  foundersPack: 'blaze_founders_pack',
  // Legacy
  removeAds: 'com.twentyoneblaze.remove_ads',
  cardsInferno: 'com.twentyoneblaze.cards.inferno',
  cardsBlueFlame: 'com.twentyoneblaze.cards.blue_flame',
  cardsLavaGold: 'com.twentyoneblaze.cards.lava_gold',
  arenaVolcano: 'com.twentyoneblaze.arena.volcano',
  arenaNeonCasino: 'com.twentyoneblaze.arena.neon_casino',
  foundersBundle: 'com.twentyoneblaze.bundle.founders',
  proLifetime: 'lifetime',
  proYearly: 'yearly',
  proMonthly: 'monthly',
} as const;

export const ANDROID_PRODUCTS = {
  adFree: 'blaze_ad_free',
  infernoPack: 'blaze_inferno_pack',
  neonPack: 'blaze_neon_pack',
  foundersPack: 'blaze_founders_pack',
  // Legacy
  removeAds: 'remove_ads',
  cardsInferno: 'cards_inferno',
  cardsBlueFlame: 'cards_blue_flame',
  cardsLavaGold: 'cards_lava_gold',
  arenaVolcano: 'arena_volcano',
  arenaNeonCasino: 'arena_neon_casino',
  foundersBundle: 'bundle_founders',
  proLifetime: 'lifetime',
  proYearly: 'yearly',
  proMonthly: 'monthly',
} as const;

export const ENTITLEMENT_KEYS = {
  adFree: 'ad_free',
  infernoPack: 'inferno_pack',
  neonPack: 'neon_pack',
  foundersPack: 'founders_pack',
  // Legacy aliases kept for active customer restores
  removeAds: 'remove_ads',
  cardsInferno: 'cards_inferno',
  cardsBlueFlame: 'cards_blue_flame',
  cardsLavaGold: 'cards_lava_gold',
  arenaVolcano: 'arena_volcano',
  arenaNeonCasino: 'arena_neon_casino',
  foundersBundle: 'founders_bundle',
  founderFrame: 'founder_frame',
  founderTitle: 'founder_title',
  pro: 'pro',
} as const satisfies Record<string, EntitlementKey>;

export const STORE_PRODUCTS: readonly PurchasableProduct[] = [
  {
    id: 'blaze_ad_free',
    entitlementKey: 'ad_free',
    category: 'remove_ads',
    displayName: 'Remove Ads',
    description:
      'Removes interstitial ads. Optional rewarded ads you choose to watch still remain available.',
    includedEntitlements: ['ad_free', 'remove_ads'],
    includedCosmetics: [],
  },
  {
    id: 'blaze_inferno_pack',
    entitlementKey: 'inferno_pack',
    category: 'card_theme',
    displayName: 'Inferno Pack',
    description: 'Inferno card cosmetics. Does not change gameplay.',
    includedEntitlements: ['inferno_pack', 'cards_inferno'],
    includedCosmetics: ['inferno_cards'],
  },
  {
    id: 'blaze_neon_pack',
    entitlementKey: 'neon_pack',
    category: 'card_theme',
    displayName: 'Neon Pack',
    description: 'Neon card and arena cosmetics. Purely visual.',
    includedEntitlements: ['neon_pack', 'cards_blue_flame', 'arena_neon_casino'],
    includedCosmetics: ['blue_flame_cards', 'neon_casino_arena'],
  },
  {
    id: 'blaze_founders_pack',
    entitlementKey: 'founders_pack',
    category: 'bundle',
    displayName: 'Founders Pack',
    description:
      'Includes Ad-Free, Inferno Pack, Neon Pack, Founder frame, Founder title, and a one-time 2,500 Blaze Coin grant.',
    includedEntitlements: [
      'founders_pack',
      'ad_free',
      'inferno_pack',
      'neon_pack',
      'remove_ads',
      'cards_inferno',
      'cards_blue_flame',
      'arena_neon_casino',
      'founder_frame',
      'founder_title',
    ],
    includedCosmetics: [
      'inferno_cards',
      'blue_flame_cards',
      'neon_casino_arena',
      'founder_frame',
      'founder_title',
    ],
  },
] as const;

export function productIdToCatalogId(productId: string): string | null {
  const map: Record<string, string> = {
    [RC_PRODUCTS.adFree]: 'blaze_ad_free',
    [RC_PRODUCTS.infernoPack]: 'blaze_inferno_pack',
    [RC_PRODUCTS.neonPack]: 'blaze_neon_pack',
    [RC_PRODUCTS.foundersPack]: 'blaze_founders_pack',
    [IOS_PRODUCTS.removeAds]: 'blaze_ad_free',
    [ANDROID_PRODUCTS.removeAds]: 'blaze_ad_free',
    [IOS_PRODUCTS.cardsInferno]: 'blaze_inferno_pack',
    [ANDROID_PRODUCTS.cardsInferno]: 'blaze_inferno_pack',
    [IOS_PRODUCTS.cardsBlueFlame]: 'blaze_neon_pack',
    [ANDROID_PRODUCTS.cardsBlueFlame]: 'blaze_neon_pack',
    [IOS_PRODUCTS.arenaNeonCasino]: 'blaze_neon_pack',
    [ANDROID_PRODUCTS.arenaNeonCasino]: 'blaze_neon_pack',
    [IOS_PRODUCTS.foundersBundle]: 'blaze_founders_pack',
    [ANDROID_PRODUCTS.foundersBundle]: 'blaze_founders_pack',
    lifetime: 'pro_lifetime',
    yearly: 'pro_yearly',
    monthly: 'pro_monthly',
  };
  return map[productId] ?? null;
}

export function catalogIdToStoreProductIdForPlatform(
  catalogId: string,
  _platform: 'ios' | 'android',
): string | null {
  switch (catalogId) {
    case 'blaze_ad_free':
    case 'remove_ads':
      return RC_PRODUCTS.adFree;
    case 'blaze_inferno_pack':
    case 'cards_inferno':
      return RC_PRODUCTS.infernoPack;
    case 'blaze_neon_pack':
    case 'cards_blue_flame':
    case 'arena_neon_casino':
      return RC_PRODUCTS.neonPack;
    case 'blaze_founders_pack':
    case 'bundle_founders':
      return RC_PRODUCTS.foundersPack;
    case 'pro_lifetime':
      return 'lifetime';
    case 'pro_yearly':
      return 'yearly';
    case 'pro_monthly':
      return 'monthly';
    default:
      return null;
  }
}

export function packageIdentifierToCatalogId(
  packageIdentifier: string,
): string | null {
  switch (packageIdentifier) {
    case RC_PACKAGE_IDS.adFree:
    case '$rc_lifetime': // ignore — not used for packs
      return packageIdentifier === RC_PACKAGE_IDS.adFree
        ? 'blaze_ad_free'
        : null;
    case RC_PACKAGE_IDS.inferno:
      return 'blaze_inferno_pack';
    case RC_PACKAGE_IDS.neon:
      return 'blaze_neon_pack';
    case RC_PACKAGE_IDS.founders:
      return 'blaze_founders_pack';
    default:
      return null;
  }
}

export function isEntitlementKey(value: string): value is EntitlementKey {
  return (Object.values(ENTITLEMENT_KEYS) as string[]).includes(value);
}

export function isAdFreeEntitlementId(value: string): boolean {
  return (
    value === 'ad_free' ||
    value === 'remove_ads' ||
    value === 'founders_pack' ||
    value === 'founders_bundle' ||
    value === 'pro' ||
    value === '21 Blaze Pro' ||
    value === '21_blaze_pro'
  );
}
