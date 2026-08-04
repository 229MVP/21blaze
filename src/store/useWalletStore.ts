import { create } from 'zustand';

import {
  claimAdReward,
  claimSoloMatchCoins,
  claimV1_1MatchReward,
  fetchWallet,
  fetchWalletTransactions,
  MonetizationServiceError,
  type V1_1MatchRewardResult,
} from '../services/monetizationService';
import type { WalletTransaction } from '../monetization/types';
import { trackEvent } from '../monetization/analytics';

export type V1_1RewardSyncStatus =
  | 'idle'
  | 'syncing'
  | 'verified'
  | 'local'
  | 'failed';

export type V1_1RewardBreakdown = {
  matchCoins: number;
  firstMatchBonusCoins: number;
  activeTimeCoins: number;
  activeTimeSeconds: number;
  xpGranted: number;
  totalCoins: number;
};

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
  v1_1RewardStatus: V1_1RewardSyncStatus;
  v1_1RewardByMatchId: Record<string, V1_1RewardBreakdown>;
  v1_1RewardError: string | null;
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
  /** Version 1.1A — single secure Solo match reward flow. */
  claimV1_1Reward: (matchId: string) => Promise<V1_1RewardBreakdown | null>;
  markV1_1RewardLocal: (matchId: string) => void;
  clearWalletError: () => void;
};

let claimInFlight = false;
let doubleInFlight = false;
const v1_1ClaimInFlight = new Set<string>();

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
  v1_1RewardStatus: 'idle',
  v1_1RewardByMatchId: {},
  v1_1RewardError: null,

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

  claimV1_1Reward: async (matchId) => {
    if (!matchId || v1_1ClaimInFlight.has(matchId)) {
      return get().v1_1RewardByMatchId[matchId] ?? null;
    }
    const existing = get().v1_1RewardByMatchId[matchId];
    if (existing) {
      set({ v1_1RewardStatus: 'verified' });
      return existing;
    }

    v1_1ClaimInFlight.add(matchId);
    set({ v1_1RewardStatus: 'syncing', v1_1RewardError: null });
    trackEvent('match_reward_requested', { matchId });

    try {
      const result: V1_1MatchRewardResult = await claimV1_1MatchReward(matchId);
      const breakdown: V1_1RewardBreakdown = {
        matchCoins: Math.max(0, result.matchCoins),
        firstMatchBonusCoins: Math.max(0, result.firstMatchBonusCoins),
        activeTimeCoins: Math.max(0, result.activeTimeCoins),
        activeTimeSeconds: Math.max(0, result.activeTimeSeconds),
        xpGranted: Math.max(0, result.xpGranted),
        totalCoins: Math.max(0, result.totalCoins),
      };

      set((state) => ({
        balance: result.balance,
        v1_1RewardStatus: 'verified',
        v1_1RewardByMatchId: {
          ...state.v1_1RewardByMatchId,
          [matchId]: breakdown,
        },
        v1_1RewardError: null,
      }));

      trackEvent('match_reward_confirmed', {
        matchId,
        matchCoins: breakdown.matchCoins,
        firstMatchBonusCoins: breakdown.firstMatchBonusCoins,
        activeTimeCoins: breakdown.activeTimeCoins,
        xpGranted: breakdown.xpGranted,
      });
      if (breakdown.firstMatchBonusCoins > 0) {
        trackEvent('first_match_bonus_granted', {
          matchId,
          amount: breakdown.firstMatchBonusCoins,
        });
      }
      if (breakdown.activeTimeCoins > 0) {
        trackEvent('active_play_reward_granted', {
          matchId,
          amount: breakdown.activeTimeCoins,
          activeTimeSeconds: breakdown.activeTimeSeconds,
        });
      }

      return breakdown;
    } catch (error) {
      const message =
        error instanceof MonetizationServiceError
          ? error.message
          : 'Unable to sync match rewards.';
      set({ v1_1RewardStatus: 'failed', v1_1RewardError: message });
      trackEvent('match_reward_failed', { matchId });
      return null;
    } finally {
      v1_1ClaimInFlight.delete(matchId);
    }
  },

  markV1_1RewardLocal: (matchId) => {
    void matchId;
    set({ v1_1RewardStatus: 'local' });
  },

  clearWalletError: () => set({ error: null }),
}));
