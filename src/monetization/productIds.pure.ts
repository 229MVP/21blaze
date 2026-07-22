import type { EntitlementKey, PurchasableProduct } from './types';

export const IOS_PRODUCTS = {
  removeAds: 'com.twentyoneblaze.remove_ads',
  cardsInferno: 'com.twentyoneblaze.cards.inferno',
  cardsBlueFlame: 'com.twentyoneblaze.cards.blue_flame',
  cardsLavaGold: 'com.twentyoneblaze.cards.lava_gold',
  arenaVolcano: 'com.twentyoneblaze.arena.volcano',
  arenaNeonCasino: 'com.twentyoneblaze.arena.neon_casino',
  foundersBundle: 'com.twentyoneblaze.bundle.founders',
} as const;

export const ANDROID_PRODUCTS = {
  removeAds: 'remove_ads',
  cardsInferno: 'cards_inferno',
  cardsBlueFlame: 'cards_blue_flame',
  cardsLavaGold: 'cards_lava_gold',
  arenaVolcano: 'arena_volcano',
  arenaNeonCasino: 'arena_neon_casino',
  foundersBundle: 'bundle_founders',
} as const;

export const ENTITLEMENT_KEYS = {
  removeAds: 'remove_ads',
  cardsInferno: 'cards_inferno',
  cardsBlueFlame: 'cards_blue_flame',
  cardsLavaGold: 'cards_lava_gold',
  arenaVolcano: 'arena_volcano',
  arenaNeonCasino: 'arena_neon_casino',
  foundersBundle: 'founders_bundle',
  founderFrame: 'founder_frame',
  founderTitle: 'founder_title',
} as const satisfies Record<string, EntitlementKey>;

export const STORE_PRODUCTS: readonly PurchasableProduct[] = [
  {
    id: 'remove_ads',
    entitlementKey: 'remove_ads',
    category: 'remove_ads',
    displayName: 'Remove Ads',
    description:
      'Removes interstitial ads. Optional rewarded ads you choose to watch still remain available.',
    includedEntitlements: ['remove_ads'],
    includedCosmetics: [],
  },
  {
    id: 'cards_inferno',
    entitlementKey: 'cards_inferno',
    category: 'card_theme',
    displayName: 'Inferno Card Pack',
    description: 'Cosmetic card faces with inferno styling. Does not change gameplay.',
    includedEntitlements: ['cards_inferno'],
    includedCosmetics: ['inferno_cards'],
  },
  {
    id: 'cards_blue_flame',
    entitlementKey: 'cards_blue_flame',
    category: 'card_theme',
    displayName: 'Blue Flame Card Pack',
    description: 'Cool blue-flame card cosmetics. Purely visual.',
    includedEntitlements: ['cards_blue_flame'],
    includedCosmetics: ['blue_flame_cards'],
  },
  {
    id: 'cards_lava_gold',
    entitlementKey: 'cards_lava_gold',
    category: 'card_theme',
    displayName: 'Lava Gold Card Pack',
    description: 'Molten gold card cosmetics. No gameplay advantage.',
    includedEntitlements: ['cards_lava_gold'],
    includedCosmetics: ['lava_gold_cards'],
  },
  {
    id: 'arena_volcano',
    entitlementKey: 'arena_volcano',
    category: 'arena',
    displayName: 'Volcano Arena',
    description: 'Decorative arena backdrop. Does not alter visibility of card values.',
    includedEntitlements: ['arena_volcano'],
    includedCosmetics: ['volcano_arena'],
  },
  {
    id: 'arena_neon_casino',
    entitlementKey: 'arena_neon_casino',
    category: 'arena',
    displayName: 'Neon Casino Arena',
    description: 'Neon casino atmosphere for your boards. Cosmetics only.',
    includedEntitlements: ['arena_neon_casino'],
    includedCosmetics: ['neon_casino_arena'],
  },
  {
    id: 'bundle_founders',
    entitlementKey: 'founders_bundle',
    category: 'bundle',
    displayName: 'Founders Bundle',
    description:
      'Includes Remove Ads, Inferno cards, Volcano arena, Founder frame, Founder title, and a one-time 2,500 Blaze Coin grant.',
    includedEntitlements: [
      'remove_ads',
      'cards_inferno',
      'arena_volcano',
      'founders_bundle',
      'founder_frame',
      'founder_title',
    ],
    includedCosmetics: [
      'inferno_cards',
      'volcano_arena',
      'founder_frame',
      'founder_title',
    ],
  },
] as const;

export function productIdToCatalogId(productId: string): string | null {
  const map: Record<string, string> = {
    [IOS_PRODUCTS.removeAds]: 'remove_ads',
    [ANDROID_PRODUCTS.removeAds]: 'remove_ads',
    [IOS_PRODUCTS.cardsInferno]: 'cards_inferno',
    [ANDROID_PRODUCTS.cardsInferno]: 'cards_inferno',
    [IOS_PRODUCTS.cardsBlueFlame]: 'cards_blue_flame',
    [ANDROID_PRODUCTS.cardsBlueFlame]: 'cards_blue_flame',
    [IOS_PRODUCTS.cardsLavaGold]: 'cards_lava_gold',
    [ANDROID_PRODUCTS.cardsLavaGold]: 'cards_lava_gold',
    [IOS_PRODUCTS.arenaVolcano]: 'arena_volcano',
    [ANDROID_PRODUCTS.arenaVolcano]: 'arena_volcano',
    [IOS_PRODUCTS.arenaNeonCasino]: 'arena_neon_casino',
    [ANDROID_PRODUCTS.arenaNeonCasino]: 'arena_neon_casino',
    [IOS_PRODUCTS.foundersBundle]: 'bundle_founders',
    [ANDROID_PRODUCTS.foundersBundle]: 'bundle_founders',
  };
  return map[productId] ?? null;
}

export function catalogIdToStoreProductIdForPlatform(
  catalogId: string,
  platform: 'ios' | 'android',
): string | null {
  const products = platform === 'ios' ? IOS_PRODUCTS : ANDROID_PRODUCTS;
  switch (catalogId) {
    case 'remove_ads':
      return products.removeAds;
    case 'cards_inferno':
      return products.cardsInferno;
    case 'cards_blue_flame':
      return products.cardsBlueFlame;
    case 'cards_lava_gold':
      return products.cardsLavaGold;
    case 'arena_volcano':
      return products.arenaVolcano;
    case 'arena_neon_casino':
      return products.arenaNeonCasino;
    case 'bundle_founders':
      return products.foundersBundle;
    default:
      return null;
  }
}

export function isEntitlementKey(value: string): value is EntitlementKey {
  return (Object.values(ENTITLEMENT_KEYS) as string[]).includes(value);
}
