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

export function getStoreProductId(
  key: keyof typeof IOS_PRODUCTS,
): string {
  // Web uses Android-style catalog ids for display mapping only.
  return (Platform.OS === 'ios' ? IOS_PRODUCTS : ANDROID_PRODUCTS)[key];
}

export function catalogIdToStoreProductId(catalogId: string): string | null {
  const platform = Platform.OS === 'ios' ? 'ios' : 'android';
  return catalogIdToStoreProductIdForPlatform(catalogId, platform);
}
