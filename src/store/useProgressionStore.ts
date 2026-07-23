import { create } from 'zustand';

import { trackEvent } from '../monetization/analytics';
import type {
  DailyMissionsStatus,
  DailyRewardStatus,
  PendingLevelUp,
  PlayerProgression,
  ProgressionTransactionView,
} from '../progression/types';
import {
  claimDailyMission as claimDailyMissionRemote,
  claimDailyReward as claimDailyRewardRemote,
  loadDailyMissions as loadDailyMissionsRemote,
  loadDailyRewardStatus,
  loadPlayerProgression,
  loadProgressionHistory as loadProgressionHistoryRemote,
  ProgressionServiceError,
} from '../services/progressionService';
import { useWalletStore } from './useWalletStore';

export type ClaimStatus = 'idle' | 'claiming' | 'success' | 'error';

type ProgressionStore = {
  progression: PlayerProgression | null;
  dailyRewardStatus: DailyRewardStatus | null;
  dailyMissions: DailyMissionsStatus | null;
  recentTransactions: ProgressionTransactionView[];
  isHydrated: boolean;
  isLoading: boolean;
  dailyRewardClaimStatus: ClaimStatus;
  missionClaimStatus: ClaimStatus;
  error: string | null;
  pendingLevelUp: PendingLevelUp | null;
  hydrateProgression: () => Promise<void>;
  refreshProgression: () => Promise<void>;
  loadDailyReward: () => Promise<void>;
  claimDailyReward: () => Promise<boolean>;
  loadDailyMissions: () => Promise<void>;
  claimMission: (missionId: string) => Promise<boolean>;
  loadProgressionHistory: (limit?: number) => Promise<void>;
  acknowledgeLevelUp: () => void;
  clearError: () => void;
};

let hydrateInFlight: Promise<void> | null = null;
let dailyClaimInFlight = false;
const missionClaimInFlight = new Set<string>();
let lastAcknowledgedLevelUpKey: string | null = null;

function toErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ProgressionServiceError) {
    return error.message;
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}

function buildPendingLevelUp(input: {
  levelBefore: number;
  levelAfter: number;
  levelsCrossed: number[];
  rewards: PendingLevelUp['rewards'];
  eventKey: string;
}): PendingLevelUp | null {
  if (input.levelAfter <= input.levelBefore && input.levelsCrossed.length === 0) {
    return null;
  }
  if (lastAcknowledgedLevelUpKey === input.eventKey) {
    return null;
  }
  return {
    levelBefore: input.levelBefore,
    levelAfter: input.levelAfter,
    levelsCrossed:
      input.levelsCrossed.length > 0
        ? input.levelsCrossed
        : [input.levelAfter],
    rewards: input.rewards,
    eventKey: input.eventKey,
  };
}

