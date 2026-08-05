import { create } from 'zustand';

import {
  isDailyLeaderboardEnabled,
  isLeaderboardNearbyEnabled,
  isWeeklyLeaderboardEnabled,
} from '../config/featureFlags';
import { getUtcChallengeDate } from '../game/challenge/createDailyChallenge';
import { getUtcWeekStartDate } from '../leaderboards/utcWeek';
import { trackEvent } from '../monetization/analytics';
import {
  DailyChallengeServiceError,
  fetchDailyChallengeLeaderboard,
} from '../services/dailyChallengeService';
import {
  fetchDailyChallengeLeaderboardFull,
  fetchNearbyDailyRanks,
  fetchNearbyWeeklyRanks,
  fetchWeeklyChallengeLeaderboard,
  type DailyLeaderboardRow,
  type WeeklyLeaderboardRow,
} from '../services/challengeLeaderboardService';

export type LeaderboardTab = 'daily' | 'weekly';

type LeaderboardStore = {
  selectedTab: LeaderboardTab;
  dailyRows: DailyLeaderboardRow[];
  weeklyRows: WeeklyLeaderboardRow[];
  nearbyDailyRows: Array<Pick<DailyLeaderboardRow, 'rank' | 'playerName' | 'score' | 'challengePoints' | 'isCurrentPlayer'>>;
  nearbyWeeklyRows: Array<Pick<WeeklyLeaderboardRow, 'rank' | 'playerName' | 'challengePoints' | 'isCurrentPlayer'>>;
  currentDailyRank: number | null;
  currentWeeklyRank: number | null;
  currentDailyChallengePoints: number | null;
  currentWeeklyChallengePoints: number | null;
  dailyParticipantCount: number;
  weeklyParticipantCount: number;
  challengeDate: string | null;
  weekStart: string | null;
  weekEnd: string | null;
  endsAt: string | null;
  dailyFinalized: boolean;
  dailyCursor: number;
  weeklyCursor: number;
  lastUpdatedAt: string | null;
  isLoading: boolean;
  isRefreshing: boolean;
  isOfflineCache: boolean;
  error: string | null;
  setSelectedTab: (tab: LeaderboardTab) => void;
  loadDailyLeaderboard: (challengeDate?: string) => Promise<void>;
  loadWeeklyLeaderboard: (weekStart?: string) => Promise<void>;
  loadMoreDaily: () => Promise<void>;
  loadMoreWeekly: () => Promise<void>;
  refreshDaily: () => Promise<void>;
  refreshWeekly: () => Promise<void>;
  loadNearbyDaily: (challengeDate?: string) => Promise<void>;
  loadNearbyWeekly: (weekStart?: string) => Promise<void>;
  clearError: () => void;
};

let dailyLoadInFlight = false;
let weeklyLoadInFlight = false;

