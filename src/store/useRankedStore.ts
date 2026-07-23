import { AppState, type AppStateStatus } from 'react-native';
import { create } from 'zustand';

import {
  IDLE_RANKED_QUEUE_STATE,
  isRankedDivisionKey,
  normalizeRankedProfile,
  type RankedLeaderboardRow,
  type RankedMatchOutcome,
  type RankedMatchResult,
  type RankedOpponentProfile,
  type RankedProfile,
  type RankedQueueState,
  type RankedSeasonSummary,
  type RankedServerResponse,
} from '../ranked/types';
import type { QuickMatchStatus } from '../matchmaking/types';
import {
  acceptRankedMatch,
  cancelRankedMatch,
  declineRankedMatch,
  getRankedHistory,
  getRankedLeaderboard,
  getRankedProfile,
  joinRankedMatch,
  pollRankedMatch,
  RankedMatchServiceError,
  reconnectRankedMatch,
} from '../services/rankedMatchService';
import { useSettingsStore } from './useSettingsStore';

const POLL_INTERVAL_MS = 2000;

type RankedStore = RankedQueueState & {
  activeSeason: RankedSeasonSummary | null;
  rankedProfile: RankedProfile | null;
  leaderboard: RankedLeaderboardRow[];
  matchHistory: RankedMatchResult[];
  isHydrated: boolean;
  isLoading: boolean;
  isPolling: boolean;
  isBusy: boolean;
  hydrateRankedProfile: () => Promise<void>;
  joinRankedQueue: () => Promise<QuickMatchStatus>;
  pollRankedQueue: () => Promise<QuickMatchStatus>;
  acceptRankedMatch: () => Promise<QuickMatchStatus>;
  declineRankedMatch: () => Promise<QuickMatchStatus>;
  cancelRankedQueue: () => Promise<void>;
  reconnectRankedMatch: () => Promise<QuickMatchStatus>;
  loadRankedLeaderboard: () => Promise<void>;
  loadRankedHistory: () => Promise<void>;
  clearRankedError: () => void;
  resetRankedSession: () => void;
  startPolling: () => void;
  stopPolling: () => void;
};

let pollTimer: ReturnType<typeof setInterval> | null = null;
let joinInFlight = false;
let acceptInFlight = false;
let appStateSub: { remove: () => void } | null = null;
let lastPollAt = 0;

function mapSeason(
  value: RankedServerResponse['season'],
): RankedSeasonSummary | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const id = typeof value.id === 'string' ? value.id : null;
  const name = typeof value.name === 'string' ? value.name : null;
  const endsAtCandidate = (value as { ends_at?: unknown; endsAt?: unknown }).ends_at
    ?? (value as { endsAt?: unknown }).endsAt;
  const endsAt = typeof endsAtCandidate === 'string' ? endsAtCandidate : null;
  if (!id || !name || !endsAt) {
    return null;
  }
  return {
    id,
    name,
    slug: typeof value.slug === 'string' ? value.slug : undefined,
    status: typeof value.status === 'string' ? value.status : undefined,
    starts_at: typeof value.starts_at === 'string' ? value.starts_at : undefined,
    ends_at: endsAt,
  };
}

