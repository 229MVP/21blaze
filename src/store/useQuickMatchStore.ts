import { AppState, type AppStateStatus } from 'react-native';
import { create } from 'zustand';

import {
  IDLE_QUICK_MATCH_STATE,
  type PublicPlayerProfile,
  type QuickMatchQueueState,
  type QuickMatchResponse,
  type QuickMatchStatus,
} from '../matchmaking/types';
import {
  acceptQuickMatch,
  cancelQuickMatch,
  declineQuickMatch,
  joinQuickMatch,
  pollQuickMatch,
  QuickMatchServiceError,
  reconnectQuickMatch,
} from '../services/quickMatchService';
import { useSettingsStore } from './useSettingsStore';

const POLL_INTERVAL_MS = 2000;

type QuickMatchStore = QuickMatchQueueState & {
  isPolling: boolean;
  isBusy: boolean;
  joinQueue: () => Promise<QuickMatchStatus>;
  startPolling: () => void;
  stopPolling: () => void;
  pollQueue: () => Promise<QuickMatchStatus>;
  acceptMatch: () => Promise<QuickMatchStatus>;
  declineMatch: () => Promise<QuickMatchStatus>;
  cancelQueue: () => Promise<void>;
  reconnect: () => Promise<QuickMatchStatus>;
  reset: () => void;
};

let pollTimer: ReturnType<typeof setInterval> | null = null;
let joinInFlight = false;
let acceptInFlight = false;
let appStateSub: { remove: () => void } | null = null;
let lastPollAt = 0;

function mapResponse(response: QuickMatchResponse): Partial<QuickMatchQueueState> {
  const opponent =
    response.opponent && typeof response.opponent === 'object'
      ? (response.opponent as PublicPlayerProfile)
      : null;

  switch (response.status) {
    case 'queued':
      return {
        status: 'queued',
        queueId: response.queueId,
        queuedAt: response.queuedAt,
        expiresAt: response.expiresAt,
        elapsedSeconds: response.elapsedSeconds,
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
        status: 'matchFound',
        matchId: response.matchId,
        opponent,
        acceptanceExpiresAt: response.acceptanceExpiresAt ?? null,
        localAccepted: Boolean(response.localAccepted),
        opponentAccepted: Boolean(response.opponentAccepted),
        error: null,
      };
    case 'awaiting_acceptance':
      return {
        status: 'waitingForOpponent',
        matchId: response.matchId,
        opponent,
        acceptanceExpiresAt: response.acceptanceExpiresAt ?? null,
        localAccepted: true,
        opponentAccepted: Boolean(response.opponentAccepted),
        error: null,
      };
    case 'both_accepted':
      return {
        status: 'countdown',
        matchId: response.matchId,
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
        ...IDLE_QUICK_MATCH_STATE,
        status: 'cancelled',
      };
    case 'expired':
      return {
        ...IDLE_QUICK_MATCH_STATE,
        status: 'expired',
        error: response.error ?? 'Search expired.',
      };
    case 'already_in_match':
      return {
        status: 'running',
        matchId: response.matchId ?? null,
        opponent,
        seed: typeof response.seed === 'number' ? response.seed : null,
        startsAt: response.startsAt ?? null,
        endsAt: response.endsAt ?? null,
        error: response.error ?? null,
      };
    case 'failed':
      return {
        status: 'failed',
        error: response.error ?? 'Quick Match failed.',
      };
    default:
      return { status: 'failed', error: 'Unexpected Quick Match status.' };
  }
}

function clearPollTimer(): void {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

export const useQuickMatchStore = create<QuickMatchStore>((set, get) => ({
  ...IDLE_QUICK_MATCH_STATE,
  isPolling: false,
  isBusy: false,

  joinQueue: async () => {
    if (joinInFlight) {
      return get().status;
    }
    joinInFlight = true;
    set({ status: 'joining', error: null, isBusy: true });

    try {
      const region = useSettingsStore.getState().settings.preferredRegion;
      const response = await joinQuickMatch(region);
      const mapped = mapResponse(response);
      set({ ...mapped, isBusy: false });

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
          error instanceof QuickMatchServiceError
            ? error.message
            : 'Unable to start Quick Match.',
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
      void get().pollQueue();
    }, POLL_INTERVAL_MS);

    if (!appStateSub) {
      appStateSub = AppState.addEventListener('change', (next: AppStateStatus) => {
        if (next === 'active') {
          void get().reconnect();
        } else {
          // Keep queue server-side; stop aggressive polling while backgrounded.
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

  pollQueue: async () => {
    const now = Date.now();
    if (now - lastPollAt < 1000) {
      return get().status;
    }
    lastPollAt = now;

    try {
      const response = await pollQuickMatch();
      const mapped = mapResponse(response);
      set({ ...mapped });

      const status = mapped.status ?? get().status;
      if (
        status === 'queued'
      ) {
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
          error instanceof QuickMatchServiceError
            ? error.message
            : 'Unable to refresh matchmaking.',
      });
      return get().status;
    }
  },

  acceptMatch: async () => {
    const matchId = get().matchId;
    if (!matchId || acceptInFlight) {
      return get().status;
    }
    acceptInFlight = true;
    set({ status: 'accepting', isBusy: true, error: null });

    try {
      const response = await acceptQuickMatch(matchId);
      const mapped = mapResponse(response);
      set({ ...mapped, isBusy: false });
      get().stopPolling();
      return mapped.status ?? 'failed';
    } catch (error) {
      set({
        isBusy: false,
        status: 'matchFound',
        error:
          error instanceof QuickMatchServiceError
            ? error.message
            : 'Unable to accept match.',
      });
      return 'matchFound';
    } finally {
      acceptInFlight = false;
    }
  },

  declineMatch: async () => {
    const matchId = get().matchId;
    if (!matchId) {
      get().reset();
      return 'cancelled';
    }
    set({ isBusy: true, error: null });
    try {
      const response = await declineQuickMatch(matchId);
      const mapped = mapResponse(response);
      set({ ...mapped, isBusy: false });
      get().stopPolling();
      return mapped.status ?? 'cancelled';
    } catch (error) {
      set({
        isBusy: false,
        error:
          error instanceof QuickMatchServiceError
            ? error.message
            : 'Unable to decline match.',
      });
      return get().status;
    }
  },

  cancelQueue: async () => {
    get().stopPolling();
    set({ isBusy: true, error: null });
    try {
      await cancelQuickMatch();
    } catch {
      // Cancel is best-effort / idempotent.
    }
    set({ ...IDLE_QUICK_MATCH_STATE, status: 'cancelled', isBusy: false });
  },

  reconnect: async () => {
    try {
      const response = await reconnectQuickMatch();
      const mapped = mapResponse(response);
      set({ ...mapped });
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
          error instanceof QuickMatchServiceError
            ? error.message
            : 'Unable to reconnect.',
      });
      return get().status;
    }
  },

  reset: () => {
    get().stopPolling();
    joinInFlight = false;
    acceptInFlight = false;
    lastPollAt = 0;
    set({ ...IDLE_QUICK_MATCH_STATE, isPolling: false, isBusy: false });
  },
}));
