import { create } from 'zustand';

import { COSMETIC_CATALOG, type CosmeticDefinition } from '../cosmetics/catalog';
import {
  resolveCosmeticButtonState,
  SLOT_FOR_COSMETIC_TYPE,
  SLOT_FOR_LEGACY_CATEGORY,
  V1_1B_LOCKER_CATALOG,
  type LockerCatalogEntry,
  type LockerEquipSlot,
} from '../cosmetics/lockerCatalog';
import { trackEvent } from '../monetization/analytics';
import type { EquippedCosmetics } from '../monetization/types';
import {
  equipCosmeticRemote,
  fetchCosmeticCatalog,
  fetchEquippedCosmetics,
  fetchOwnedCosmetics,
  MonetizationServiceError,
  purchaseCosmeticWithCoins,
  syncEntitlementsRemote,
  type FullLoadout,
} from '../services/monetizationService';
import { useWalletStore } from './useWalletStore';

export type CosmeticRequestStatus = 'idle' | 'purchasing' | 'success' | 'error';
export type CosmeticEquipStatus = 'idle' | 'equipping' | 'success' | 'error';

type PendingUnlock = {
  cosmeticId: string;
};

type CosmeticStore = {
  ownedCosmetics: string[];
  equippedCosmetics: EquippedCosmetics;
  /** Version 1.1B — server-driven catalog (falls back to a cached static
   * mirror while offline; never a client-authoritative price). */
  catalog: readonly LockerCatalogEntry[];
  selectedPreviewId: string | null;
  isHydrated: boolean;
  isLoading: boolean;
  purchaseStatus: CosmeticRequestStatus;
  equipStatus: CosmeticEquipStatus;
  error: string | null;
  pendingUnlock: PendingUnlock | null;

  hydrateCosmetics: () => Promise<void>;
  loadCatalog: () => Promise<void>;
  refreshOwnership: () => Promise<void>;
  equipCosmetic: (cosmeticId: string, categoryOrSlot: string) => Promise<boolean>;
  purchaseWithCoins: (cosmeticId: string) => Promise<boolean>;
  restoreStoreOwnership: (activeEntitlements: string[]) => Promise<void>;
  selectPreview: (cosmeticId: string | null) => void;
  acknowledgeUnlock: () => void;
  clearError: () => void;

  /** @deprecated kept for source compatibility; use selectPreview */
  previewCosmeticKey: string | null;
  previewCosmetic: (cosmeticKey: string) => void;
  stopPreview: () => void;
};

const DEFAULT_EQUIPPED: EquippedCosmetics = {
  cardTheme: 'classic_cards',
  arena: 'classic_arena',
  profileFrame: 'default_profile_frame',
  playerTitle: null,
  victoryEffect: null,
  cardFace: 'classic_card_face',
  cardBack: 'classic_card_back',
  laneEffect: null,
};

let purchaseInFlight: string | null = null;
let equipInFlight: string | null = null;
let catalogInFlight: Promise<void> | null = null;

function normalizeSlot(categoryOrSlot: string): LockerEquipSlot | null {
  if (
    categoryOrSlot === 'cardFaceId' ||
    categoryOrSlot === 'cardBackId' ||
    categoryOrSlot === 'arenaId' ||
    categoryOrSlot === 'profileFrameId' ||
    categoryOrSlot === 'playerTitleId' ||
    categoryOrSlot === 'laneEffectId'
  ) {
    return categoryOrSlot;
  }
  return SLOT_FOR_LEGACY_CATEGORY[categoryOrSlot] ?? null;
}

function applyLoadoutToEquipped(
  current: EquippedCosmetics,
  loadout: FullLoadout,
): EquippedCosmetics {
  return {
    ...current,
    arena: loadout.arenaId,
    profileFrame: loadout.profileFrameId,
    playerTitle: loadout.playerTitleId,
    cardFace: loadout.cardFaceId,
    cardBack: loadout.cardBackId,
    laneEffect: loadout.laneEffectId,
  };
}

