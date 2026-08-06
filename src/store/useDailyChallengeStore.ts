import { create } from 'zustand';

import {
  getUtcChallengeDate,
  isChallengeDateActive,
  millisecondsUntilChallengeEnds,
} from '../game/challenge/createDailyChallenge';
import type {
  DailyChallengeAttemptType,
  DailyChallengeConfig,
  DailyChallengeSession,
  DailyChallengeVerifiedResult,
} from '../game/challenge/types';
import { trackEvent } from '../monetization/analytics';
import type { MoveLogEntry } from '../online/types';
import {
  DailyChallengeServiceError,
  abandonDailyChallengeAttempt,
  completeDailyChallengeAttempt,
  fetchDailyChallengeLeaderboard,
  fetchDailyChallengeStatus,
  recordDailyChallengeFirstMove,
  startDailyChallengeAttempt,
  toDailyChallengeSession,
  type DailyChallengeAttemptSummary,
  type DailyChallengeLeaderboardEntry,
} from '../services/dailyChallengeService';
import {
  deriveDailyChallengeUiStatus,
  isCachedDailyChallengeValid as isCachedDailyChallengeValidPure,
  type DailyChallengeUiStatus,
} from '../challenge/dailyChallengePolicy';
import {
  loadCachedDailyChallenge,
  saveCachedDailyChallenge,
} from '../storage/dailyChallengeStorage';
import { useProgressionStore } from './useProgressionStore';
import { useWalletStore } from './useWalletStore';

type DailyChallengeStore = {
  challenge: DailyChallengeConfig | null;
  rankedAttempt: DailyChallengeAttemptSummary | null;
  activeSession: DailyChallengeSession | null;
  verifiedResult: DailyChallengeVerifiedResult | null;
  verificationStatus: 'idle' | 'submitting' | 'verified' | 'rejected' | 'failed';
  rejectionReason: string | null;
  streakCurrent: number;
  streakLongest: number;
  serverTime: string | null;
  uiStatus: DailyChallengeUiStatus;
  errorMessage: string | null;
  leaderboardEntries: DailyChallengeLeaderboardEntry[];
  leaderboardLoading: boolean;
  hydrateStatus: () => Promise<void>;
  startAttempt: (attemptType: DailyChallengeAttemptType) => Promise<DailyChallengeSession>;
  recordFirstMove: () => Promise<void>;
  submitAttempt: (moves: MoveLogEntry[]) => Promise<void>;
  abandonActiveAttempt: () => Promise<void>;
  clearActiveSession: () => void;
  loadLeaderboard: (challengeDate?: string) => Promise<void>;
  getTimeRemainingMs: (nowMs?: number) => number;
  shouldShowBadge: (nowMs?: number) => boolean;
};

