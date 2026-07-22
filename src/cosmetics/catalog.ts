export type CosmeticCategory =
  | 'card_theme'
  | 'arena'
  | 'profile_frame'
  | 'title'
  | 'emote'
  | 'victory_effect';

export type CosmeticPurchaseSource =
  | 'free'
  | 'store'
  | 'coins'
  | 'bundle'
  | 'achievement';

export type CosmeticDefinition = {
  key: string;
  category: CosmeticCategory;
  displayName: string;
  description: string;
  previewAsset: string;
  purchaseSource: CosmeticPurchaseSource;
  coinPrice: number | null;
  entitlementKey: string | null;
  sortOrder: number;
  betaAvailability: boolean;
};

export const COSMETIC_CATALOG: readonly CosmeticDefinition[] = [
  {
    key: 'classic_cards',
    category: 'card_theme',
    displayName: 'Classic Cards',
    description: 'The original 21 Blaze card faces.',
    previewAsset: 'classic_cards',
    purchaseSource: 'free',
    coinPrice: null,
    entitlementKey: null,
    sortOrder: 1,
    betaAvailability: true,
  },
  {
    key: 'default_arena',
    category: 'arena',
    displayName: 'Default Arena',
    description: 'Standard inferno backdrop.',
    previewAsset: 'default_arena',
    purchaseSource: 'free',
    coinPrice: null,
    entitlementKey: null,
    sortOrder: 1,
    betaAvailability: true,
  },
  {
    key: 'default_frame',
    category: 'profile_frame',
    displayName: 'Default Frame',
    description: 'Simple profile frame.',
    previewAsset: 'default_frame',
    purchaseSource: 'free',
    coinPrice: null,
    entitlementKey: null,
    sortOrder: 1,
    betaAvailability: true,
  },
  {
    key: 'inferno_cards',
    category: 'card_theme',
    displayName: 'Inferno Cards',
    description: 'Molten inferno styling. Cosmetics only.',
    previewAsset: 'inferno_cards',
    purchaseSource: 'store',
    coinPrice: null,
    entitlementKey: 'cards_inferno',
    sortOrder: 10,
    betaAvailability: true,
  },
  {
    key: 'blue_flame_cards',
    category: 'card_theme',
    displayName: 'Blue Flame Cards',
    description: 'Cool blue flame faces. Cosmetics only.',
    previewAsset: 'blue_flame_cards',
    purchaseSource: 'store',
    coinPrice: null,
    entitlementKey: 'cards_blue_flame',
    sortOrder: 11,
    betaAvailability: true,
  },
  {
    key: 'lava_gold_cards',
    category: 'card_theme',
    displayName: 'Lava Gold Cards',
    description: 'Gold-rimmed lava cards. Cosmetics only.',
    previewAsset: 'lava_gold_cards',
    purchaseSource: 'store',
    coinPrice: null,
    entitlementKey: 'cards_lava_gold',
    sortOrder: 12,
    betaAvailability: true,
  },
  {
    key: 'volcano_arena',
    category: 'arena',
    displayName: 'Volcano Arena',
    description: 'Eruptive decorative backdrop.',
    previewAsset: 'volcano_arena',
    purchaseSource: 'store',
    coinPrice: null,
    entitlementKey: 'arena_volcano',
    sortOrder: 20,
    betaAvailability: true,
  },
  {
    key: 'neon_casino_arena',
    category: 'arena',
    displayName: 'Neon Casino Arena',
    description: 'Neon casino atmosphere. Decorative only.',
    previewAsset: 'neon_casino_arena',
    purchaseSource: 'store',
    coinPrice: null,
    entitlementKey: 'arena_neon_casino',
    sortOrder: 21,
    betaAvailability: true,
  },
  {
    key: 'founder_frame',
    category: 'profile_frame',
    displayName: 'Founder Frame',
    description: 'Exclusive Founders Bundle profile frame.',
    previewAsset: 'founder_frame',
    purchaseSource: 'bundle',
    coinPrice: null,
    entitlementKey: 'founder_frame',
    sortOrder: 30,
    betaAvailability: true,
  },
  {
    key: 'founder_title',
    category: 'title',
    displayName: 'Founder',
    description: 'Founders Bundle player title.',
    previewAsset: 'founder_title',
    purchaseSource: 'bundle',
    coinPrice: null,
    entitlementKey: 'founder_title',
    sortOrder: 31,
    betaAvailability: true,
  },
  {
    key: 'midnight_cards',
    category: 'card_theme',
    displayName: 'Midnight Cards',
    description: 'Unlock with Blaze Coins. Cosmetics only.',
    previewAsset: 'midnight_cards',
    purchaseSource: 'coins',
    coinPrice: 3000,
    entitlementKey: null,
    sortOrder: 40,
    betaAvailability: true,
  },
  {
    key: 'ember_arena',
    category: 'arena',
    displayName: 'Ember Arena',
    description: 'Soft ember glow arena. Decorative only.',
    previewAsset: 'ember_arena',
    purchaseSource: 'coins',
    coinPrice: 5000,
    entitlementKey: null,
    sortOrder: 41,
    betaAvailability: true,
  },
  {
    key: 'hot_streak_title',
    category: 'title',
    displayName: 'Hot Streak',
    description: 'Show off your heat with a coin-earned title.',
    previewAsset: 'hot_streak_title',
    purchaseSource: 'coins',
    coinPrice: 2000,
    entitlementKey: null,
    sortOrder: 42,
    betaAvailability: true,
  },
  {
    key: 'flame_profile_frame',
    category: 'profile_frame',
    displayName: 'Flame Frame',
    description: 'Blaze Coin profile frame.',
    previewAsset: 'flame_profile_frame',
    purchaseSource: 'coins',
    coinPrice: 2500,
    entitlementKey: null,
    sortOrder: 43,
    betaAvailability: true,
  },
  {
    key: 'seven_day_blaze_title',
    category: 'title',
    displayName: 'Seven-Day Blaze',
    description: 'Earned by completing a full seven-day daily reward streak.',
    previewAsset: 'seven_day_blaze_title',
    purchaseSource: 'achievement',
    coinPrice: null,
    entitlementKey: null,
    sortOrder: 100,
    betaAvailability: true,
  },
  {
    key: 'rookie_blazer_title',
    category: 'title',
    displayName: 'Rookie Blazer',
    description: 'Level 3 free progression title.',
    previewAsset: 'rookie_blazer_title',
    purchaseSource: 'achievement',
    coinPrice: null,
    entitlementKey: null,
    sortOrder: 101,
    betaAvailability: true,
  },
  {
    key: 'ember_card_back',
    category: 'card_theme',
    displayName: 'Ember Card Back',
    description: 'Level 5 free card theme.',
    previewAsset: 'ember_card_back',
    purchaseSource: 'achievement',
    coinPrice: null,
    entitlementKey: null,
    sortOrder: 102,
    betaAvailability: true,
  },
  {
    key: 'spark_profile_frame',
    category: 'profile_frame',
    displayName: 'Spark Profile Frame',
    description: 'Level 10 free profile frame.',
    previewAsset: 'spark_profile_frame',
    purchaseSource: 'achievement',
    coinPrice: null,
    entitlementKey: null,
    sortOrder: 103,
    betaAvailability: true,
  },
  {
    key: 'flame_card_face',
    category: 'card_theme',
    displayName: 'Flame Card Face',
    description: 'Level 15 free card theme.',
    previewAsset: 'flame_card_face',
    purchaseSource: 'achievement',
    coinPrice: null,
    entitlementKey: null,
    sortOrder: 104,
    betaAvailability: true,
  },
  {
    key: 'inferno_player_title',
    category: 'title',
    displayName: 'Inferno Player',
    description: 'Level 25 free progression title.',
    previewAsset: 'inferno_player_title',
    purchaseSource: 'achievement',
    coinPrice: null,
    entitlementKey: null,
    sortOrder: 105,
    betaAvailability: true,
  },
  {
    key: 'veteran_blazer_card_back',
    category: 'card_theme',
    displayName: 'Veteran Blazer Card Back',
    description: 'Level 30 free card theme.',
    previewAsset: 'veteran_blazer_card_back',
    purchaseSource: 'achievement',
    coinPrice: null,
    entitlementKey: null,
    sortOrder: 106,
    betaAvailability: true,
  },
  {
    key: 'blaze_profile_frame',
    category: 'profile_frame',
    displayName: 'Blaze Profile Frame',
    description: 'Level 40 free profile frame.',
    previewAsset: 'blaze_profile_frame',
    purchaseSource: 'achievement',
    coinPrice: null,
    entitlementKey: null,
    sortOrder: 107,
    betaAvailability: true,
  },
  {
    key: 'blaze_master_title',
    category: 'title',
    displayName: 'Blaze Master',
    description: 'Level 50 free progression title.',
    previewAsset: 'blaze_master_title',
    purchaseSource: 'achievement',
    coinPrice: null,
    entitlementKey: null,
    sortOrder: 108,
    betaAvailability: true,
  },
  {
    key: 'level_50_champion_card_back',
    category: 'card_theme',
    displayName: 'Level 50 Champion Card Back',
    description: 'Second Level 50 free card theme.',
    previewAsset: 'level_50_champion_card_back',
    purchaseSource: 'achievement',
    coinPrice: null,
    entitlementKey: null,
    sortOrder: 109,
    betaAvailability: true,
  },
] as const;

export function getCosmetic(key: string): CosmeticDefinition | undefined {
  return COSMETIC_CATALOG.find((item) => item.key === key);
}

export function cosmeticsByCategory(
  category: CosmeticCategory,
): CosmeticDefinition[] {
  return COSMETIC_CATALOG.filter(
    (item) => item.category === category && item.betaAvailability,
  ).sort((a, b) => a.sortOrder - b.sortOrder);
}

export const FREE_DEFAULTS: Record<CosmeticCategory, string> = {
  card_theme: 'classic_cards',
  arena: 'default_arena',
  profile_frame: 'default_frame',
  title: '',
  emote: '',
  victory_effect: '',
};
