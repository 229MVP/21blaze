import { create } from 'zustand';

import {
  claimDailyStreakReward,
  getDailyLeaderboard,
  getDailyStreakStatus,
  getMyDailyLeaderboardPosition,
  getMyWeeklyLeaderboardPosition,
  getWeeklyLeaderboard,
} from '../challenge/dailyLeaderboardClient';
import type {
  DailyLeaderboardEntry,
  DailyLeaderboardPage,
  DailyStreakStatus,
  WeeklyLeaderboardEntry,
  WeeklyLeaderboardPage,
  ClaimStreakRewardResult,
} from '../challenge/dailyLeaderboardTypes';
import { trackEvent } from '../monetization/analytics';

const CACHE_TTL_MS = 60_000;
const REFRESH_THROTTLE_MS = 5_000;

type LeaderboardTab = 'daily' | 'weekly';

type DailyLeaderboardStore = {
  tab: LeaderboardTab;
  dailyPage: DailyLeaderboardPage | null;
  weeklyPage: WeeklyLeaderboardPage | null;
  myDailyEntry: DailyLeaderboardEntry | null;
  myWeeklyEntry: WeeklyLeaderboardEntry | null;
  streakStatus: DailyStreakStatus | null;
  loading: boolean;
  loadingMore: boolean;
  errorMessage: string | null;
  offline: boolean;
  lastFetchedAtMs: number | null;
  lastRefreshAtMs: number | null;
  setTab: (tab: LeaderboardTab) => void;
  loadDailyLeaderboard: (challengeId: string, options?: { refresh?: boolean }) => Promise<void>;
  loadMoreDaily: (challengeId: string) => Promise<void>;
  loadWeeklyLeaderboard: (options?: { refresh?: boolean; weekStart?: string }) => Promise<void>;
  loadMoreWeekly: (weekStart?: string) => Promise<void>;
  loadMyDailyPosition: (challengeId: string) => Promise<void>;
  loadMyWeeklyPosition: (weekStart?: string) => Promise<void>;
  loadStreakStatus: (options?: { refresh?: boolean }) => Promise<void>;
  claimStreakReward: (milestone: number) => Promise<ClaimStreakRewardResult>;
  invalidateCache: () => void;
};

