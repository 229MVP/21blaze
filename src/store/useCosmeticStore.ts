import { create } from 'zustand';

import { COSMETIC_CATALOG, type CosmeticDefinition } from '../cosmetics/catalog';
import { trackEvent } from '../monetization/analytics';
import type { EquippedCosmetics } from '../monetization/types';
import {
  equipCosmeticRemote,
  fetchEquippedCosmetics,
  fetchOwnedCosmetics,
  MonetizationServiceError,
  purchaseCosmeticWithCoins,
  syncEntitlementsRemote,
} from '../services/monetizationService';
import { useWalletStore } from './useWalletStore';

type CosmeticStore = {
  ownedCosmetics: string[];
  equippedCosmetics: EquippedCosmetics;
  catalog: readonly CosmeticDefinition[];
  previewCosmeticKey: string | null;
  isHydrated: boolean;
  isLoading: boolean;
  error: string | null;
  hydrateCosmetics: () => Promise<void>;
  refreshOwnership: () => Promise<void>;
  equipCosmetic: (cosmeticKey: string, category: string) => Promise<boolean>;
  purchaseWithCoins: (cosmeticKey: string) => Promise<boolean>;
  restoreStoreOwnership: (activeEntitlements: string[]) => Promise<void>;
  previewCosmetic: (cosmeticKey: string) => void;
  stopPreview: () => void;
  clearError: () => void;
};

const DEFAULT_EQUIPPED: EquippedCosmetics = {
  cardTheme: 'classic_cards',
  arena: 'default_arena',
  profileFrame: 'default_frame',
  playerTitle: null,
  victoryEffect: null,
};

export const useCosmeticStore = create<CosmeticStore>((set, get) => ({
  ownedCosmetics: ['classic_cards', 'default_arena', 'default_frame'],
  equippedCosmetics: DEFAULT_EQUIPPED,
  catalog: COSMETIC_CATALOG,
  previewCosmeticKey: null,
  isHydrated: false,
  isLoading: false,
  error: null,

  hydrateCosmetics: async () => {
    set({ isLoading: true, error: null });
    try {
      const [owned, equipped] = await Promise.all([
        fetchOwnedCosmetics(),
        fetchEquippedCosmetics(),
      ]);
      set({
        ownedCosmetics:
          owned.length > 0
            ? Array.from(
                new Set([...owned, 'classic_cards', 'default_arena', 'default_frame']),
              )
            : get().ownedCosmetics,
        equippedCosmetics: equipped ?? get().equippedCosmetics,
        isHydrated: true,
        isLoading: false,
      });
    } catch (error) {
      set({
        isHydrated: true,
        isLoading: false,
        error:
          error instanceof MonetizationServiceError
            ? error.message
            : 'Unable to load cosmetics.',
      });
    }
  },

  refreshOwnership: async () => {
    await get().hydrateCosmetics();
  },

  equipCosmetic: async (cosmeticKey, category) => {
    if (!get().ownedCosmetics.includes(cosmeticKey)) {
      set({ error: 'You do not own this cosmetic.' });
      return false;
    }
    const previous = get().equippedCosmetics;
    try {
      const equipped = await equipCosmeticRemote(cosmeticKey, category);
      set({ equippedCosmetics: equipped, error: null });
      trackEvent('cosmetic_equipped', { cosmeticKey, category });
      return true;
    } catch (error) {
      set({
        equippedCosmetics: previous,
        error:
          error instanceof MonetizationServiceError
            ? error.message
            : 'Unable to equip cosmetic.',
      });
      return false;
    }
  },

  purchaseWithCoins: async (cosmeticKey) => {
    if (get().ownedCosmetics.includes(cosmeticKey)) {
      set({ error: 'Already owned.' });
      return false;
    }
    const item = COSMETIC_CATALOG.find((entry) => entry.key === cosmeticKey);
    if (!item || item.purchaseSource !== 'coins' || item.coinPrice === null) {
      set({ error: 'This item cannot be bought with coins.' });
      return false;
    }
    if (useWalletStore.getState().balance < item.coinPrice) {
      trackEvent('insufficient_coin_balance', { cosmeticKey });
      set({ error: 'Not enough Blaze Coins.' });
      return false;
    }
    try {
      const result = await purchaseCosmeticWithCoins(cosmeticKey);
      useWalletStore.setState({ balance: result.balance });
      set({
        ownedCosmetics: Array.from(
          new Set([...get().ownedCosmetics, result.cosmeticKey]),
        ),
        error: null,
      });
      trackEvent('cosmetic_coin_purchase_completed', { cosmeticKey });
      return true;
    } catch (error) {
      set({
        error:
          error instanceof MonetizationServiceError
            ? error.message
            : 'Unable to purchase cosmetic.',
      });
      return false;
    }
  },

  restoreStoreOwnership: async (activeEntitlements) => {
    try {
      await syncEntitlementsRemote(activeEntitlements);
      await get().refreshOwnership();
    } catch (error) {
      set({
        error:
          error instanceof MonetizationServiceError
            ? error.message
            : 'Unable to sync store ownership.',
      });
    }
  },

  previewCosmetic: (cosmeticKey) => set({ previewCosmeticKey: cosmeticKey }),
  stopPreview: () => set({ previewCosmeticKey: null }),
  clearError: () => set({ error: null }),
}));