export const useProgressionStore = create<ProgressionStore>((set, get) => ({
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

  hydrateProgression: async () => {
    if (hydrateInFlight) {
      await hydrateInFlight;
      return;
    }

    hydrateInFlight = (async () => {
      set({ isLoading: true, error: null });
      try {
        const previousLevel = get().progression?.level ?? null;
        const progression = await loadPlayerProgression();

        let dailyRewardStatus = get().dailyRewardStatus;
        let dailyMissions = get().dailyMissions;

        const sideLoads = await Promise.allSettled([
          loadDailyRewardStatus(),
          loadDailyMissionsRemote(),
        ]);

        if (sideLoads[0].status === 'fulfilled') {
          dailyRewardStatus = sideLoads[0].value;
        }
        if (sideLoads[1].status === 'fulfilled') {
          dailyMissions = sideLoads[1].value;
        }

        let nextProgression = progression;
        if (nextProgression && dailyRewardStatus) {
          nextProgression = {
            ...nextProgression,
            dailyStreak: dailyRewardStatus.currentStreak,
            longestDailyStreak: dailyRewardStatus.longestStreak,
            nextDailyClaimAt: dailyRewardStatus.nextClaimAt,
            isDailyRewardAvailable: dailyRewardStatus.isAvailable,
          };
        }

        let pendingLevelUp = get().pendingLevelUp;
        if (
          nextProgression &&
          previousLevel !== null &&
          nextProgression.level > previousLevel
        ) {
          const eventKey = `hydrate:${previousLevel}:${nextProgression.level}:${nextProgression.totalXp}`;
          pendingLevelUp =
            buildPendingLevelUp({
              levelBefore: previousLevel,
              levelAfter: nextProgression.level,
              levelsCrossed: [],
              rewards: [],
              eventKey,
            }) ?? pendingLevelUp;
          if (pendingLevelUp) {
            trackEvent('level_up', {
              levelBefore: previousLevel,
              levelAfter: nextProgression.level,
            });
          }
        }

        set({
          progression: nextProgression,
          dailyRewardStatus,
          dailyMissions,
          pendingLevelUp,
          isHydrated: true,
          isLoading: false,
        });
      } catch (error) {
        trackEvent('progression_sync_failed');
        set({
          isHydrated: true,
          isLoading: false,
          error: toErrorMessage(error, 'Unable to load progression.'),
        });
      } finally {
        hydrateInFlight = null;
      }
    })();

    await hydrateInFlight;
  },

  refreshProgression: async () => {
    await get().hydrateProgression();
  },

  loadDailyReward: async () => {
    try {
      const status = await loadDailyRewardStatus();
      const progression = get().progression;
      set({
        dailyRewardStatus: status,
        progression: progression
          ? {
              ...progression,
              dailyStreak: status.currentStreak,
              longestDailyStreak: status.longestStreak,
              nextDailyClaimAt: status.nextClaimAt,
              isDailyRewardAvailable: status.isAvailable,
            }
          : progression,
        error: null,
      });
      trackEvent('daily_reward_viewed', {
        available: status.isAvailable,
        streak: status.currentStreak,
      });
    } catch (error) {
      trackEvent('progression_sync_failed', { source: 'daily_reward' });
      set({
        error: toErrorMessage(error, 'Unable to load daily reward.'),
      });
    }
  },

  claimDailyReward: async () => {
    if (dailyClaimInFlight) {
      return false;
    }
    if (get().dailyRewardClaimStatus === 'claiming') {
      return false;
    }

    dailyClaimInFlight = true;
    set({ dailyRewardClaimStatus: 'claiming', error: null });
    try {
      const levelBefore = get().progression?.level ?? 1;
      const result = await claimDailyRewardRemote();

      let status = result.status;
      try {
        status = await loadDailyRewardStatus();
      } catch {
        // Keep claim result even if status refresh fails.
      }

      const eventKey = `daily:${result.progression.totalXp}:${result.progression.level}:${result.xpGranted}`;
      const pendingLevelUp =
        buildPendingLevelUp({
          levelBefore,
          levelAfter: result.progression.level,
          levelsCrossed: result.levelsCrossed,
          rewards: result.rewardsGranted,
          eventKey,
        }) ?? get().pendingLevelUp;

      set({
        progression: {
          ...result.progression,
          isDailyRewardAvailable: status?.isAvailable ?? false,
          dailyStreak: status?.currentStreak ?? result.progression.dailyStreak,
          longestDailyStreak:
            status?.longestStreak ?? result.progression.longestDailyStreak,
          nextDailyClaimAt:
            status?.nextClaimAt ?? result.progression.nextDailyClaimAt,
        },
        dailyRewardStatus: status,
        dailyRewardClaimStatus: 'success',
        pendingLevelUp,
        error: null,
      });

      trackEvent('daily_reward_claimed', {
        day: result.reward.day,
        xp: result.xpGranted,
        coins: result.blazeCoinsGranted,
      });
      if (result.streakContinued) {
        trackEvent('daily_streak_continued', {
          streak: result.progression.dailyStreak,
        });
      }
      if (result.streakReset) {
        trackEvent('daily_streak_reset');
      }
      if (result.xpGranted > 0) {
        trackEvent('xp_earned', {
          amount: result.xpGranted,
          source: 'daily_reward',
        });
      }
      if (pendingLevelUp) {
        trackEvent('level_up', {
          levelBefore: pendingLevelUp.levelBefore,
          levelAfter: pendingLevelUp.levelAfter,
        });
        for (const reward of pendingLevelUp.rewards) {
          trackEvent('level_reward_granted', { level: reward.level });
        }
      }

      void useWalletStore.getState().refreshWallet();
      return true;
    } catch (error) {
      set({
        dailyRewardClaimStatus: 'error',
        error: toErrorMessage(error, 'Unable to claim daily reward.'),
      });
      return false;
    } finally {
      dailyClaimInFlight = false;
    }
  },

  loadDailyMissions: async () => {
    try {
      const missions = await loadDailyMissionsRemote();
      set({ dailyMissions: missions, error: null });
      trackEvent('daily_missions_viewed', {
        claimable: missions.claimableCount,
      });
    } catch (error) {
      trackEvent('progression_sync_failed', { source: 'daily_missions' });
      set({
        error: toErrorMessage(error, 'Unable to load daily missions.'),
      });
    }
  },

  claimMission: async (missionId: string) => {
    if (!missionId || missionClaimInFlight.has(missionId)) {
      return false;
    }
    missionClaimInFlight.add(missionId);
    set({ missionClaimStatus: 'claiming', error: null });
    try {
      const levelBefore = get().progression?.level ?? 1;
      const result = await claimDailyMissionRemote(missionId);

      const eventKey = `mission:${missionId}:${result.progression.totalXp}:${result.progression.level}`;
      const pendingLevelUp =
        buildPendingLevelUp({
          levelBefore,
          levelAfter: result.progression.level,
          levelsCrossed: result.levelsCrossed,
          rewards: result.rewardsGranted,
          eventKey,
        }) ?? get().pendingLevelUp;

      const currentMissions = get().dailyMissions;
      let nextMissions = result.missions ?? currentMissions;
      if (!result.missions && currentMissions) {
        nextMissions = {
          ...currentMissions,
          missions: currentMissions.missions.map((mission) =>
            mission.id === missionId ? result.mission : mission,
          ),
          claimableCount: currentMissions.missions.filter((mission) => {
            const updated = mission.id === missionId ? result.mission : mission;
            return updated.isComplete && !updated.isClaimed;
          }).length,
        };
      }

      set({
        progression: result.progression,
        dailyMissions: nextMissions,
        missionClaimStatus: 'success',
        pendingLevelUp,
        error: null,
      });

      trackEvent('daily_mission_claimed', {
        templateId: result.mission.templateId,
        xp: result.xpGranted,
        coins: result.blazeCoinsGranted,
      });
      if (result.mission.isComplete) {
        trackEvent('daily_mission_completed', {
          templateId: result.mission.templateId,
        });
      }
      if (result.xpGranted > 0) {
        trackEvent('xp_earned', {
          amount: result.xpGranted,
          source: 'daily_mission',
        });
      }
      if (pendingLevelUp) {
        trackEvent('level_up', {
          levelBefore: pendingLevelUp.levelBefore,
          levelAfter: pendingLevelUp.levelAfter,
        });
        for (const reward of pendingLevelUp.rewards) {
          trackEvent('level_reward_granted', { level: reward.level });
        }
      }

      void useWalletStore.getState().refreshWallet();
      return true;
    } catch (error) {
      set({
        missionClaimStatus: 'error',
        error: toErrorMessage(error, 'Unable to claim mission.'),
      });
      return false;
    } finally {
      missionClaimInFlight.delete(missionId);
    }
  },

  loadProgressionHistory: async (limit = 20) => {
    try {
      const recentTransactions = await loadProgressionHistoryRemote(limit);
      set({ recentTransactions, error: null });
    } catch (error) {
      set({
        error: toErrorMessage(error, 'Unable to load progression history.'),
      });
    }
  },

  acknowledgeLevelUp: () => {
    const pending = get().pendingLevelUp;
    if (pending) {
      lastAcknowledgedLevelUpKey = pending.eventKey;
    }
    set({ pendingLevelUp: null });
  },

  clearError: () => set({ error: null, dailyRewardClaimStatus: 'idle', missionClaimStatus: 'idle' }),
}));