export const useDailyLeaderboardStore = create<DailyLeaderboardStore>((set, get) => ({
  tab: 'daily',
  dailyPage: null,
  weeklyPage: null,
  myDailyEntry: null,
  myWeeklyEntry: null,
  streakStatus: null,
  loading: false,
  loadingMore: false,
  errorMessage: null,
  offline: false,
  lastFetchedAtMs: null,
  lastRefreshAtMs: null,

  setTab: (tab) => {
    set({ tab });
    if (tab === 'daily') {
      trackEvent('daily_leaderboard_viewed');
    } else {
      trackEvent('weekly_leaderboard_viewed');
    }
  },

  invalidateCache: () => {
    set({
      dailyPage: null,
      weeklyPage: null,
      myDailyEntry: null,
      myWeeklyEntry: null,
      lastFetchedAtMs: null,
    });
  },

  loadDailyLeaderboard: async (challengeId, options) => {
    const now = Date.now();
    if (
      !options?.refresh &&
      get().dailyPage &&
      get().lastFetchedAtMs != null &&
      now - get().lastFetchedAtMs! < CACHE_TTL_MS
    ) {
      return;
    }
    if (
      options?.refresh &&
      get().lastRefreshAtMs != null &&
      now - get().lastRefreshAtMs! < REFRESH_THROTTLE_MS
    ) {
      return;
    }

    set({ loading: true, errorMessage: null, offline: false });
    trackEvent('daily_leaderboard_viewed');

    try {
      const page = await getDailyLeaderboard({ challengeId, limit: 50, offset: 0 });
      const position = await getMyDailyLeaderboardPosition(challengeId);
      set({
        dailyPage: page,
        myDailyEntry: position.entry,
        loading: false,
        lastFetchedAtMs: now,
        lastRefreshAtMs: options?.refresh ? now : get().lastRefreshAtMs,
      });
      if (options?.refresh) {
        trackEvent('leaderboard_refresh');
      }
    } catch (error) {
      set({
        loading: false,
        errorMessage:
          error instanceof Error ? error.message : 'Unable to load daily leaderboard.',
        offline: true,
      });
    }
  },

  loadMoreDaily: async (challengeId) => {
    const current = get().dailyPage;
    if (!current || get().loadingMore) {
      return;
    }
    const nextOffset = current.offset + current.entries.length;
    if (nextOffset >= current.totalPlayers) {
      return;
    }

    set({ loadingMore: true });
    try {
      const page = await getDailyLeaderboard({
        challengeId,
        limit: 50,
        offset: nextOffset,
      });
      set({
        dailyPage: {
          ...page,
          entries: [...current.entries, ...page.entries],
        },
        loadingMore: false,
      });
    } catch {
      set({ loadingMore: false });
    }
  },

  loadWeeklyLeaderboard: async (options) => {
    const now = Date.now();
    if (
      !options?.refresh &&
      get().weeklyPage &&
      get().lastFetchedAtMs != null &&
      now - get().lastFetchedAtMs! < CACHE_TTL_MS
    ) {
      return;
    }
    if (
      options?.refresh &&
      get().lastRefreshAtMs != null &&
      now - get().lastRefreshAtMs! < REFRESH_THROTTLE_MS
    ) {
      return;
    }

    set({ loading: true, errorMessage: null, offline: false });
    trackEvent('weekly_leaderboard_viewed');

    try {
      const page = await getWeeklyLeaderboard({
        weekStart: options?.weekStart,
        limit: 50,
        offset: 0,
      });
      const position = await getMyWeeklyLeaderboardPosition(options?.weekStart);
      set({
        weeklyPage: page,
        myWeeklyEntry: position.entry,
        loading: false,
        lastFetchedAtMs: now,
        lastRefreshAtMs: options?.refresh ? now : get().lastRefreshAtMs,
      });
      if (options?.refresh) {
        trackEvent('leaderboard_refresh');
      }
    } catch (error) {
      set({
        loading: false,
        errorMessage:
          error instanceof Error ? error.message : 'Unable to load weekly leaderboard.',
        offline: true,
      });
    }
  },

  loadMoreWeekly: async (weekStart) => {
    const current = get().weeklyPage;
    if (!current || get().loadingMore) {
      return;
    }
    const nextOffset = current.offset + current.entries.length;
    if (nextOffset >= current.totalPlayers) {
      return;
    }

    set({ loadingMore: true });
    try {
      const page = await getWeeklyLeaderboard({
        weekStart: weekStart ?? current.weekStart,
        limit: 50,
        offset: nextOffset,
      });
      set({
        weeklyPage: {
          ...page,
          entries: [...current.entries, ...page.entries],
        },
        loadingMore: false,
      });
    } catch {
      set({ loadingMore: false });
    }
  },

  loadMyDailyPosition: async (challengeId) => {
    try {
      const position = await getMyDailyLeaderboardPosition(challengeId);
      set({ myDailyEntry: position.entry });
    } catch {
      // Non-blocking
    }
  },

  loadMyWeeklyPosition: async (weekStart) => {
    try {
      const position = await getMyWeeklyLeaderboardPosition(weekStart);
      set({ myWeeklyEntry: position.entry });
    } catch {
      // Non-blocking
    }
  },

  loadStreakStatus: async (options) => {
    try {
      const status = await getDailyStreakStatus();
      set({ streakStatus: status });
    } catch {
      // Offline — keep cached if any
    }
  },

  claimStreakReward: async (milestone) => {
    trackEvent('streak_reward_claim_requested', { milestone });
    try {
      const result = await claimDailyStreakReward(milestone);
      trackEvent('streak_reward_claimed', { milestone, amount: result.amount });
      await get().loadStreakStatus({ refresh: true });
      return result;
    } catch (error) {
      trackEvent('streak_reward_claim_failed', { milestone });
      throw error;
    }
  },
}));

export function __resetDailyLeaderboardStoreForTests(): void {
  useDailyLeaderboardStore.setState({
    tab: 'daily',
    dailyPage: null,
    weeklyPage: null,
    myDailyEntry: null,
    myWeeklyEntry: null,
    streakStatus: null,
    loading: false,
    loadingMore: false,
    errorMessage: null,
    offline: false,
    lastFetchedAtMs: null,
    lastRefreshAtMs: null,
  });
}
