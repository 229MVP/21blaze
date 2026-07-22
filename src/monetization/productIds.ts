import { Platform } from 'react-native';

import {
  ANDROID_PRODUCTS,
  ENTITLEMENT_KEYS,
  IOS_PRODUCTS,
  STORE_PRODUCTS,
  catalogIdToStoreProductIdForPlatform,
  isEntitlementKey,
  productIdToCatalogId,
} from './productIds.pure';

export {
  ANDROID_PRODUCTS,
  ENTITLEMENT_KEYS,
  IOS_PRODUCTS,
  STORE_PRODUCTS,
  isEntitlementKey,
  productIdToCatalogId,
};

function platformProducts() {
  return Platform.OS === 'ios' ? IOS_PRODUCTS : ANDROID_PRODUCTS;
}

export function getStoreProductId(
  key: keyof typeof IOS_PRODUCTS,
): string {
  return platformProducts()[key];
}

export function catalogIdToStoreProductId(catalogId: string): string | null {
  const platform = Platform.OS === 'ios' ? 'ios' : 'android';
  return catalogIdToStoreProductIdForPlatform(catalogId, platform);
}