function mapResponse(
  response: RankedServerResponse,
): Partial<RankedQueueState> & {
  activeSeason?: RankedSeasonSummary | null;
  rankedProfile?: RankedProfile | null;
} {
  const opponent =
    response.opponent && typeof response.opponent === 'object'
      ? (response.opponent as RankedOpponentProfile)
      : null;
  const season = mapSeason(response.season ?? null);
  const rankedProfile = normalizeRankedProfile(
    response.rankedProfile as Record<string, unknown> | null | undefined,
  );

  const shared = {
    activeSeason: season,
    rankedProfile,
    ratingRange:
      typeof response.ratingRange === 'number' || response.ratingRange === null
        ? (response.ratingRange ?? null)
        : null,
    ratingRangeLabel:
      typeof response.ratingRangeLabel === 'string'
        ? response.ratingRangeLabel
        : null,
  };

  switch (response.status) {
    case 'queued':
      return {
        ...shared,
        status: 'queued',
        queueId: response.queueId ?? null,
        queuedAt: response.queuedAt ?? null,
        expiresAt: response.expiresAt ?? null,
        elapsedSeconds: response.elapsedSeconds ?? 0,
        region: response.region ?? null,
        matchId: null,
        opponent: null,
        acceptanceExpiresAt: null,
        localAccepted: false,
        opponentAccepted: false,
        error: null,
      };
    case 'match_found':
      return {
        ...shared,
        status: 'matchFound',
        matchId: response.matchId ?? null,
        opponent,
        acceptanceExpiresAt: response.acceptanceExpiresAt ?? null,
        localAccepted: Boolean(response.localAccepted),
        opponentAccepted: Boolean(response.opponentAccepted),
        error: null,
      };
    case 'awaiting_acceptance':
      return {
        ...shared,
        status: 'waitingForOpponent',
        matchId: response.matchId ?? null,
        opponent,
        acceptanceExpiresAt: response.acceptanceExpiresAt ?? null,
        localAccepted: true,
        opponentAccepted: Boolean(response.opponentAccepted),
        error: null,
      };
    case 'both_accepted':
      return {
        ...shared,
        status: 'countdown',
        matchId: response.matchId ?? null,
        opponent,
        acceptanceExpiresAt: response.acceptanceExpiresAt ?? null,
        localAccepted: true,
        opponentAccepted: true,
        seed: typeof response.seed === 'number' ? response.seed : null,
        startsAt: response.startsAt ?? null,
        endsAt: response.endsAt ?? null,
        error: null,
      };
    case 'cancelled':
      return {
        ...IDLE_RANKED_QUEUE_STATE,
        ...shared,
        status: 'cancelled',
      };
    case 'expired':
      return {
        ...IDLE_RANKED_QUEUE_STATE,
        ...shared,
        status: 'expired',
        error: response.error ?? 'Search expired.',
      };
    case 'already_in_match':
      return {
        ...shared,
        status: 'running',
        matchId: response.matchId ?? null,
        opponent,
        seed: typeof response.seed === 'number' ? response.seed : null,
        startsAt: response.startsAt ?? null,
        endsAt: response.endsAt ?? null,
        error: response.error ?? null,
      };
    case 'ok':
      return { ...shared };
    case 'failed':
      return {
        status: 'failed',
        error: response.error ?? 'Ranked matchmaking failed.',
        ...shared,
      };
    default:
      return { status: 'failed', error: 'Unexpected Ranked status.', ...shared };
  }
}

