import { create } from 'zustand';

import { trackEvent } from '../monetization/analytics';
import { presentCustomerCenter } from '../monetization/customerCenterService';
import { presentBlazeProPaywall } from '../monetization/paywallService';
import {
  findPackageForCatalogId,
  loadOfferings,
  purchaseProduct,
  refreshCustomerInfo,
  restorePurchases,
} from '../monetization/purchaseService';
import { configureRevenueCat } from '../monetization/revenueCatClient';
import type {
  CustomerEntitlements,
  PurchaseStatus,
  StoreOffering,
} from '../monetization/types';
import { fetchServerEntitlements } from '../services/monetizationService';
import { isStorePurchasesEnabled } from '../config/featureFlags';
import { useAuthStore } from './useAuthStore';
import { useCosmeticStore } from './useCosmeticStore';

type PurchaseStore = {
  offerings: StoreOffering | null;
  customerInfo: CustomerEntitlements | null;
  serverEntitlements: string[];
  isInitialized: boolean;
  isLoadingOfferings: boolean;
  activePurchaseProductId: string | null;
  restoreStatus: PurchaseStatus;
  paywallStatus: PurchaseStatus;
  error: string | null;
  initializePurchases: () => Promise<void>;
  loadOfferings: () => Promise<void>;
  purchaseProduct: (catalogProductId: string) => Promise<PurchaseStatus>;
  restorePurchases: () => Promise<PurchaseStatus>;
  presentProPaywall: () => Promise<PurchaseStatus>;
  openCustomerCenter: () => Promise<PurchaseStatus>;
  refreshCustomerInfo: () => Promise<void>;
  clearPurchaseError: () => void;
};

function currentUserId(): string | null {
  return useAuthStore.getState().user?.id ?? null;
}

