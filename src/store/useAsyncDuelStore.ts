import { create } from 'zustand';

import type { AsyncDuelSession } from '../asyncDuel/asyncDuelSession';
import type {
  AsyncDuelCompletionResult,
  AsyncDuelHistoryItem,
  AsyncDuelInboxItem,
  AsyncDuelStartResult,
} from '../asyncDuel/asyncDuelTypes';
import { trackEvent } from '../monetization/analytics';
import {
  AsyncDuelServiceError,
  cancelAsyncDuel,
  completeAsyncDuelAttempt,
  createAsyncDuel,
  declineAsyncDuel,
  getAsyncDuelActive,
  getAsyncDuelDetails,
  getAsyncDuelHistory,
  getAsyncDuelInbox,
  getAsyncDuelResult,
  searchAsyncDuelOpponents,
  startAsyncDuelOpponentAttempt,
  type AsyncDuelActiveItem,
  type AsyncDuelOpponentSearchItem,
} from '../services/asyncDuelService';

type HubTab = 'incoming' | 'active' | 'history';
type MutationKind = 'idle' | 'pending' | 'success' | 'error';

type AsyncDuelStore = {
  hubTab: HubTab;
  inbox: AsyncDuelInboxItem[];
  active: AsyncDuelActiveItem[];
  history: AsyncDuelHistoryItem[];
  searchResults: AsyncDuelOpponentSearchItem[];
  inboxCount: number;
  isLoadingHub: boolean;
  isSearching: boolean;
  errorMessage: string | null;
  createStatus: MutationKind;
  acceptStatus: MutationKind;
  declineStatus: MutationKind;
  cancelStatus: MutationKind;
  completeStatus: MutationKind;
  lastStart: AsyncDuelStartResult | null;
  lastCompletion: AsyncDuelCompletionResult | null;
  selectedDetails: Record<string, unknown> | null;
  setHubTab: (tab: HubTab) => void;
  refreshHub: () => Promise<void>;
  searchOpponents: (query: string) => Promise<void>;
  createChallenge: (input: {
    opponentId: string;
    opponentDisplayName: string;
  }) => Promise<AsyncDuelSession | null>;
  acceptChallenge: (input: {
    duelId: string;
    opponentDisplayName: string;
    targetScore: number | null;
  }) => Promise<AsyncDuelSession | null>;
  declineChallenge: (duelId: string) => Promise<boolean>;
  cancelChallenge: (duelId: string) => Promise<boolean>;
  loadDetails: (duelId: string) => Promise<Record<string, unknown> | null>;
  loadResult: (duelId: string) => Promise<AsyncDuelCompletionResult | null>;
  submitCompletion: (input: {
    attemptId: string;
    score: number;
    exact21Count: number;
    fiveCardClearCount: number;
    bustCount: number;
    cardsPlayed: number;
    lanesCleared: number;
    completionMs: number;
    rulesVersion: string;
    deckVersion: string;
  }) => Promise<AsyncDuelCompletionResult | null>;
  clearError: () => void;
  resetForAccountSwitch: () => void;
};

function toSession(
  start: AsyncDuelStartResult,
  opponentDisplayName: string,
  targetScore: number | null,
): AsyncDuelSession {
  return {
    duelId: start.duelId,
    attemptId: start.attemptId,
    participantRole: start.participantRole,
    authoritativeSeed: start.seed,
    rulesVersion: start.rulesVersion,
    deckVersion: start.deckVersion,
    durationSeconds: start.durationSeconds,
    bustLimit: start.bustLimit,
    serverStartTime: new Date().toISOString(),
    expiresAt: start.expiresAt,
    opponentDisplayName,
    targetScore,
    resumed: Boolean(start.alreadyStarted),
  };
}

function errMessage(error: unknown): string {
  if (error instanceof AsyncDuelServiceError) {
    return error.code;
  }
  return 'UNKNOWN';
}