export const useDailyChallengeStore = create<DailyChallengeStore>((set, get) => ({
  challenge: null,
  rankedAttempt: null,
  activeSession: null,
  verifiedResult: null,
  verificationStatus: 'idle',
  rejectionReason: null,
  streakCurrent: 0,
  streakLongest: 0,
  serverTime: null,
  uiStatus: 'loading',
  errorMessage: null,
  leaderboardEntries: [],
  leaderboardLoading: false,

  hydrateStatus: async () => {
    set({ uiStatus: 'loading', errorMessage: null });

    try {
      const response = await fetchDailyChallengeStatus();
      await saveCachedDailyChallenge({
        challenge: response.challenge,
        serverTime: response.serverTime,
        cachedAtMs: Date.now(),
      });

      set({
        challenge: response.challenge,
        rankedAttempt: response.rankedAttempt,
        streakCurrent: response.streak.current,
        streakLongest: response.streak.longest,
        serverTime: response.serverTime,
        errorMessage: null,
        uiStatus: deriveDailyChallengeUiStatus({
          challenge: response.challenge,
          rankedAttempt: response.rankedAttempt,
          activeSession: get().activeSession,
          offline: false,
          errorMessage: null,
        }),
      });
    } catch (error) {
      const cached = await loadCachedDailyChallenge();
      const nowMs = Date.now();
      const offline = error instanceof DailyChallengeServiceError;

      if (isCachedDailyChallengeValidPure(cached, nowMs)) {
        set({
          challenge: cached.challenge,
          serverTime: cached.serverTime,
          errorMessage: offline ? 'CONNECT ONLINE FOR A RANKED ATTEMPT' : null,
          uiStatus: deriveDailyChallengeUiStatus({
            challenge: cached.challenge,
            rankedAttempt: get().rankedAttempt,
            activeSession: get().activeSession,
            offline: true,
            errorMessage: offline ? 'offline' : null,
          }),
        });
        return;
      }

      set({
        errorMessage:
          error instanceof Error ? error.message : 'Unable to load Daily Challenge.',
        uiStatus: offline ? 'offline' : 'error',
      });
    }
  },

  startAttempt: async (attemptType) => {
    if (attemptType === 'ranked') {
      trackEvent('daily_challenge_ranked_started');
    } else {
      trackEvent('daily_challenge_practice_started');
    }

    const response = await startDailyChallengeAttempt(attemptType);
    const session = toDailyChallengeSession(response);

    await saveCachedDailyChallenge({
      challenge: response.challenge,
      serverTime: response.serverTime,
      cachedAtMs: Date.now(),
    });

    set({
      challenge: response.challenge,
      rankedAttempt:
        attemptType === 'ranked' ? response.attempt : get().rankedAttempt,
      activeSession: session,
      verifiedResult: null,
      verificationStatus: 'idle',
      rejectionReason: null,
      serverTime: response.serverTime,
      uiStatus: 'in_progress',
      errorMessage: null,
    });

    return session;
  },

  recordFirstMove: async () => {
    const session = get().activeSession;
    if (!session) {
      return;
    }

    trackEvent('daily_challenge_first_move', {
      attemptType: session.attemptType,
    });

    try {
      await recordDailyChallengeFirstMove(session.attemptId);
    } catch {
      // Non-blocking — server will still reject invalid replays.
    }
  },

  submitAttempt: async (moves) => {
    const session = get().activeSession;
    if (!session) {
      return;
    }

    if (session.attemptType === 'practice') {
      set({
        activeSession: null,
        uiStatus: 'available',
      });
      return;
    }

    set({ verificationStatus: 'submitting', rejectionReason: null });
    trackEvent('daily_challenge_verification_started');

    try {
      const response = await completeDailyChallengeAttempt(session.attemptId, moves);

      if (response.verified && response.result) {
        trackEvent('daily_challenge_verified');
        if (response.result.challengePoints != null) {
          trackEvent('challenge_points_awarded', {
            points: response.result.challengePoints,
          });
        }
        if (response.participationReward?.granted || response.result.participationCoins) {
          trackEvent('challenge_participation_reward_granted', {
            coins: response.participationReward?.blazeCoins ?? response.result.participationCoins ?? 20,
            xp: response.participationReward?.xp ?? response.result.participationXp ?? 75,
          });
        }
        set({
          verificationStatus: 'verified',
          verifiedResult: {
            ...response.result,
            participationCoins:
              response.participationReward?.blazeCoins ??
              response.result.participationCoins ??
              20,
            participationXp:
              response.participationReward?.xp ?? response.result.participationXp ?? 75,
          },
          rankedAttempt: response.attempt ?? get().rankedAttempt,
          activeSession: null,
          streakCurrent: response.streak?.currentStreak ?? get().streakCurrent,
          streakLongest: response.streak?.longestStreak ?? get().streakLongest,
          uiStatus: 'completed',
        });
        void useWalletStore.getState().refreshWallet();
        void useProgressionStore.getState().refreshProgression();
        return;
      }

      trackEvent('daily_challenge_rejected');
      set({
        verificationStatus: 'rejected',
        rejectionReason: response.rejectionReason ?? 'Verification failed.',
        activeSession: null,
        uiStatus: 'abandoned',
      });
    } catch (error) {
      trackEvent('daily_challenge_rejected');
      set({
        verificationStatus: 'failed',
        rejectionReason:
          error instanceof Error ? error.message : 'Verification failed.',
      });
    }
  },

  abandonActiveAttempt: async () => {
    const session = get().activeSession;
    if (!session) {
      return;
    }

    trackEvent('daily_challenge_abandoned', { attemptType: session.attemptType });

    try {
      await abandonDailyChallengeAttempt(session.attemptId);
    } catch {
      // Best effort.
    }

    set({
      activeSession: null,
      uiStatus:
        session.attemptType === 'ranked' && session.attemptId
          ? 'abandoned'
          : 'available',
    });
  },

  clearActiveSession: () => {
    set({ activeSession: null });
  },

  loadLeaderboard: async (challengeDate) => {
    set({ leaderboardLoading: true });
    trackEvent('daily_challenge_leaderboard_opened');

    try {
      const response = await fetchDailyChallengeLeaderboard(challengeDate);
      set({
        leaderboardEntries: response.entries,
        leaderboardLoading: false,
      });
    } catch {
      set({ leaderboardEntries: [], leaderboardLoading: false });
    }
  },

  getTimeRemainingMs: (nowMs = Date.now()) => {
    const challenge = get().challenge;
    if (!challenge) {
      return 0;
    }
    return millisecondsUntilChallengeEnds(challenge.challengeDate, nowMs);
  },

  shouldShowBadge: (nowMs = Date.now()) => {
    const state = get();
    if (!state.challenge) {
      return false;
    }
    if (state.uiStatus === 'available') {
      return true;
    }
    if (state.uiStatus === 'completed' && state.verificationStatus === 'verified') {
      return true;
    }
    const remaining = state.getTimeRemainingMs(nowMs);
    return remaining > 0 && remaining <= 2 * 60 * 60 * 1000;
  },
}));

export function __resetDailyChallengeStoreForTests(): void {
  useDailyChallengeStore.setState({
    challenge: null,
    rankedAttempt: null,
    activeSession: null,
    verifiedResult: null,
    verificationStatus: 'idle',
    rejectionReason: null,
    streakCurrent: 0,
    streakLongest: 0,
    serverTime: null,
    uiStatus: 'loading',
    errorMessage: null,
    leaderboardEntries: [],
    leaderboardLoading: false,
  });
}

export type { DailyChallengeUiStatus } from '../challenge/dailyChallengePolicy';
export { getUtcChallengeDate, isChallengeDateActive };