function clearPollTimer(): void {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

function mapHistoryRow(raw: Record<string, unknown>): RankedMatchResult | null {
  const matchId = typeof raw.matchId === 'string' ? raw.matchId : null;
  const result = typeof raw.result === 'string' ? raw.result : null;
  if (!matchId || !result) {
    return null;
  }

  const outcome = result as RankedMatchOutcome;
  const base = {
    matchId,
    result: outcome,
    opponentName:
      typeof raw.opponentName === 'string' ? raw.opponentName : 'Opponent',
    opponentDivision: isRankedDivisionKey(raw.opponentDivision)
      ? raw.opponentDivision
      : 'unranked',
    localScore: typeof raw.localScore === 'number' ? raw.localScore : 0,
    opponentScore: typeof raw.opponentScore === 'number' ? raw.opponentScore : 0,
    completedAt:
      typeof raw.completedAt === 'string' ? raw.completedAt : new Date().toISOString(),
    forfeit: Boolean(raw.forfeit),
  };

  if (
    typeof raw.ratingBefore === 'number' &&
    typeof raw.ratingAfter === 'number' &&
    typeof raw.ratingChange === 'number'
  ) {
    return {
      ...base,
      ratingBefore: raw.ratingBefore,
      ratingAfter: raw.ratingAfter,
      ratingChange: raw.ratingChange,
      placement: false,
    };
  }

  return {
    ...base,
    ratingBefore: null,
    ratingAfter: null,
    ratingChange: null,
    placement: true,
  };
}

export const useRankedStore = create<RankedStore>((set, get) => ({
  ...IDLE_RANKED_QUEUE_STATE,
  activeSeason: null,
  rankedProfile: null,
  leaderboard: [],
  matchHistory: [],
  isHydrated: false,
  isLoading: false,
  isPolling: false,
  isBusy: false,

  hydrateRankedProfile: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await getRankedProfile();
      const mapped = mapResponse(response);
      set({
        activeSeason: mapped.activeSeason ?? null,
        rankedProfile: mapped.rankedProfile ?? null,
        isHydrated: true,
        isLoading: false,
        error: mapped.error ?? null,
      });
    } catch (error) {
      set({
        isLoading: false,
        isHydrated: true,
        error:
          error instanceof RankedMatchServiceError
            ? error.message
            : 'Unable to load ranked profile.',
      });
    }
  },

  joinRankedQueue: async () => {
    if (joinInFlight) {
      return get().status;
    }
    joinInFlight = true;
    set({ status: 'joining', error: null, isBusy: true });

    try {
      const region = useSettingsStore.getState().settings.preferredRegion;
      const response = await joinRankedMatch(region);
      const mapped = mapResponse(response);
      set({
        ...mapped,
        isBusy: false,
        activeSeason: mapped.activeSeason ?? get().activeSeason,
        rankedProfile: mapped.rankedProfile ?? get().rankedProfile,
      });

      const status = mapped.status ?? 'failed';
      if (status === 'queued') {
        get().startPolling();
      } else {
        get().stopPolling();
      }
      return status;
    } catch (error) {
      set({
        status: 'failed',
        isBusy: false,
        error:
          error instanceof RankedMatchServiceError
            ? error.message
            : 'Unable to start Ranked matchmaking.',
      });
      get().stopPolling();
      return 'failed';
    } finally {
      joinInFlight = false;
    }
  },

  startPolling: () => {
    if (pollTimer) {
      return;
    }
    set({ isPolling: true });
    pollTimer = setInterval(() => {
      if (AppState.currentState !== 'active') {
        return;
      }
      void get().pollRankedQueue();
    }, POLL_INTERVAL_MS);

    if (!appStateSub) {
      appStateSub = AppState.addEventListener('change', (next: AppStateStatus) => {
        if (next === 'active') {
          void get().reconnectRankedMatch();
        } else {
          clearPollTimer();
          set({ isPolling: false });
        }
      });
    }
  },

  stopPolling: () => {
    clearPollTimer();
    set({ isPolling: false });
  },

  pollRankedQueue: async () => {
    const now = Date.now();
    if (now - lastPollAt < 1000) {
      return get().status;
    }
    lastPollAt = now;

    try {
      const response = await pollRankedMatch();
      const mapped = mapResponse(response);
      set({
        ...mapped,
        activeSeason: mapped.activeSeason ?? get().activeSeason,
        rankedProfile: mapped.rankedProfile ?? get().rankedProfile,
      });

      const status = mapped.status ?? get().status;
      if (status === 'queued') {
        if (!pollTimer) {
          get().startPolling();
        }
      } else {
        get().stopPolling();
      }
      return status;
    } catch (error) {
      set({
        error:
          error instanceof RankedMatchServiceError
            ? error.message
            : 'Unable to refresh ranked matchmaking.',
      });
      return get().status;
    }
  },

  acceptRankedMatch: async () => {
    const matchId = get().matchId;
    if (!matchId || acceptInFlight) {
      return get().status;
    }
    acceptInFlight = true;
    set({ status: 'accepting', isBusy: true, error: null });

    try {
      const response = await acceptRankedMatch(matchId);
      const mapped = mapResponse(response);
      set({ ...mapped, isBusy: false });
      get().stopPolling();
      return mapped.status ?? 'failed';
    } catch (error) {
      set({
        isBusy: false,
        status: 'matchFound',
        error:
          error instanceof RankedMatchServiceError
            ? error.message
            : 'Unable to accept ranked match.',
      });
      return 'matchFound';
    } finally {
      acceptInFlight = false;
    }
  },

  declineRankedMatch: async () => {
    const matchId = get().matchId;
    if (!matchId) {
      get().resetRankedSession();
      return 'cancelled';
    }
    set({ isBusy: true, error: null });
    try {
      const response = await declineRankedMatch(matchId);
      const mapped = mapResponse(response);
      set({ ...mapped, isBusy: false });
      get().stopPolling();
      return mapped.status ?? 'cancelled';
    } catch (error) {
      set({
        isBusy: false,
        error:
          error instanceof RankedMatchServiceError
            ? error.message
            : 'Unable to decline ranked match.',
      });
      return get().status;
    }
  },

  cancelRankedQueue: async () => {
    get().stopPolling();
    set({ isBusy: true, error: null });
    try {
      await cancelRankedMatch();
    } catch {
      // Best-effort.
    }
    set({
      ...IDLE_RANKED_QUEUE_STATE,
      status: 'cancelled',
      isBusy: false,
      activeSeason: get().activeSeason,
      rankedProfile: get().rankedProfile,
      leaderboard: get().leaderboard,
      matchHistory: get().matchHistory,
      isHydrated: get().isHydrated,
    });
  },

  reconnectRankedMatch: async () => {
    try {
      const response = await reconnectRankedMatch();
      const mapped = mapResponse(response);
      set({
        ...mapped,
        activeSeason: mapped.activeSeason ?? get().activeSeason,
        rankedProfile: mapped.rankedProfile ?? get().rankedProfile,
      });
      const status = mapped.status ?? 'idle';
      if (status === 'queued') {
        get().startPolling();
      } else {
        get().stopPolling();
      }
      return status;
    } catch (error) {
      set({
        error:
          error instanceof RankedMatchServiceError
            ? error.message
            : 'Unable to reconnect ranked session.',
      });
      return get().status;
    }
  },

  loadRankedLeaderboard: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await getRankedLeaderboard(100);
      const mapped = mapResponse(response);
      const rows = Array.isArray(response.rows)
        ? (response.rows as RankedLeaderboardRow[])
        : [];
      set({
        leaderboard: rows,
        activeSeason: mapped.activeSeason ?? get().activeSeason,
        isLoading: false,
      });
    } catch (error) {
      set({
        isLoading: false,
        error:
          error instanceof RankedMatchServiceError
            ? error.message
            : 'Unable to load ranked leaderboard.',
      });
    }
  },

  loadRankedHistory: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await getRankedHistory(20);
      const history = Array.isArray(response.history)
        ? response.history
            .map((row) => mapHistoryRow(row as Record<string, unknown>))
            .filter((row): row is RankedMatchResult => row !== null)
        : [];
      set({ matchHistory: history, isLoading: false });
    } catch (error) {
      set({
        isLoading: false,
        error:
          error instanceof RankedMatchServiceError
            ? error.message
            : 'Unable to load ranked history.',
      });
    }
  },

  clearRankedError: () => set({ error: null }),

  resetRankedSession: () => {
    get().stopPolling();
    joinInFlight = false;
    acceptInFlight = false;
    lastPollAt = 0;
    set({
      ...IDLE_RANKED_QUEUE_STATE,
      isPolling: false,
      isBusy: false,
      activeSeason: get().activeSeason,
      rankedProfile: get().rankedProfile,
      leaderboard: get().leaderboard,
      matchHistory: get().matchHistory,
      isHydrated: get().isHydrated,
    });
  },
}));