export const useAsyncDuelStore = create<AsyncDuelStore>((set, get) => ({
  hubTab: 'incoming',
  inbox: [],
  active: [],
  history: [],
  searchResults: [],
  inboxCount: 0,
  isLoadingHub: false,
  isSearching: false,
  errorMessage: null,
  createStatus: 'idle',
  acceptStatus: 'idle',
  declineStatus: 'idle',
  cancelStatus: 'idle',
  completeStatus: 'idle',
  lastStart: null,
  lastCompletion: null,
  selectedDetails: null,

  setHubTab: (tab) => set({ hubTab: tab }),

  clearError: () => set({ errorMessage: null }),

  resetForAccountSwitch: () => {
    set({
      inbox: [],
      active: [],
      history: [],
      searchResults: [],
      inboxCount: 0,
      errorMessage: null,
      lastStart: null,
      lastCompletion: null,
      selectedDetails: null,
      createStatus: 'idle',
      acceptStatus: 'idle',
      declineStatus: 'idle',
      cancelStatus: 'idle',
      completeStatus: 'idle',
    });
  },

  refreshHub: async () => {
    set({ isLoadingHub: true, errorMessage: null });
    try {
      const [inbox, active, history] = await Promise.all([
        getAsyncDuelInbox({ limit: 20 }),
        getAsyncDuelActive({ limit: 20 }),
        getAsyncDuelHistory({ limit: 20 }),
      ]);
      set({
        inbox: inbox.items,
        active: active.items,
        history: history.items,
        inboxCount: inbox.items.length,
        isLoadingHub: false,
      });
    } catch (error) {
      set({
        isLoadingHub: false,
        errorMessage: errMessage(error),
      });
    }
  },

  searchOpponents: async (query) => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      set({ searchResults: [], isSearching: false });
      return;
    }
    set({ isSearching: true, errorMessage: null });
    try {
      const result = await searchAsyncDuelOpponents({ query: trimmed, limit: 20 });
      set({ searchResults: result.items, isSearching: false });
      trackEvent('duel_player_search_used', { count: result.items.length });
    } catch (error) {
      set({ isSearching: false, errorMessage: errMessage(error), searchResults: [] });
    }
  },

  createChallenge: async ({ opponentId, opponentDisplayName }) => {
    if (get().createStatus === 'pending') {
      return null;
    }
    set({ createStatus: 'pending', errorMessage: null });
    try {
      const start = await createAsyncDuel(opponentId);
      set({ createStatus: 'success', lastStart: start });
      trackEvent('duel_created');
      return toSession(start, opponentDisplayName, null);
    } catch (error) {
      // Uncertain network: reconcile with active duels before treating as failure.
      try {
        const active = await getAsyncDuelActive({ limit: 20 });
        const existing = active.items.find(
          (item) =>
            item.opponent.userId === opponentId &&
            (item.status === 'challenger_playing' ||
              item.status === 'awaiting_opponent' ||
              item.status === 'opponent_playing'),
        );
        if (existing) {
          const details = await getAsyncDuelDetails(existing.duelId);
          set({
            createStatus: 'error',
            errorMessage: 'DUPLICATE_ACTIVE_DUEL',
            selectedDetails: details,
          });
          return null;
        }
      } catch {
        // fall through to original error
      }
      set({ createStatus: 'error', errorMessage: errMessage(error) });
      return null;
    }
  },

  acceptChallenge: async ({ duelId, opponentDisplayName, targetScore }) => {
    if (get().acceptStatus === 'pending') {
      return null;
    }
    set({ acceptStatus: 'pending', errorMessage: null });
    try {
      const start = await startAsyncDuelOpponentAttempt(duelId);
      set({ acceptStatus: 'success', lastStart: start });
      trackEvent('duel_accepted');
      return toSession(start, opponentDisplayName, targetScore);
    } catch (error) {
      set({ acceptStatus: 'error', errorMessage: errMessage(error) });
      return null;
    }
  },

  declineChallenge: async (duelId) => {
    if (get().declineStatus === 'pending') {
      return false;
    }
    set({ declineStatus: 'pending', errorMessage: null });
    try {
      await declineAsyncDuel(duelId);
      set({ declineStatus: 'success' });
      trackEvent('duel_declined');
      await get().refreshHub();
      return true;
    } catch (error) {
      set({ declineStatus: 'error', errorMessage: errMessage(error) });
      return false;
    }
  },

  cancelChallenge: async (duelId) => {
    if (get().cancelStatus === 'pending') {
      return false;
    }
    set({ cancelStatus: 'pending', errorMessage: null });
    try {
      await cancelAsyncDuel(duelId);
      set({ cancelStatus: 'success' });
      await get().refreshHub();
      return true;
    } catch (error) {
      set({ cancelStatus: 'error', errorMessage: errMessage(error) });
      return false;
    }
  },

  loadDetails: async (duelId) => {
    try {
      const details = await getAsyncDuelDetails(duelId);
      set({ selectedDetails: details });
      return details;
    } catch (error) {
      set({ errorMessage: errMessage(error), selectedDetails: null });
      return null;
    }
  },

  loadResult: async (duelId) => {
    try {
      // Clear stale settlement from a previous duel before loading.
      set({ lastCompletion: null, errorMessage: null });
      const result = await getAsyncDuelResult(duelId);
      set({ lastCompletion: result });
      trackEvent('duel_result_viewed');
      return result;
    } catch (error) {
      set({ errorMessage: errMessage(error), lastCompletion: null });
      return null;
    }
  },

  submitCompletion: async (input) => {
    if (get().completeStatus === 'pending') {
      return get().lastCompletion;
    }
    set({ completeStatus: 'pending', errorMessage: null });
    try {
      const result = await completeAsyncDuelAttempt(input.attemptId, {
        score: input.score,
        exact21Count: input.exact21Count,
        fiveCardClearCount: input.fiveCardClearCount,
        bustCount: input.bustCount,
        cardsPlayed: input.cardsPlayed,
        lanesCleared: input.lanesCleared,
        completionMs: input.completionMs,
        rulesVersion: input.rulesVersion,
        deckVersion: input.deckVersion,
      });
      set({ completeStatus: 'success', lastCompletion: result });
      if (result.settled || result.status === 'completed') {
        trackEvent('duel_opponent_completed');
      } else {
        trackEvent('duel_challenger_completed');
      }
      return result;
    } catch (error) {
      // Reconcile: if already completed, fetch result
      try {
        const details = await getAsyncDuelDetails(
          get().lastStart?.duelId ?? '',
        );
        if (details && details.status) {
          const duelId = String(details.duelId ?? get().lastStart?.duelId ?? '');
          if (duelId) {
            const existing = await getAsyncDuelResult(duelId);
            set({ completeStatus: 'success', lastCompletion: existing });
            return existing;
          }
        }
      } catch {
        // fall through
      }
      set({ completeStatus: 'error', errorMessage: errMessage(error) });
      return null;
    }
  },
}));

export function __resetAsyncDuelStoreForTests(): void {
  useAsyncDuelStore.getState().resetForAccountSwitch();
}
