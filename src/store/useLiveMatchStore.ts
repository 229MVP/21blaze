import type { RealtimeChannel } from '@supabase/supabase-js';
import { AppState, type AppStateStatus } from 'react-native';
import { create } from 'zustand';

import { supabase } from '../lib/supabase';
import type { MoveLogEntry } from '../online/types';
import {
  createLiveRoom,
  getLiveMatchState,
  joinLiveRoom,
  leaveLiveMatch,
  LiveMatchServiceError,
  setLiveReady,
  submitLiveResult,
} from '../services/liveMatchService';
import type {
  LiveChannelStatus,
  LiveClientBroadcastEvent,
  LiveConnectionStatus,
  LiveGameplayFlash,
  LiveMatchStatePayload,
  LiveOpponentProgress,
  LivePresenceState,
  LiveSubmissionStatus,
} from '../live/types';
import { useAuthStore } from './useAuthStore';

const PROGRESS_THROTTLE_MS = 400;
const HEARTBEAT_MS = 5_000;
const STATE_POLL_MS = 8_000;

type LiveMatchStore = {
  matchState: LiveMatchStatePayload | null;
  roomCode: string | null;
  localReady: boolean;
  opponentReady: boolean;
  connectionStatus: LiveConnectionStatus;
  opponentProgress: LiveOpponentProgress | null;
  serverStartsAt: string | null;
  serverEndsAt: string | null;
  channelStatus: LiveChannelStatus;
  submissionStatus: LiveSubmissionStatus;
  finalResult: LiveMatchStatePayload | null;
  error: string | null;
  gameplayFlash: LiveGameplayFlash | null;
  isBusy: boolean;
  createRoom: () => Promise<boolean>;
  joinRoom: (roomCode: string) => Promise<boolean>;
  markReady: () => Promise<boolean>;
  connectChannel: () => Promise<void>;
  disconnectChannel: () => void;
  sendProgress: (progress: Omit<LiveOpponentProgress, 'updatedAt'>) => void;
  sendGameplayEvent: (
    event: Extract<LiveClientBroadcastEvent, 'lane_clear' | 'bust' | 'emote'>,
    message?: string,
  ) => void;
  submitResult: (moves: MoveLogEntry[]) => Promise<boolean>;
  reconnectToMatch: () => Promise<void>;
  leaveMatch: () => Promise<void>;
  resetLiveMatch: () => void;
  clearGameplayFlash: () => void;
  applyServerState: (state: LiveMatchStatePayload) => void;
};

let channel: RealtimeChannel | null = null;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;
let lastProgressSentAt = 0;
let appStateSubscription: { remove: () => void } | null = null;

function topicFor(matchId: string): string {
  return `live-match:${matchId}`;
}

