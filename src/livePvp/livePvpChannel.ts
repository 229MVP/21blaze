import type { RealtimeChannel } from '@supabase/supabase-js';

import { supabase } from '../lib/supabase';
import { LIVE_PVP_CONFIG, livePvpTopicForMatch } from '../livePvp/livePvpConfig';
import {
  parseLivePvpRealtimeEvent,
  reconcileLivePvpEvent,
} from '../livePvp/livePvpProtocol';
import type { LiveMatchRealtimeEvent } from '../livePvp/livePvpTypes';

export type LivePvpChannelStatus =
  | 'idle'
  | 'subscribing'
  | 'subscribed'
  | 'error'
  | 'closed';

export type LivePvpPresenceView = {
  key: string;
  userId?: string;
  connection?: string;
};

type JoinOptions = {
  matchId: string;
  onEvent: (event: LiveMatchRealtimeEvent, action: 'apply' | 'ignore' | 'refetch') => void;
  onStatus?: (status: LivePvpChannelStatus, detail?: string) => void;
  onPresence?: (rows: LivePvpPresenceView[]) => void;
  getStateVersion: () => number;
  presencePayload?: Record<string, unknown>;
};

/**
 * Private Realtime channel helper for Live PvP.
 * Clients never send Broadcast commands — Presence only (when enabled).
 */
export class LivePvpChannelSession {
  private channel: RealtimeChannel | null = null;
  private matchId: string | null = null;
  private authSubscription: { unsubscribe: () => void } | null = null;

  get currentMatchId(): string | null {
    return this.matchId;
  }

  async join(options: JoinOptions): Promise<LivePvpChannelStatus> {
    await this.leave();
    this.matchId = options.matchId;
    const topic = livePvpTopicForMatch(options.matchId);
    options.onStatus?.('subscribing');

    const channel = supabase.channel(topic, {
      config: {
        private: true,
        presence: { key: options.presencePayload?.userId?.toString() },
      },
    });

    channel.on('broadcast', { event: '*' }, (payload) => {
      const parsed = parseLivePvpRealtimeEvent(
        (payload as { payload?: unknown }).payload ?? payload,
      );
      if (!parsed || parsed.matchId !== options.matchId) {
        return;
      }
      const action = reconcileLivePvpEvent(options.getStateVersion(), parsed);
      options.onEvent(parsed, action);
    });

    if (LIVE_PVP_CONFIG.presenceEnabled) {
      channel.on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const rows: LivePvpPresenceView[] = [];
        for (const [key, entries] of Object.entries(state)) {
          const list = Array.isArray(entries) ? entries : [];
          for (const entry of list) {
            const record = entry as Record<string, unknown>;
            rows.push({
              key,
              userId: record.userId == null ? undefined : String(record.userId),
              connection:
                record.connection == null ? undefined : String(record.connection),
            });
          }
        }
        options.onPresence?.(rows);
      });
    }

    this.channel = channel;

    await new Promise<void>((resolve, reject) => {
      channel.subscribe(async (status, err) => {
        if (status === 'SUBSCRIBED') {
          options.onStatus?.('subscribed');
          if (LIVE_PVP_CONFIG.presenceEnabled && options.presencePayload) {
            try {
              await channel.track({
                connection: 'connected',
                ...options.presencePayload,
              });
            } catch {
              // Presence is non-authoritative; ignore track failures.
            }
          }
          resolve();
          return;
        }
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          options.onStatus?.('error', err?.message ?? status);
          reject(err ?? new Error(status));
        }
        if (status === 'CLOSED') {
          options.onStatus?.('closed');
        }
      });
    });

    // Auth token refresh for private channels (supabase-js 2.x).
    this.authSubscription = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'TOKEN_REFRESHED' && session?.access_token && this.channel) {
        void supabase.realtime.setAuth(session.access_token);
      }
    }).data.subscription;

    return 'subscribed';
  }

  async leave(): Promise<void> {
    this.authSubscription?.unsubscribe();
    this.authSubscription = null;
    if (this.channel) {
      try {
        await this.channel.untrack();
      } catch {
        // ignore
      }
      await supabase.removeChannel(this.channel);
      this.channel = null;
    }
    this.matchId = null;
  }
}

export const livePvpChannelSession = new LivePvpChannelSession();
