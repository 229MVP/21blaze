import { create } from 'zustand';

import {
  completeDailyChallenge,
  getTodayDailyChallenge,
  startDailyChallenge,
} from '../challenge/dailyChallengeClient';
import {
  deriveDailyChallengeUiStatus,
  isCachedDailyChallengeValid,
  type DailyChallengeUiStatus,
} from '../challenge/dailyChallengePolicy';
import { deriveAuthoritativeSeed } from '../challenge/seedDerivation';
import {
  getUtcChallengeDate,
  millisecondsUntilUtcChallengeEnd,
  utcNextMidnightForDate,
} from '../challenge/utcChallengeDate';
import type {
  DailyChallengeAttemptType,
  DailyChallengeCompletionSummary,
  DailyChallengeConfig,
  DailyChallengeRankedAttempt,
  DailyChallengeSession,
} from '../game/challenge/types';
import { supabase } from '../lib/supabase';
import { trackEvent } from '../monetization/analytics';
import { useDailyLeaderboardStore } from './useDailyLeaderboardStore';
import {
  clearPersistedDailyChallengeSession,
  loadPersistedDailyChallengeSession,
  savePersistedDailyChallengeSession,
} from '../storage/dailyChallengeSessionStorage';
import {
  loadCachedDailyChallenge,
  saveCachedDailyChallenge,
} from '../storage/dailyChallengeStorage';

type DailyChallengeStore = {
  challenge: DailyChallengeConfig | null;
  rankedAttempt: DailyChallengeRankedAttempt | null;
  activeSession: DailyChallengeSession | null;
  completionSummary: DailyChallengeCompletionSummary | null;
  submissionStatus: 'idle' | 'submitting' | 'completed' | 'failed';
  submissionError: string | null;
  uiStatus: DailyChallengeUiStatus;
  errorMessage: string | null;
  isStarting: boolean;
  hydrateStatus: (authOnline: boolean) => Promise<void>;
  startRankedAttempt: () => Promise<DailyChallengeSession>;
  resumeRankedAttempt: () => Promise<DailyChallengeSession>;
  startPracticeAttempt: () => Promise<DailyChallengeSession>;
  submitRankedCompletion: (input: {
    score: number;
    exact21Count: number;
    fiveCardClearCount: number;
    bustCount: number;
    cardsPlayed: number;
    completionMs: number;
  }) => Promise<void>;
  persistActiveSession: (session: DailyChallengeSession) => Promise<void>;
  clearActiveSession: () => void;
  getTimeRemainingMs: (nowMs?: number) => number;
  shouldShowBadge: (nowMs?: number) => boolean;
};

function mapChallengeRow(row: Awaited<ReturnType<typeof getTodayDailyChallenge>>): DailyChallengeConfig {
  return {
    challengeId: row.id,
    challengeDate: row.challengeDate,
    rulesVersion: row.rulesVersion,
    deckVersion: row.deckVersion,
    durationSeconds: row.durationSeconds,
    bustLimit: row.bustLimit,
    status: row.status,
  };
}

function mapStartToSession(
  start: {
    attemptId: string;
    challengeId: string;
    challengeDate: string;
    seed: string;
    rulesVersion: string;
    deckVersion: string;
    durationSeconds: number;
    bustLimit: number;
    startedAt: string;
    resumed: boolean;
  },
  attemptType: DailyChallengeAttemptType,
): DailyChallengeSession {
  const expiresAt = utcNextMidnightForDate(start.challengeDate).toISOString();
  return {
    challengeId: start.challengeId,
    attemptId: start.attemptId,
    attemptType,
    authoritativeSeed: start.seed,
    rulesVersion: start.rulesVersion,
    deckVersion: start.deckVersion,
    durationSeconds: start.durationSeconds,
    bustLimit: start.bustLimit,
    serverStartTime: start.startedAt,
    expiresAt,
    challengeDate: start.challengeDate,
    resumed: start.resumed,
  };
}

