/**
 * Clears user-scoped Zustand caches on sign-out or account switch.
 * Prevents one user's progression, wallet, or challenge state from
 * briefly appearing for another authenticated session.
 */

import { __resetDailyChallengeStoreForTests } from './useDailyChallengeStore';
import { __resetDailyLeaderboardStoreForTests } from './useDailyLeaderboardStore';
import { useProgressionStore } from './useProgressionStore';
import { useWalletStore } from './useWalletStore';

export function resetUserScopedStores(): void {
  __resetDailyChallengeStoreForTests();
  __resetDailyLeaderboardStoreForTests();

  useProgressionStore.setState({
    progression: null,
    dailyRewardStatus: null,
    dailyMissions: null,
    recentTransactions: [],
    isHydrated: false,
    isLoading: false,
    dailyRewardClaimStatus: 'idle',
    missionClaimStatus: 'idle',
    error: null,
    pendingLevelUp: null,
  });

  useWalletStore.setState({
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
  });
}
