import { create } from 'zustand';

import {
  claimAdReward,
  claimSoloMatchCoins,
  fetchWallet,
  fetchWalletTransactions,
  MonetizationServiceError,
} from '../services/monetizationService';
import type { WalletTransaction } from '../monetization/types';
import { trackEvent } from '../monetization/analytics';

type WalletStore = {
  balance: number;
  lifetimeEarned: number;
  lifetimeSpent: number;
  transactions: WalletTransaction[];
  isHydrated: boolean;
  isLoading: boolean;
  error: string | null;
  lastSoloGrant: number | null;
  lastSoloMatchId: string | null;
  doubledMatchIds: Record<string, true>;
  hydrateWallet: () => Promise<void>;
  refreshWallet: () => Promise<void>;
  loadTransactions: () => Promise<void>;
  claimSoloMatchReward: (input: {
    matchId: string;
    score: number;
    gameOverReason: string;
  }) => Promise<number>;
  claimRewardedDouble: (input: {
    matchId: string;
    clientRewardId: string;
  }) => Promise<number>;
  clearWalletError: () => void;
};

let claimInFlight = false;
let doubleInFlight = false;

export const useWalletStore = create<WalletStore>((set, get) => ({
  balance: 0,
  lifetimeEarned: 0,
  lifetimeSpent: 0,
  transactions: [],
  isHydrated: false,
  isLoading: false,
  error: null,
  lastSoloGrant: null,
  lastSoloMatchId: null,
  doubledMatchIds: {},

  hydrateWallet: async () => {
    set({ isLoading: true, error: null });
    try {
      const wallet = await fetchWallet();
      if (wallet) {
        set({
          balance: wallet.balance,
          lifetimeEarned: wallet.lifetimeEarned,
          lifetimeSpent: wallet.lifetimeSpent,
          isHydrated: true,
          isLoading: false,
        });
      } else {
        set({ isHydrated: true, isLoading: false });
      }
    } catch (error) {
      set({
        isHydrated: true,
        isLoading: false,
        error:
          error instanceof MonetizationServiceError
            ? error.message
            : 'Unable to load wallet.',
      });
    }
  },

  refreshWallet: async () => {
    await get().hydrateWallet();
  },

  loadTransactions: async () => {
    try {
      const transactions = await fetchWalletTransactions(20);
      set({ transactions });
    } catch (error) {
      set({
        error:
          error instanceof MonetizationServiceError
            ? error.message
            : 'Unable to load transactions.',
      });
    }
  },

  claimSoloMatchReward: async (input) => {
    if (claimInFlight) {
      return get().lastSoloGrant ?? 0;
    }
    if (input.gameOverReason === 'quit') {
      set({ lastSoloGrant: 0, lastSoloMatchId: input.matchId });
      return 0;
    }
    claimInFlight = true;
    try {
      const result = await claimSoloMatchCoins(input);
      set({
        balance: result.balance,
        lastSoloGrant: result.granted,
        lastSoloMatchId: input.matchId,
        error: null,
      });
      trackEvent('reward_granted', {
        type: 'solo_match',
        amount: result.granted,
      });
      return result.granted;
    } catch (error) {
      set({
        error:
          error instanceof MonetizationServiceError
            ? error.message
            : 'Unable to claim match coins.',
      });
      return 0;
    } finally {
      claimInFlight = false;
    }
  },

  claimRewardedDouble: async (input) => {
    if (doubleInFlight) {
      return 0;
    }
    if (get().doubledMatchIds[input.matchId]) {
      return 0;
    }
    doubleInFlight = true;
    try {
      const result = await claimAdReward({
        rewardType: 'double_solo_match_coins',
        clientRewardId: input.clientRewardId,
        matchId: input.matchId,
      });
      set({
        balance: result.balance,
        doubledMatchIds: { ...get().doubledMatchIds, [input.matchId]: true },
        error: null,
      });
      trackEvent('reward_granted', {
        type: 'double_solo_match_coins',
        amount: result.granted,
      });
      return result.granted;
    } catch (error) {
      set({
        error:
          error instanceof MonetizationServiceError
            ? error.message
            : 'Unable to claim ad reward.',
      });
      return 0;
    } finally {
      doubleInFlight = false;
    }
  },

  clearWalletError: () => set({ error: null }),
}));