async function fetchRankedAttempt(challengeId: string): Promise<DailyChallengeRankedAttempt | null> {
  const { data, error } = await supabase
    .from('daily_challenge_attempts')
    .select(
      'id, status, verified_score, verified_exact_21_count, verified_five_card_clears, verified_bust_count, elapsed_time_ms, started_at, completed_at',
    )
    .eq('challenge_id', challengeId)
    .eq('attempt_type', 'ranked')
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return {
    id: data.id,
    status: data.status as DailyChallengeRankedAttempt['status'],
    verifiedScore: data.verified_score,
    exact21Count: data.verified_exact_21_count,
    fiveCardClearCount: data.verified_five_card_clears,
    bustCount: data.verified_bust_count,
    completionMs: data.elapsed_time_ms,
    startedAt: data.started_at,
    completedAt: data.completed_at,
  };
}

function recomputeUiStatus(
  state: Pick<
    DailyChallengeStore,
    'challenge' | 'rankedAttempt' | 'activeSession' | 'errorMessage' | 'uiStatus'
  >,
  authOnline: boolean,
): DailyChallengeUiStatus {
  const offline =
    state.uiStatus === 'offline' ||
    Boolean(state.errorMessage?.toLowerCase().includes('offline'));
  return deriveDailyChallengeUiStatus({
    challenge: state.challenge,
    rankedAttempt: state.rankedAttempt,
    activeSession: state.activeSession,
    offline,
    errorMessage: state.errorMessage,
    authOnline,
  });
}

