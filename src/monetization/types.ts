export type ProductCategory =
  | 'remove_ads'
  | 'card_theme'
  | 'arena'
  | 'bundle'
  | 'coin_cosmetic';

export type PurchaseStatus =
  | 'idle'
  | 'loading'
  | 'purchasing'
  | 'restoring'
  | 'success'
  | 'cancelled'
  | 'pending'
  | 'unavailable'
  | 'error';

export type AdRewardType =
  | 'double_solo_match_coins'
  | 'bonus_daily_reward'
  | 'temporary_cosmetic_preview';

export type AdConsentState =
  | 'unknown'
  | 'required'
  | 'obtained'
  | 'notRequired'
  | 'unavailable'
  | 'error';

export type EntitlementKey =
  | 'remove_ads'
  | 'cards_inferno'
  | 'cards_blue_flame'
  | 'cards_lava_gold'
  | 'arena_volcano'
  | 'arena_neon_casino'
  | 'founders_bundle'
  | 'founder_frame'
  | 'founder_title';

export type PurchasableProduct = {
  id: string;
  entitlementKey: EntitlementKey | null;
  category: ProductCategory;
  displayName: string;
  description: string;
  includedEntitlements: EntitlementKey[];
  includedCosmetics: string[];
};

export type PurchasePackage = {
  identifier: string;
  productId: string;
  localizedPriceString: string | null;
  price: number | null;
  currencyCode: string | null;
  title: string;
  description: string;
};

export type StoreOffering = {
  identifier: string;
  packages: PurchasePackage[];
};

export type CustomerEntitlements = {
  active: ReadonlyArray<EntitlementKey>;
  removeAds: boolean;
  rawActiveIds: ReadonlyArray<string>;
};

export type CosmeticOwnership = {
  cosmeticKey: string;
  owned: boolean;
  equipped: boolean;
  source: string | null;
};

export type WalletSnapshot = {
  balance: number;
  lifetimeEarned: number;
  lifetimeSpent: number;
};

export type WalletTransaction = {
  id: string;
  transactionType: 'earn' | 'spend' | 'grant' | 'refund' | 'adjustment';
  amount: number;
  balanceAfter: number;
  sourceKey: string;
  createdAt: string;
};

export type EquippedCosmetics = {
  cardTheme: string;
  arena: string;
  profileFrame: string;
  playerTitle: string | null;
  victoryEffect: string | null;
};
