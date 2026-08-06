import { create } from 'zustand';

import { isChallengeRewardsEnabled } from '../config/featureFlags';
import { trackEvent } from '../monetization/analytics';
import {
  claimWeeklyChallengeReward,
  fetchChallengeRewardStatus,
  type ChallengeRewardStatus,
} from '../services/challengeRewardService';
import { DailyChallengeServiceError } from '../services/dailyChallengeService';
import { useWalletStore } from './useWalletStore';
import { useProgressionStore } from './useProgressionStore';
import { useCosmeticStore } from './useCosmeticStore';

type ChallengeRewardStore = {
  status: ChallengeRewardStatus | null;
  isLoading: boolean;
  isRefreshing: boolean;
  isClaimingWeekly: boolean;
  isOfflineCache: boolean;
  error: string | null;
  lastUpdatedAt: string | null;
  hydrate: (challengeDate?: string) => Promise<void>;
  refresh: (challengeDate?: string) => Promise<void>;
  claimWeekly: (weekStart?: string) => Promise<boolean>;
  clearError: () => void;
};

let loadInFlight = false;

export const useChallengeRewardStore = create<ChallengeRewardStore>((set, get) => ({
  status: null,
  isLoading: false,
  isRefreshing: false,
  isClaimingWeekly: false,
  isOfflineCache: false,
  error: null,
  lastUpdatedAt: null,

  hydrate: async (challengeDate) => {
    if (!isChallengeRewardsEnabled() || loadInFlight) {
      return;
    }
    loadInFlight = true;
    set({ isLoading: true, error: null });

    try {
      const status = await fetchChallengeRewardStatus(challengeDate);
      set({
        status,
        isLoading: false,
        isOfflineCache: false,
        lastUpdatedAt: status.serverTime,
        error: null,
      });
      trackEvent('weekly_reward_progress_viewed');
    } catch (error) {
      set({
        isLoading: false,
        error:
          error instanceof DailyChallengeServiceError
            ? 'CONNECT ONLINE TO VERIFY OR CLAIM CHALLENGE REWARDS'
            : error instanceof Error
              ? error.message
              : 'Unable to load challenge rewards.',
        isOfflineCache: error instanceof DailyChallengeServiceError,
      });
    } finally {
      loadInFlight = false;
    }
  },

  refresh: async (challengeDate) => {
    if (!isChallengeRewardsEnabled()) {
      return;
    }
    set({ isRefreshing: true });
    await get().hydrate(challengeDate);
    set({ isRefreshing: false });
  },

  claimWeekly: async (weekStart) => {
    if (!isChallengeRewardsEnabled()) {
      return false;
    }
    set({ isClaimingWeekly: true, error: null });
    trackEvent('weekly_reward_claim_started');

    try {
      const result = await claimWeeklyChallengeReward(weekStart);
      if (result.claimed) {
        trackEvent('weekly_reward_claimed', { tier: result.tier ?? null });
        await useWalletStore.getState().refreshWallet();
        await useProgressionStore.getState().refreshProgression();
        await useCosmeticStore.getState().hydrateCosmetics();
        await get().refresh();
        set({ isClaimingWeekly: false });
        return true;
      }
      trackEvent('weekly_reward_claim_failed', { reason: result.reason ?? 'unknown' });
      set({ isClaimingWeekly: false });
      return false;
    } catch (error) {
      trackEvent('weekly_reward_claim_failed');
      set({
        isClaimingWeekly: false,
        error: error instanceof Error ? error.message : 'Claim failed.',
      });
      return false;
    }
  },

  clearError: () => set({ error: null }),
}));

export function __resetChallengeRewardStoreForTests(): void {
  useChallengeRewardStore.setState({
    status: null,
    isLoading: false,
    isRefreshing: false,
    isClaimingWeekly: false,
    isOfflineCache: false,
    error: null,
    lastUpdatedAt: null,
  });
}