export const useDailyChallengeStore = create<DailyChallengeStore>((set, get) => ({
  challenge: null,
  rankedAttempt: null,
  activeSession: null,
  completionSummary: null,
  submissionStatus: 'idle',
  submissionError: null,
  uiStatus: 'loading',
  errorMessage: null,
  isStarting: false,

  hydrateStatus: async (authOnline) => {
    set({ uiStatus: 'loading', errorMessage: null });

    const persisted = await loadPersistedDailyChallengeSession();
    const today = getUtcChallengeDate();

    if (persisted && persisted.challengeDate !== today) {
      await clearPersistedDailyChallengeSession();
    }

    const validPersisted =
      persisted && persisted.challengeDate === today ? persisted : null;

    if (!authOnline) {
      const cached = await loadCachedDailyChallenge();
      if (isCachedDailyChallengeValid(cached, Date.now())) {
        set({
          challenge: cached.challenge,
          activeSession: validPersisted,
          errorMessage: 'CONNECT ONLINE FOR A RANKED ATTEMPT',
          uiStatus: deriveDailyChallengeUiStatus({
            challenge: cached.challenge,
            rankedAttempt: null,
            activeSession: validPersisted,
            offline: true,
            errorMessage: 'offline',
            authOnline: false,
          }),
        });
        return;
      }
      set({
        uiStatus: 'sign_in_required',
        errorMessage: 'SIGN IN TO COMPETE',
      });
      return;
    }

    try {
      const todayRow = await getTodayDailyChallenge();
      const challenge = mapChallengeRow(todayRow);
      const rankedAttempt = await fetchRankedAttempt(challenge.challengeId);

      await saveCachedDailyChallenge({
        challenge,
        cachedAtMs: Date.now(),
      });

      const nextState = {
        challenge,
        rankedAttempt,
        activeSession:
          validPersisted &&
          validPersisted.challengeId === challenge.challengeId
            ? validPersisted
            : rankedAttempt?.status === 'started' || rankedAttempt?.status === 'created'
              ? validPersisted
              : null,
        errorMessage: null,
      };

      set({
        ...nextState,
        completionSummary:
          rankedAttempt?.status === 'completed' && rankedAttempt.verifiedScore != null
            ? {
                score: rankedAttempt.verifiedScore,
                exact21Count: rankedAttempt.exact21Count ?? 0,
                fiveCardClearCount: rankedAttempt.fiveCardClearCount ?? 0,
                bustCount: rankedAttempt.bustCount ?? 0,
                completionMs: rankedAttempt.completionMs ?? 0,
                rulesVersion: challenge.rulesVersion,
                alreadyCompleted: true,
              }
            : get().completionSummary,
        submissionStatus:
          rankedAttempt?.status === 'completed' ? 'completed' : get().submissionStatus,
        uiStatus: recomputeUiStatus({ ...get(), ...nextState }, true),
      });
    } catch (error) {
      const cached = await loadCachedDailyChallenge();
      const nowMs = Date.now();
      if (isCachedDailyChallengeValid(cached, nowMs)) {
        set({
          challenge: cached.challenge,
          activeSession: validPersisted,
          errorMessage: 'CONNECT ONLINE FOR A RANKED ATTEMPT',
          uiStatus: deriveDailyChallengeUiStatus({
            challenge: cached.challenge,
            rankedAttempt: get().rankedAttempt,
            activeSession: validPersisted,
            offline: true,
            errorMessage: 'offline',
            authOnline,
          }),
        });
        return;
      }
      set({
        errorMessage:
          error instanceof Error ? error.message : 'Unable to load Daily Challenge.',
        uiStatus: 'error',
      });
    }
  },

  startRankedAttempt: async () => {
    if (get().isStarting) {
      throw new Error('start_already_in_progress');
    }

    const existing = get().activeSession;
    if (existing?.attemptType === 'ranked') {
      return existing;
    }

    set({ isStarting: true });
    trackEvent('daily_challenge_start_requested');

    try {
      const result = await startDailyChallenge();

      if ('error' in result) {
        if (result.error === 'ALREADY_PLAYED') {
          await get().hydrateStatus(true);
          throw new Error('ALREADY_PLAYED');
        }
        throw new Error(result.error);
      }

      trackEvent('daily_challenge_started', { resumed: result.resumed ? 1 : 0 });

      const session = mapStartToSession(result, 'ranked');
      const challenge = get().challenge
        ? { ...get().challenge!, authoritativeSeed: session.authoritativeSeed }
        : {
            challengeId: session.challengeId,
            challengeDate: session.challengeDate,
            rulesVersion: session.rulesVersion,
            deckVersion: session.deckVersion,
            durationSeconds: session.durationSeconds,
            bustLimit: session.bustLimit,
            status: 'active',
            authoritativeSeed: session.authoritativeSeed,
          };

      await saveCachedDailyChallenge({ challenge, cachedAtMs: Date.now() });
      await savePersistedDailyChallengeSession(session);

      set({
        challenge,
        activeSession: session,
        isStarting: false,
        uiStatus: 'in_progress',
        errorMessage: null,
      });

      return session;
    } catch (error) {
      set({ isStarting: false });
      throw error;
    }
  },

  resumeRankedAttempt: async () => {
    const session = get().activeSession;
    if (session?.attemptType === 'ranked') {
      trackEvent('daily_challenge_resumed');
      return session;
    }

    const persisted = await loadPersistedDailyChallengeSession();
    if (persisted) {
      set({ activeSession: persisted, uiStatus: 'in_progress' });
      trackEvent('daily_challenge_resumed');
      return persisted;
    }

    return get().startRankedAttempt();
  },

  startPracticeAttempt: async () => {
    const challenge = get().challenge;
    if (!challenge) {
      throw new Error('challenge_not_loaded');
    }

    if (get().rankedAttempt?.status !== 'completed' && get().uiStatus !== 'completed') {
      throw new Error('practice_requires_completed_ranked');
    }

    const authoritativeSeed =
      challenge.authoritativeSeed ??
      deriveAuthoritativeSeed(challenge.challengeDate);

    trackEvent('daily_challenge_practice_started');

    const session: DailyChallengeSession = {
      challengeId: challenge.challengeId,
      attemptId: `practice-${challenge.challengeDate}`,
      attemptType: 'practice',
      authoritativeSeed,
      rulesVersion: challenge.rulesVersion,
      deckVersion: challenge.deckVersion,
      durationSeconds: challenge.durationSeconds,
      bustLimit: challenge.bustLimit,
      serverStartTime: new Date().toISOString(),
      expiresAt: utcNextMidnightForDate(challenge.challengeDate).toISOString(),
      challengeDate: challenge.challengeDate,
    };

    set({
      activeSession: session,
      uiStatus: 'practice_available',
    });

    return session;
  },

  submitRankedCompletion: async (input) => {
    const session = get().activeSession ?? (await loadPersistedDailyChallengeSession());
    if (!session || session.attemptType !== 'ranked') {
      return;
    }

    if (get().submissionStatus === 'submitting' || get().submissionStatus === 'completed') {
      return;
    }

    set({ submissionStatus: 'submitting', submissionError: null });
    trackEvent('daily_challenge_completed');

    try {
      const result = await completeDailyChallenge({
        attemptId: session.attemptId,
        score: input.score,
        exact21Count: input.exact21Count,
        fiveCardClearCount: input.fiveCardClearCount,
        bustCount: input.bustCount,
        cardsPlayed: input.cardsPlayed,
        completionMs: input.completionMs,
        rulesVersion: session.rulesVersion,
      });

      const summary: DailyChallengeCompletionSummary = {
        score: result.score,
        exact21Count: result.exact21Count,
        fiveCardClearCount: result.fiveCardClearCount,
        bustCount: result.bustCount,
        completionMs: result.completionMs,
        rulesVersion: result.rulesVersion,
        alreadyCompleted: result.alreadyCompleted,
        dailyRank: result.dailyRank ?? null,
        totalPlayers: result.totalPlayers,
        currentStreak: result.currentStreak,
        longestStreak: result.longestStreak,
      };

      if (result.currentStreak != null) {
        trackEvent('daily_streak_incremented', { streak: result.currentStreak });
      }

      await clearPersistedDailyChallengeSession();
      useDailyLeaderboardStore.getState().invalidateCache();
      void useDailyLeaderboardStore.getState().loadStreakStatus({ refresh: true });

      const rankedAttempt: DailyChallengeRankedAttempt = {
        id: session.attemptId,
        status: 'completed',
        verifiedScore: result.score,
        exact21Count: result.exact21Count,
        fiveCardClearCount: result.fiveCardClearCount,
        bustCount: result.bustCount,
        completionMs: result.completionMs,
        startedAt: session.serverStartTime,
        completedAt: new Date().toISOString(),
      };

      set({
        rankedAttempt,
        activeSession: null,
        completionSummary: summary,
        submissionStatus: 'completed',
        submissionError: null,
        uiStatus: 'completed',
      });
    } catch (error) {
      trackEvent('daily_challenge_submit_failed');
      set({
        submissionStatus: 'failed',
        submissionError:
          error instanceof Error ? error.message : 'Failed to submit Daily Challenge.',
      });
      throw error;
    }
  },

  persistActiveSession: async (session) => {
    if (session.attemptType === 'ranked') {
      await savePersistedDailyChallengeSession(session);
    }
    set({ activeSession: session, uiStatus: 'in_progress' });
  },

  clearActiveSession: () => {
    set({ activeSession: null });
  },

  getTimeRemainingMs: (nowMs = Date.now()) => {
    const challenge = get().challenge;
    if (!challenge) {
      return 0;
    }
    return millisecondsUntilUtcChallengeEnd(challenge.challengeDate, nowMs);
  },

  shouldShowBadge: (nowMs = Date.now()) => {
    const state = get();
    if (!state.challenge) {
      return false;
    }
    if (state.uiStatus === 'available') {
      return true;
    }
    if (state.uiStatus === 'in_progress') {
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
    completionSummary: null,
    submissionStatus: 'idle',
    submissionError: null,
    uiStatus: 'loading',
    errorMessage: null,
    isStarting: false,
  });
}

export type { DailyChallengeUiStatus };
export { getUtcChallengeDate };