export const useLeaderboardStore = create<LeaderboardStore>((set, get) => ({
  selectedTab: 'daily',
  dailyRows: [],
  weeklyRows: [],
  nearbyDailyRows: [],
  nearbyWeeklyRows: [],
  currentDailyRank: null,
  currentWeeklyRank: null,
  currentDailyChallengePoints: null,
  currentWeeklyChallengePoints: null,
  dailyParticipantCount: 0,
  weeklyParticipantCount: 0,
  challengeDate: null,
  weekStart: null,
  weekEnd: null,
  endsAt: null,
  dailyFinalized: false,
  dailyCursor: 0,
  weeklyCursor: 0,
  lastUpdatedAt: null,
  isLoading: false,
  isRefreshing: false,
  isOfflineCache: false,
  error: null,

  setSelectedTab: (tab) => {
    set({ selectedTab: tab });
    if (tab === 'weekly' && get().weeklyRows.length === 0 && isWeeklyLeaderboardEnabled()) {
      void get().loadWeeklyLeaderboard();
    }
  },

  loadDailyLeaderboard: async (challengeDate) => {
    if (!isDailyLeaderboardEnabled() || dailyLoadInFlight) {
      return;
    }
    dailyLoadInFlight = true;
    set({ isLoading: true, error: null, isOfflineCache: false });
    trackEvent('daily_leaderboard_viewed');

    const date = challengeDate ?? getUtcChallengeDate(Date.now());

    try {
      const response = await fetchDailyChallengeLeaderboardFull(date, 0, 100);
      set({
        dailyRows: response.entries,
        dailyCursor: response.entries.length > 0 ? response.entries[response.entries.length - 1].rank : 0,
        currentDailyRank: response.playerRank?.rank ?? null,
        currentDailyChallengePoints: response.playerRank?.challengePoints ?? null,
        dailyParticipantCount: response.totalParticipants,
        challengeDate: response.challengeDate,
        endsAt: response.endsAt,
        dailyFinalized: response.finalized,
        lastUpdatedAt: response.serverTime,
        isLoading: false,
        isOfflineCache: false,
      });
      if (isLeaderboardNearbyEnabled()) {
        void get().loadNearbyDaily(date);
      }
      trackEvent('leaderboard_current_rank_viewed', { scope: 'daily' });
    } catch (error) {
      if (error instanceof DailyChallengeServiceError) {
        try {
          const legacy = await fetchDailyChallengeLeaderboard(date);
          set({
            dailyRows: legacy.entries.map((entry) => ({
              rank: entry.rank,
              playerName: entry.playerName,
              score: entry.score,
              exact21Count: entry.exact21Count,
              fiveCardClears: entry.fiveCardClears,
              bustCount: entry.bustCount,
              bestMultiplier: entry.bestMultiplier,
              elapsedTimeMs: entry.elapsedTimeMs,
              challengePoints: 0,
              profileFrameId: 'default_profile_frame',
              playerTitleId: null,
              isCurrentPlayer: entry.isCurrentPlayer,
            })),
            isLoading: false,
            isOfflineCache: true,
            error: 'CONNECT ONLINE TO REFRESH RANKINGS',
          });
          trackEvent('leaderboard_offline_cache_viewed', { scope: 'daily' });
        } catch {
          set({
            isLoading: false,
            error: error.message,
          });
        }
      } else {
        set({
          isLoading: false,
          error: error instanceof Error ? error.message : 'Unable to load leaderboard.',
        });
      }
    } finally {
      dailyLoadInFlight = false;
    }
  },

  loadWeeklyLeaderboard: async (weekStart) => {
    if (!isWeeklyLeaderboardEnabled() || weeklyLoadInFlight) {
      return;
    }
    weeklyLoadInFlight = true;
    set({ isLoading: true, error: null, isOfflineCache: false });
    trackEvent('weekly_leaderboard_viewed');

    const start = weekStart ?? getUtcWeekStartDate();

    try {
      const response = await fetchWeeklyChallengeLeaderboard(start, 0, 100);
      set({
        weeklyRows: response.entries,
        weeklyCursor:
          response.entries.length > 0
            ? response.entries[response.entries.length - 1].rank
            : 0,
        currentWeeklyRank: response.playerRank?.rank ?? null,
        currentWeeklyChallengePoints: response.playerRank?.challengePoints ?? null,
        weeklyParticipantCount: response.totalParticipants,
        weekStart: response.weekStart,
        weekEnd: response.weekEnd,
        lastUpdatedAt: response.serverTime,
        isLoading: false,
        isOfflineCache: false,
      });
      if (isLeaderboardNearbyEnabled()) {
        void get().loadNearbyWeekly(start);
      }
      trackEvent('leaderboard_current_rank_viewed', { scope: 'weekly' });
    } catch (error) {
      set({
        isLoading: false,
        error:
          error instanceof Error ? error.message : 'Unable to load weekly leaderboard.',
      });
    } finally {
      weeklyLoadInFlight = false;
    }
  },

  loadMoreDaily: async () => {
    const state = get();
    if (!isDailyLeaderboardEnabled() || state.dailyRows.length >= 100 || dailyLoadInFlight) {
      return;
    }
    const date = state.challengeDate ?? getUtcChallengeDate(Date.now());
    dailyLoadInFlight = true;
    trackEvent('leaderboard_page_loaded', { scope: 'daily' });

    try {
      const response = await fetchDailyChallengeLeaderboardFull(
        date,
        state.dailyCursor,
        100,
      );
      const merged = [...state.dailyRows];
      for (const entry of response.entries) {
        if (!merged.some((row) => row.rank === entry.rank)) {
          merged.push(entry);
        }
      }
      set({
        dailyRows: merged,
        dailyCursor:
          response.entries.length > 0
            ? response.entries[response.entries.length - 1].rank
            : state.dailyCursor,
        lastUpdatedAt: response.serverTime,
      });
    } catch {
      // Keep existing rows.
    } finally {
      dailyLoadInFlight = false;
    }
  },

  loadMoreWeekly: async () => {
    const state = get();
    if (!isWeeklyLeaderboardEnabled() || state.weeklyRows.length >= 100 || weeklyLoadInFlight) {
      return;
    }
    const start = state.weekStart ?? getUtcWeekStartDate();
    weeklyLoadInFlight = true;
    trackEvent('leaderboard_page_loaded', { scope: 'weekly' });

    try {
      const response = await fetchWeeklyChallengeLeaderboard(
        start,
        state.weeklyCursor,
        100,
      );
      const merged = [...state.weeklyRows];
      for (const entry of response.entries) {
        if (!merged.some((row) => row.rank === entry.rank)) {
          merged.push(entry);
        }
      }
      set({
        weeklyRows: merged,
        weeklyCursor:
          response.entries.length > 0
            ? response.entries[response.entries.length - 1].rank
            : state.weeklyCursor,
        lastUpdatedAt: response.serverTime,
      });
    } catch {
      // Keep existing rows.
    } finally {
      weeklyLoadInFlight = false;
    }
  },

  refreshDaily: async () => {
    if (!isDailyLeaderboardEnabled()) {
      return;
    }
    set({ isRefreshing: true });
    trackEvent('leaderboard_refreshed', { scope: 'daily' });
    await get().loadDailyLeaderboard(get().challengeDate ?? undefined);
    set({ isRefreshing: false });
  },

  refreshWeekly: async () => {
    if (!isWeeklyLeaderboardEnabled()) {
      return;
    }
    set({ isRefreshing: true });
    trackEvent('leaderboard_refreshed', { scope: 'weekly' });
    await get().loadWeeklyLeaderboard(get().weekStart ?? undefined);
    set({ isRefreshing: false });
  },

  loadNearbyDaily: async (challengeDate) => {
    if (!isLeaderboardNearbyEnabled()) {
      return;
    }
    try {
      const response = await fetchNearbyDailyRanks(
        challengeDate ?? get().challengeDate ?? getUtcChallengeDate(Date.now()),
      );
      set({ nearbyDailyRows: response.entries });
      trackEvent('leaderboard_nearby_viewed', { scope: 'daily' });
    } catch {
      set({ nearbyDailyRows: [] });
    }
  },

  loadNearbyWeekly: async (weekStart) => {
    if (!isLeaderboardNearbyEnabled()) {
      return;
    }
    try {
      const response = await fetchNearbyWeeklyRanks(
        weekStart ?? get().weekStart ?? getUtcWeekStartDate(),
      );
      set({ nearbyWeeklyRows: response.entries });
      trackEvent('leaderboard_nearby_viewed', { scope: 'weekly' });
    } catch {
      set({ nearbyWeeklyRows: [] });
    }
  },

  clearError: () => set({ error: null }),
}));

export function __resetLeaderboardStoreForTests(): void {
  useLeaderboardStore.setState({
    selectedTab: 'daily',
    dailyRows: [],
    weeklyRows: [],
    nearbyDailyRows: [],
    nearbyWeeklyRows: [],
    currentDailyRank: null,
    currentWeeklyRank: null,
    currentDailyChallengePoints: null,
    currentWeeklyChallengePoints: null,
    dailyParticipantCount: 0,
    weeklyParticipantCount: 0,
    challengeDate: null,
    weekStart: null,
    weekEnd: null,
    endsAt: null,
    dailyFinalized: false,
    dailyCursor: 0,
    weeklyCursor: 0,
    lastUpdatedAt: null,
    isLoading: false,
    isRefreshing: false,
    isOfflineCache: false,
    error: null,
  });
}
