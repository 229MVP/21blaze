import { create } from 'zustand';

import type { AsyncDuelSession } from '../asyncDuel/asyncDuelSession';
import type {
  AsyncDuelSeriesSummary,
  HeadToHeadRecord,
  PlayerDuelRecord,
} from '../asyncDuel/asyncDuelRecords';
import { trackEvent } from '../monetization/analytics';
import type {
  NotificationPreferences,
  PlayerNotification,
} from '../notifications/duelNotificationRegistry';
import {
  createAsyncDuelRematch,
  getAsyncDuelSeriesSummary,
  getHeadToHeadRecord,
  getMyDuelRecord,
  getNotificationPreferences,
  getPlayerNotifications,
  getUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead,
  updateNotificationPreferences,
} from '../services/duelNotificationService';
import { AsyncDuelServiceError } from '../services/asyncDuelService';

type MutationKind = 'idle' | 'pending' | 'success' | 'error';

type NotificationStore = {
  items: PlayerNotification[];
  unreadCount: number;
  preferences: NotificationPreferences | null;
  myRecord: PlayerDuelRecord | null;
  seriesSummary: AsyncDuelSeriesSummary | null;
  headToHead: HeadToHeadRecord | null;
  isLoading: boolean;
  rematchStatus: MutationKind;
  errorMessage: string | null;
  refreshNotifications: () => Promise<void>;
  refreshUnreadCount: () => Promise<void>;
  openNotification: (notificationId: string) => Promise<PlayerNotification | null>;
  markAllRead: () => Promise<void>;
  loadPreferences: () => Promise<void>;
  savePreferences: (input: Partial<NotificationPreferences>) => Promise<void>;
  loadMyRecord: () => Promise<void>;
  loadSeriesSummary: (duelId: string) => Promise<AsyncDuelSeriesSummary | null>;
  loadHeadToHead: (otherPlayerId: string) => Promise<HeadToHeadRecord | null>;
  startRematch: (sourceDuelId: string) => Promise<AsyncDuelSession | null>;
  clearError: () => void;
  resetForAccountSwitch: () => void;
};

function errCode(error: unknown): string {
  if (error instanceof AsyncDuelServiceError) {
    return error.code;
  }
  return 'UNKNOWN';
}

export const useDuelNotificationStore = create<NotificationStore>((set, get) => ({
  items: [],
  unreadCount: 0,
  preferences: null,
  myRecord: null,
  seriesSummary: null,
  headToHead: null,
  isLoading: false,
  rematchStatus: 'idle',
  errorMessage: null,

  clearError: () => set({ errorMessage: null }),

  resetForAccountSwitch: () => {
    set({
      items: [],
      unreadCount: 0,
      preferences: null,
      myRecord: null,
      seriesSummary: null,
      headToHead: null,
      isLoading: false,
      rematchStatus: 'idle',
      errorMessage: null,
    });
  },

  refreshUnreadCount: async () => {
    try {
      const count = await getUnreadNotificationCount();
      set({ unreadCount: count });
    } catch (error) {
      set({ errorMessage: errCode(error) });
    }
  },

  refreshNotifications: async () => {
    set({ isLoading: true, errorMessage: null });
    try {
      const [list, count] = await Promise.all([
        getPlayerNotifications({ limit: 30 }),
        getUnreadNotificationCount(),
      ]);
      set({
        items: list.items,
        unreadCount: count,
        isLoading: false,
      });
      trackEvent('notification_center_viewed', { count: list.items.length });
    } catch (error) {
      set({ isLoading: false, errorMessage: errCode(error) });
    }
  },

  openNotification: async (notificationId) => {
    const existing = get().items.find((n) => n.id === notificationId) ?? null;
    try {
      await markNotificationRead(notificationId);
      set((state) => ({
        items: state.items.map((n) =>
          n.id === notificationId
            ? { ...n, readAt: n.readAt ?? new Date().toISOString() }
            : n,
        ),
      }));
      await get().refreshUnreadCount();
      trackEvent('duel_notification_opened', {
        type: existing?.notificationType ?? 'unknown',
      });
      return existing;
    } catch (error) {
      set({ errorMessage: errCode(error) });
      return existing;
    }
  },

  markAllRead: async () => {
    try {
      await markAllNotificationsRead();
      set((state) => ({
        items: state.items.map((n) => ({
          ...n,
          readAt: n.readAt ?? new Date().toISOString(),
        })),
        unreadCount: 0,
      }));
    } catch (error) {
      set({ errorMessage: errCode(error) });
    }
  },

  loadPreferences: async () => {
    try {
      const preferences = await getNotificationPreferences();
      set({ preferences });
    } catch (error) {
      set({ errorMessage: errCode(error) });
    }
  },

  savePreferences: async (input) => {
    try {
      const preferences = await updateNotificationPreferences(input);
      set({ preferences });
    } catch (error) {
      set({ errorMessage: errCode(error) });
    }
  },

  loadMyRecord: async () => {
    try {
      const myRecord = await getMyDuelRecord();
      set({ myRecord });
      trackEvent('duel_record_viewed', { completed: myRecord.completedDuels });
    } catch (error) {
      set({ errorMessage: errCode(error) });
    }
  },

  loadSeriesSummary: async (duelId) => {
    try {
      const seriesSummary = await getAsyncDuelSeriesSummary(duelId);
      set({ seriesSummary, headToHead: seriesSummary.headToHead });
      trackEvent('head_to_head_viewed');
      return seriesSummary;
    } catch (error) {
      set({ errorMessage: errCode(error) });
      return null;
    }
  },

  loadHeadToHead: async (otherPlayerId) => {
    try {
      const headToHead = await getHeadToHeadRecord(otherPlayerId);
      set({ headToHead });
      return headToHead;
    } catch (error) {
      set({ errorMessage: errCode(error) });
      return null;
    }
  },

  startRematch: async (sourceDuelId) => {
    if (get().rematchStatus === 'pending') {
      return null;
    }
    set({ rematchStatus: 'pending', errorMessage: null });
    try {
      const result = await createAsyncDuelRematch(sourceDuelId);
      set({ rematchStatus: 'success' });
      trackEvent('duel_rematch_started', { alreadyExisted: result.alreadyExisted });
      return {
        duelId: result.duelId,
        attemptId: result.attemptId,
        participantRole: 'challenger',
        authoritativeSeed: result.seed,
        rulesVersion: result.rulesVersion,
        deckVersion: result.deckVersion,
        durationSeconds: result.durationSeconds,
        bustLimit: result.bustLimit,
        serverStartTime: new Date().toISOString(),
        expiresAt: result.expiresAt,
        opponentDisplayName:
          get().headToHead?.otherDisplayName ??
          get().seriesSummary?.headToHead.otherDisplayName ??
          'Opponent',
        targetScore: null,
        resumed: Boolean(result.alreadyExisted && result.alreadyStarted),
      };
    } catch (error) {
      set({ rematchStatus: 'error', errorMessage: errCode(error) });
      return null;
    }
  },
}));

export function __resetDuelNotificationStoreForTests(): void {
  useDuelNotificationStore.getState().resetForAccountSwitch();
}