function clearTimers(): void {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

function initialOpponentProgress(): LiveOpponentProgress {
  return {
    score: 0,
    multiplier: 1,
    busts: 0,
    cardsPlayed: 0,
    lanesCleared: 0,
    elapsedMilliseconds: 0,
    updatedAt: Date.now(),
  };
}

export const useLiveMatchStore = create<LiveMatchStore>((set, get) => ({
  matchState: null,
  roomCode: null,
  localReady: false,
  opponentReady: false,
  connectionStatus: 'idle',
  opponentProgress: null,
  serverStartsAt: null,
  serverEndsAt: null,
  channelStatus: 'idle',
  submissionStatus: 'idle',
  finalResult: null,
  error: null,
  gameplayFlash: null,
  isBusy: false,

  applyServerState: (state) => {
    set({
      matchState: state,
      roomCode: state.match.roomCode,
      localReady: Boolean(state.self.readyAt),
      opponentReady: Boolean(state.opponent?.readyAt),
      serverStartsAt: state.match.startsAt,
      serverEndsAt: state.match.endsAt,
      error: null,
      finalResult:
        state.match.status === 'completed' || state.match.status === 'forfeited'
          ? state
          : get().finalResult,
    });
  },

  createRoom: async () => {
    set({ isBusy: true, error: null });
    try {
      const response = await createLiveRoom();
      get().applyServerState(response.state);
      set({
        opponentProgress: initialOpponentProgress(),
        submissionStatus: 'idle',
        finalResult: null,
        isBusy: false,
      });
      await get().connectChannel();
      return true;
    } catch (error) {
      set({
        isBusy: false,
        error:
          error instanceof LiveMatchServiceError
            ? error.message
            : 'Unable to create room.',
      });
      return false;
    }
  },

  joinRoom: async (roomCode) => {
    set({ isBusy: true, error: null });
    try {
      const response = await joinLiveRoom(roomCode);
      get().applyServerState(response.state);
      set({
        opponentProgress: initialOpponentProgress(),
        submissionStatus: 'idle',
        finalResult: null,
        isBusy: false,
      });
      await get().connectChannel();
      return true;
    } catch (error) {
      set({
        isBusy: false,
        error:
          error instanceof LiveMatchServiceError
            ? error.message
            : 'Unable to join room.',
      });
      return false;
    }
  },

  markReady: async () => {
    const matchId = get().matchState?.match.id;
    if (!matchId) {
      return false;
    }
    set({ isBusy: true, error: null });
    try {
      const state = await setLiveReady(matchId);
      get().applyServerState(state);
      set({ localReady: true, isBusy: false });
      return true;
    } catch (error) {
      set({
        isBusy: false,
        error:
          error instanceof LiveMatchServiceError
            ? error.message
            : 'Unable to ready up.',
      });
      return false;
    }
  },

  connectChannel: async () => {
    const matchId = get().matchState?.match.id;
    const user = useAuthStore.getState().user;
    const profile = useAuthStore.getState().profile;
    if (!matchId || !user) {
      return;
    }

    get().disconnectChannel();
    set({ channelStatus: 'subscribing', connectionStatus: 'connecting' });

    const presence: LivePresenceState = {
      userId: user.id,
      displayName: profile?.display_name ?? 'Player',
      ready: get().localReady,
      connectedAt: new Date().toISOString(),
      appState: AppState.currentState === 'active' ? 'active' : 'background',
    };

    channel = supabase.channel(topicFor(matchId), {
      config: {
        private: true,
        presence: { key: user.id },
      },
    });

    const asRecord = (payload: unknown): Record<string, unknown> =>
      payload && typeof payload === 'object'
        ? (payload as Record<string, unknown>)
        : {};

    channel
      .on('broadcast', { event: 'progress' }, ({ payload }) => {
        const data = asRecord(payload);
        if (data.userId === user.id) {
          return;
        }
        set({
          opponentProgress: {
            score: typeof data.score === 'number' ? data.score : 0,
            multiplier: typeof data.multiplier === 'number' ? data.multiplier : 1,
            busts: typeof data.busts === 'number' ? data.busts : 0,
            cardsPlayed: typeof data.cardsPlayed === 'number' ? data.cardsPlayed : 0,
            lanesCleared:
              typeof data.lanesCleared === 'number' ? data.lanesCleared : 0,
            elapsedMilliseconds:
              typeof data.elapsedMilliseconds === 'number'
                ? data.elapsedMilliseconds
                : 0,
            updatedAt: Date.now(),
          },
        });
      })
      .on('broadcast', { event: 'lane_clear' }, ({ payload }) => {
        const data = asRecord(payload);
        if (data.userId === user.id) {
          return;
        }
        set({
          gameplayFlash: {
            id: `lane_clear-${Date.now()}`,
            type: 'lane_clear',
            message:
              typeof data.message === 'string' ? data.message : 'Opponent cleared a lane!',
            createdAt: Date.now(),
          },
        });
      })
      .on('broadcast', { event: 'bust' }, ({ payload }) => {
        const data = asRecord(payload);
        if (data.userId === user.id) {
          return;
        }
        set({
          gameplayFlash: {
            id: `bust-${Date.now()}`,
            type: 'bust',
            message: typeof data.message === 'string' ? data.message : 'Opponent busted!',
            createdAt: Date.now(),
          },
        });
      })
      .on('broadcast', { event: 'emote' }, ({ payload }) => {
        const data = asRecord(payload);
        if (data.userId === user.id) {
          return;
        }
        set({
          gameplayFlash: {
            id: `emote-${Date.now()}`,
            type: 'emote',
            message: typeof data.message === 'string' ? data.message : 'Opponent emote',
            createdAt: Date.now(),
          },
        });
      })
      .on('broadcast', { event: 'match_start' }, ({ payload }) => {
        const data = asRecord(payload);
        set({
          serverStartsAt:
            typeof data.startsAt === 'string' ? data.startsAt : get().serverStartsAt,
          serverEndsAt:
            typeof data.endsAt === 'string' ? data.endsAt : get().serverEndsAt,
        });
        void get().reconnectToMatch();
      });

    const refreshEvents = [
      'opponent_joined',
      'both_ready',
      'match_completed',
      'match_cancelled',
      'player_forfeited',
      'player_ready',
      'opponent_finished',
      'player_finished',
      'player_reconnected',
      'player_disconnected',
    ] as const;

    for (const eventName of refreshEvents) {
      channel.on('broadcast', { event: eventName }, () => {
        void get().reconnectToMatch();
      });
    }

    channel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          set({ channelStatus: 'subscribed', connectionStatus: 'connected' });
          await channel?.track(presence);

          clearTimers();
          heartbeatTimer = setInterval(() => {
            void channel?.send({
              type: 'broadcast',
              event: 'heartbeat',
              payload: { userId: user.id, at: Date.now() },
            });
          }, HEARTBEAT_MS);

          pollTimer = setInterval(() => {
            void get().reconnectToMatch();
          }, STATE_POLL_MS);
        } else if (status === 'CHANNEL_ERROR') {
          set({ channelStatus: 'error', connectionStatus: 'reconnecting' });
        } else if (status === 'CLOSED') {
          set({ channelStatus: 'closed', connectionStatus: 'disconnected' });
        }
      });

    if (!appStateSubscription) {
      appStateSubscription = AppState.addEventListener(
        'change',
        (next: AppStateStatus) => {
          const currentUser = useAuthStore.getState().user;
          if (!currentUser || !channel) {
            return;
          }
          void channel.track({
            userId: currentUser.id,
            displayName: useAuthStore.getState().profile?.display_name ?? 'Player',
            ready: get().localReady,
            connectedAt: new Date().toISOString(),
            appState: next === 'active' ? 'active' : 'background',
          } satisfies LivePresenceState);

          if (next === 'active') {
            void get().reconnectToMatch();
          }
        },
      );
    }
  },

  disconnectChannel: () => {
    clearTimers();
    if (channel) {
      void supabase.removeChannel(channel);
      channel = null;
    }
    set({ channelStatus: 'closed' });
  },

  sendProgress: (progress) => {
    const matchId = get().matchState?.match.id;
    const userId = useAuthStore.getState().user?.id;
    if (!matchId || !userId || !channel) {
      return;
    }

    const now = Date.now();
    if (now - lastProgressSentAt < PROGRESS_THROTTLE_MS) {
      return;
    }
    lastProgressSentAt = now;

    void channel.send({
      type: 'broadcast',
      event: 'progress',
      payload: {
        userId,
        ...progress,
      },
    });
  },

  sendGameplayEvent: (event, message) => {
    const userId = useAuthStore.getState().user?.id;
    if (!userId || !channel) {
      return;
    }
    void channel.send({
      type: 'broadcast',
      event,
      payload: {
        userId,
        message: message ?? null,
      },
    });
  },

  submitResult: async (moves) => {
    const matchId = get().matchState?.match.id;
    if (!matchId) {
      return false;
    }

    if (
      get().submissionStatus === 'submitting' ||
      get().submissionStatus === 'verified'
    ) {
      return get().submissionStatus === 'verified';
    }

    set({ submissionStatus: 'submitting', error: null });
    try {
      const response = await submitLiveResult(matchId, moves);
      if (!response.verified) {
        set({
          submissionStatus: 'rejected',
          error: response.rejectionReason ?? 'Result was not verified.',
        });
        return false;
      }

      if (response.state) {
        get().applyServerState(response.state);
        set({ finalResult: response.state });
      }

      set({ submissionStatus: 'verified' });
      return true;
    } catch (error) {
      set({
        submissionStatus: 'failed',
        error:
          error instanceof LiveMatchServiceError
            ? error.message
            : 'Unable to submit live result.',
      });
      return false;
    }
  },

  reconnectToMatch: async () => {
    const matchId = get().matchState?.match.id;
    if (!matchId) {
      return;
    }

    set({ connectionStatus: 'reconnecting' });
    try {
      const state = await getLiveMatchState(matchId);
      get().applyServerState(state);
      set({ connectionStatus: 'connected', error: null });

      if (get().channelStatus !== 'subscribed') {
        await get().connectChannel();
      }
    } catch (error) {
      set({
        connectionStatus: 'disconnected',
        error:
          error instanceof LiveMatchServiceError
            ? error.message
            : 'Unable to reconnect.',
      });
    }
  },

  leaveMatch: async () => {
    const matchId = get().matchState?.match.id;
    get().disconnectChannel();
    if (matchId) {
      try {
        await leaveLiveMatch(matchId);
      } catch {
        // Leaving is best-effort; local reset still proceeds.
      }
    }
    get().resetLiveMatch();
  },

  resetLiveMatch: () => {
    get().disconnectChannel();
    if (appStateSubscription) {
      appStateSubscription.remove();
      appStateSubscription = null;
    }
    lastProgressSentAt = 0;
    set({
      matchState: null,
      roomCode: null,
      localReady: false,
      opponentReady: false,
      connectionStatus: 'idle',
      opponentProgress: null,
      serverStartsAt: null,
      serverEndsAt: null,
      channelStatus: 'idle',
      submissionStatus: 'idle',
      finalResult: null,
      error: null,
      gameplayFlash: null,
      isBusy: false,
    });
  },

  clearGameplayFlash: () => {
    set({ gameplayFlash: null });
  },
}));