export const useCosmeticStore = create<CosmeticStore>((set, get) => ({
  ownedCosmetics: [
    'classic_cards',
    'default_arena',
    'default_frame',
    'classic_card_face',
    'classic_card_back',
    'classic_arena',
    'default_profile_frame',
    'no_title',
  ],
  equippedCosmetics: DEFAULT_EQUIPPED,
  catalog: V1_1B_LOCKER_CATALOG,
  selectedPreviewId: null,
  isHydrated: false,
  isLoading: false,
  purchaseStatus: 'idle',
  equipStatus: 'idle',
  error: null,
  pendingUnlock: null,
  previewCosmeticKey: null,

  hydrateCosmetics: async () => {
    set({ isLoading: true, error: null });
    try {
      const [owned, equipped] = await Promise.all([
        fetchOwnedCosmetics(),
        fetchEquippedCosmetics(),
      ]);
      set((state) => ({
        ownedCosmetics:
          owned.length > 0
            ? Array.from(new Set([...owned, ...state.ownedCosmetics]))
            : state.ownedCosmetics,
        equippedCosmetics: equipped
          ? { ...state.equippedCosmetics, ...equipped }
          : state.equippedCosmetics,
        isHydrated: true,
        isLoading: false,
      }));
      void get().loadCatalog();
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

  loadCatalog: async () => {
    if (catalogInFlight) {
      return catalogInFlight;
    }
    catalogInFlight = (async () => {
      try {
        const rows = await fetchCosmeticCatalog();
        if (rows.length > 0) {
          set({
            catalog: rows
              .map((row) => ({
                id: row.id,
                name: row.name,
                description: row.description,
                cosmeticType: row.cosmeticType as LockerCatalogEntry['cosmeticType'],
                rarity: row.rarity as LockerCatalogEntry['rarity'],
                unlockMethod: row.unlockMethod as LockerCatalogEntry['unlockMethod'],
                blazeCoinCost: row.blazeCoinCost,
                sortOrder: row.sortOrder,
              }))
              .sort((a, b) => a.sortOrder - b.sortOrder),
          });
        }
        // Offline / fetch failure: keep whatever catalog is already cached
        // (the static mirror on first launch, or the last successful fetch).
      } catch {
        // Never throw — the Locker screen must keep showing cached data.
      } finally {
        catalogInFlight = null;
      }
    })();
    return catalogInFlight;
  },

  refreshOwnership: async () => {
    await get().hydrateCosmetics();
  },

  equipCosmetic: async (cosmeticId, categoryOrSlot) => {
    const slot = normalizeSlot(categoryOrSlot);
    if (!slot) {
      set({ error: 'Unsupported equipment slot.' });
      return false;
    }
    if (equipInFlight) {
      return false;
    }
    const catalogEntry = get().catalog.find((entry) => entry.id === cosmeticId);
    const isFree = catalogEntry?.unlockMethod === 'free';
    if (!isFree && !get().ownedCosmetics.includes(cosmeticId)) {
      set({ error: 'You do not own this cosmetic.' });
      return false;
    }

    equipInFlight = cosmeticId;
    const previous = get().equippedCosmetics;
    set({ equipStatus: 'equipping', error: null });
    try {
      const loadout = await equipCosmeticRemote(cosmeticId, slot);
      set({
        equippedCosmetics: applyLoadoutToEquipped(previous, loadout),
        equipStatus: 'success',
        error: null,
      });
      trackEvent('cosmetic_equipped', { cosmeticId, slot });
      return true;
    } catch (error) {
      set({
        equippedCosmetics: previous,
        equipStatus: 'error',
        error:
          error instanceof MonetizationServiceError
            ? error.message
            : 'Unable to equip cosmetic.',
      });
      return false;
    } finally {
      equipInFlight = null;
    }
  },

  purchaseWithCoins: async (cosmeticId) => {
    if (purchaseInFlight === cosmeticId) {
      return false;
    }
    if (get().ownedCosmetics.includes(cosmeticId)) {
      set({ error: 'Already owned.' });
      return false;
    }
    const catalogEntry = get().catalog.find((entry) => entry.id === cosmeticId);
    if (!catalogEntry || catalogEntry.unlockMethod !== 'blaze_coins' || catalogEntry.blazeCoinCost == null) {
      set({ error: 'This item cannot be bought with coins.' });
      return false;
    }
    const balance = useWalletStore.getState().balance;
    const buttonState = resolveCosmeticButtonState({
      entry: catalogEntry,
      owned: false,
      equipped: false,
      balance,
    });
    if (buttonState.kind === 'needCoins') {
      trackEvent('insufficient_coins_shown', {
        cosmeticId,
        missing: buttonState.missing,
      });
      set({ error: 'Not enough Blaze Coins.' });
      return false;
    }

    purchaseInFlight = cosmeticId;
    set({ purchaseStatus: 'purchasing', error: null });
    trackEvent('cosmetic_unlock_started', { cosmeticId, cost: catalogEntry.blazeCoinCost });
    try {
      const result = await purchaseCosmeticWithCoins(cosmeticId);
      useWalletStore.setState({ balance: result.balance });
      set((state) => ({
        ownedCosmetics: Array.from(new Set([...state.ownedCosmetics, result.cosmeticKey])),
        purchaseStatus: 'success',
        error: null,
        pendingUnlock: result.alreadyOwned ? state.pendingUnlock : { cosmeticId: result.cosmeticKey },
      }));
      trackEvent('cosmetic_unlock_completed', { cosmeticId, alreadyOwned: result.alreadyOwned });
      return true;
    } catch (error) {
      const message =
        error instanceof MonetizationServiceError
          ? error.message
          : 'Unable to purchase cosmetic.';
      set({ purchaseStatus: 'error', error: message });
      trackEvent('cosmetic_unlock_failed', { cosmeticId, reason: message });
      return false;
    } finally {
      purchaseInFlight = null;
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

  selectPreview: (cosmeticId) =>
    set({ selectedPreviewId: cosmeticId, previewCosmeticKey: cosmeticId }),
  acknowledgeUnlock: () => set({ pendingUnlock: null }),
  clearError: () => set({ error: null, purchaseStatus: 'idle', equipStatus: 'idle' }),

  previewCosmetic: (cosmeticKey) =>
    set({ previewCosmeticKey: cosmeticKey, selectedPreviewId: cosmeticKey }),
  stopPreview: () => set({ previewCosmeticKey: null, selectedPreviewId: null }),
}));

export { SLOT_FOR_COSMETIC_TYPE };
export type { CosmeticDefinition };
export { COSMETIC_CATALOG };