export const usePurchaseStore = create<PurchaseStore>((set, get) => ({
  offerings: null,
  customerInfo: null,
  serverEntitlements: [],
  isInitialized: false,
  isLoadingOfferings: false,
  activePurchaseProductId: null,
  restoreStatus: 'idle',
  paywallStatus: 'idle',
  error: null,

  initializePurchases: async () => {
    if (!isStorePurchasesEnabled()) {
      set({ isInitialized: true });
      return;
    }
    const userId = currentUserId();
    if (!userId) {
      set({ isInitialized: true });
      return;
    }
    await configureRevenueCat(userId);
    const [info, server] = await Promise.all([
      refreshCustomerInfo(userId),
      fetchServerEntitlements(),
    ]);
    set({
      customerInfo: info,
      serverEntitlements: server,
      isInitialized: true,
    });
  },

  loadOfferings: async () => {
    const userId = currentUserId();
    if (!userId || !isStorePurchasesEnabled()) {
      set({ offerings: null });
      return;
    }
    set({ isLoadingOfferings: true, error: null });
    trackEvent('store_viewed');
    const offerings = await loadOfferings(userId);
    set({
      offerings,
      isLoadingOfferings: false,
      error: offerings ? null : 'Store offerings unavailable.',
    });
  },

  purchaseProduct: async (catalogProductId) => {
    if (get().activePurchaseProductId) {
      return 'purchasing';
    }
    const userId = currentUserId();
    if (!userId) {
      set({ error: 'Sign in required for purchases.' });
      return 'error';
    }
    set({ activePurchaseProductId: catalogProductId, error: null });
    trackEvent('purchase_started', { productId: catalogProductId });

    const result = await purchaseProduct(userId, catalogProductId);
    if (result.status === 'success') {
      set({
        customerInfo: result.entitlements,
        activePurchaseProductId: null,
      });
      await useCosmeticStore
        .getState()
        .restoreStoreOwnership([...result.entitlements.active]);
      trackEvent('purchase_completed', { productId: catalogProductId });
      return 'success';
    }
    if (result.status === 'cancelled') {
      set({ activePurchaseProductId: null });
      trackEvent('purchase_cancelled', { productId: catalogProductId });
      return 'cancelled';
    }
    if (result.status === 'pending') {
      set({ activePurchaseProductId: null });
      return 'pending';
    }
    set({
      activePurchaseProductId: null,
      error: result.message,
    });
    trackEvent('purchase_failed', { productId: catalogProductId });
    return result.status === 'unavailable' ? 'unavailable' : 'error';
  },

  restorePurchases: async () => {
    const userId = currentUserId();
    if (!userId) {
      set({ error: 'Sign in required to restore purchases.' });
      return 'error';
    }
    set({ restoreStatus: 'restoring', error: null });
    trackEvent('restore_started');
    const result = await restorePurchases(userId);
    if (result.status === 'success') {
      set({
        customerInfo: result.entitlements,
        restoreStatus: 'success',
      });
      await useCosmeticStore
        .getState()
        .restoreStoreOwnership([...result.entitlements.active]);
      trackEvent('restore_completed');
      return 'success';
    }
    set({
      restoreStatus: 'error',
      error:
        result.status === 'cancelled' || result.status === 'pending'
          ? null
          : result.message,
    });
    trackEvent('restore_failed');
    return result.status === 'unavailable' ? 'unavailable' : 'error';
  },

  presentProPaywall: async () => {
    const userId = currentUserId();
    if (!userId) {
      set({ error: 'Sign in required for purchases.' });
      return 'error';
    }
    if (get().paywallStatus === 'purchasing') {
      return 'purchasing';
    }
    set({ paywallStatus: 'purchasing', error: null });
    const result = await presentBlazeProPaywall(userId);
    if (result.status === 'success') {
      if (result.entitlements) {
        set({ customerInfo: result.entitlements, paywallStatus: 'success' });
        await useCosmeticStore
          .getState()
          .restoreStoreOwnership([...result.entitlements.active]);
      } else {
        set({ paywallStatus: 'success' });
        await get().refreshCustomerInfo();
      }
      return 'success';
    }
    if (result.status === 'cancelled') {
      set({ paywallStatus: 'cancelled' });
      return 'cancelled';
    }
    set({
      paywallStatus: result.status,
      error: result.message ?? 'Unable to present paywall.',
    });
    return result.status;
  },

  openCustomerCenter: async () => {
    const userId = currentUserId();
    if (!userId) {
      set({ error: 'Sign in required.' });
      return 'error';
    }
    const result = await presentCustomerCenter(userId);
    if (result.status === 'opened') {
      await get().refreshCustomerInfo();
      return 'success';
    }
    set({
      error: result.message,
    });
    return result.status === 'unavailable' ? 'unavailable' : 'error';
  },

  refreshCustomerInfo: async () => {
    const userId = currentUserId();
    if (!userId) {
      return;
    }
    const [info, server] = await Promise.all([
      refreshCustomerInfo(userId),
      fetchServerEntitlements(),
    ]);
    set({ customerInfo: info, serverEntitlements: server });
  },

  clearPurchaseError: () => set({ error: null }),
}));

export function useHasRemoveAdsEntitlement(): boolean {
  const customer = usePurchaseStore((state) => state.customerInfo);
  const server = usePurchaseStore((state) => state.serverEntitlements);
  if (customer?.removeAds || customer?.hasPro) {
    return true;
  }
  return (
    server.includes('ad_free') ||
    server.includes('remove_ads') ||
    server.includes('founders_pack') ||
    server.includes('founders_bundle') ||
    server.includes('pro') ||
    server.includes('21 Blaze Pro') ||
    server.includes('21_blaze_pro')
  );
}

export function useHasBlazeProEntitlement(): boolean {
  const customer = usePurchaseStore((state) => state.customerInfo);
  const server = usePurchaseStore((state) => state.serverEntitlements);
  if (customer?.hasPro) {
    return true;
  }
  return (
    server.includes('pro') ||
    server.includes('21 Blaze Pro') ||
    server.includes('21_blaze_pro')
  );
}

export function useLocalizedPrice(catalogProductId: string): string | null {
  const offerings = usePurchaseStore((state) => state.offerings);
  const pkg = findPackageForCatalogId(offerings, catalogProductId);
  return pkg?.localizedPriceString ?? null;
}
