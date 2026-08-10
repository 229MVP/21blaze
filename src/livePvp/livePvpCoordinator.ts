import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';

import { supabase } from '../lib/supabase';
import { LIVE_PVP_CONFIG, livePvpTopicForMatch } from './livePvpConfig';
import {
  estimateServerClockOffset,
  serverNowEstimateMs,
  type ClockOffsetEstimate,
  type ClockSample,
} from './livePvpClock';
import {
  parseLivePvpRealtimeEvent,
  reconcileLivePvpEvent,
} from './livePvpProtocol';
import type { LiveMatchRealtimeEvent, LiveMatchSnapshot } from './livePvpTypes';
import { getLiveMatchSnapshot, getLivePvpServerTime } from '../services/livePvpService';

export type LivePvpAppChannelStatus =
  | 'idle'
  | 'connecting'
  | 'subscribed'
  | 'reconnecting'
  | 'timed_out'
  | 'channel_error'
  | 'closed';

export type LivePvpPresenceView = {
  key: string;
  userId?: string;
  connection?: string;
};

type CoordinatorKey = string;

type Listener = {
  onSnapshot?: (snapshot: LiveMatchSnapshot) => void;
  onEvent?: (event: LiveMatchRealtimeEvent) => void;
  onStatus?: (status: LivePvpAppChannelStatus, detail?: string) => void;
  onPresence?: (rows: LivePvpPresenceView[]) => void;
  onClock?: (estimate: ClockOffsetEstimate | null) => void;
};

/**
 * One private channel per (userId, matchId). Survives screen remounts.
 * Clients never publish Broadcast — Presence only when enabled.
 */
class LivePvpMatchCoordinator {
  private channel: RealtimeChannel | null = null;
  private key: CoordinatorKey | null = null;
  private matchId: string | null = null;
  private userId: string | null = null;
  private status: LivePvpAppChannelStatus = 'idle';
  private snapshot: LiveMatchSnapshot | null = null;
  private listeners = new Set<Listener>();
  private authUnsub: { unsubscribe: () => void } | null = null;
  private joinInFlight: Promise<void> | null = null;
  private clockSamples: ClockSample[] = [];
  private clockEstimate: ClockOffsetEstimate | null = null;
  private progressTimer: ReturnType<typeof setInterval> | null = null;
  private lastProgressFingerprint: string | null = null;
  private progressSequence = 1;
  private progressSubmitter:
    | ((sequence: number, fingerprint: string) => Promise<void>)
    | null = null;
  private disposed = false;

  getChannelStatus(): LivePvpAppChannelStatus {
    return this.status;
  }

  getSnapshot(): LiveMatchSnapshot | null {
    return this.snapshot;
  }

  getClockEstimate(): ClockOffsetEstimate | null {
    return this.clockEstimate;
  }

  getProgressSequence(): number {
    return this.progressSequence;
  }

  estimatedServerNowMs(localNow = Date.now()): number {
    return serverNowEstimateMs(this.clockEstimate, localNow);
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    if (this.snapshot) {
      listener.onSnapshot?.(this.snapshot);
    }
    listener.onStatus?.(this.status);
    listener.onClock?.(this.clockEstimate);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emitStatus(status: LivePvpAppChannelStatus, detail?: string): void {
    this.status = status;
    for (const listener of this.listeners) {
      listener.onStatus?.(status, detail);
    }
  }

  private emitSnapshot(snapshot: LiveMatchSnapshot): void {
    this.snapshot = snapshot;
    for (const listener of this.listeners) {
      listener.onSnapshot?.(snapshot);
    }
  }

  async ensureJoined(input: {
    userId: string;
    matchId: string;
  }): Promise<void> {
    const nextKey = `${input.userId}:${input.matchId}`;
    if (this.key === nextKey && (this.status === 'subscribed' || this.status === 'connecting')) {
      if (this.joinInFlight) {
        await this.joinInFlight;
      }
      return;
    }
    if (this.key && this.key !== nextKey) {
      await this.leave({ reason: 'switch_match' });
    }
    this.disposed = false;
    this.userId = input.userId;
    this.matchId = input.matchId;
    this.key = nextKey;
    this.joinInFlight = this.joinInternal();
    try {
      await this.joinInFlight;
    } finally {
      this.joinInFlight = null;
    }
  }

  private async joinInternal(): Promise<void> {
    if (!this.matchId || !this.userId || this.disposed) {
      return;
    }
    this.emitStatus('connecting');
    await this.sampleClock();

    const topic = livePvpTopicForMatch(this.matchId);
    const client: SupabaseClient = supabase;
    const channel = client.channel(topic, {
      config: {
        private: true,
        presence: { key: this.userId },
      },
    });

    channel.on('broadcast', { event: '*' }, (message) => {
      const raw = (message as { payload?: unknown }).payload ?? message;
      const parsed = parseLivePvpRealtimeEvent(raw);
      if (!parsed || parsed.matchId !== this.matchId) {
        return;
      }
      for (const listener of this.listeners) {
        listener.onEvent?.(parsed);
      }
      const action = reconcileLivePvpEvent(this.snapshot?.stateVersion ?? 0, parsed);
      if (action === 'apply' || action === 'refetch') {
        void this.refreshSnapshot();
      }
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
        for (const listener of this.listeners) {
          listener.onPresence?.(rows);
        }
      });
    }

    this.channel = channel;

    await new Promise<void>((resolve, reject) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          this.emitStatus('timed_out');
          reject(new Error('CONNECTION_TIMEOUT'));
        }
      }, 12_000);

      channel.subscribe(async (status, err) => {
        if (status === 'SUBSCRIBED') {
          if (settled) {
            return;
          }
          settled = true;
          clearTimeout(timer);
          this.emitStatus('subscribed');
          if (LIVE_PVP_CONFIG.presenceEnabled) {
            try {
              await channel.track({
                userId: this.userId,
                connection: 'connected',
                phase: 'lobby',
                connectedAt: new Date().toISOString(),
              });
            } catch {
              // Presence is advisory.
            }
          }
          resolve();
          return;
        }
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          if (settled) {
            return;
          }
          settled = true;
          clearTimeout(timer);
          this.emitStatus(
            status === 'TIMED_OUT' ? 'timed_out' : 'channel_error',
            err?.message ?? status,
          );
          reject(err ?? new Error('CHANNEL_AUTH_FAILED'));
        }
        if (status === 'CLOSED') {
          this.emitStatus('closed');
        }
      });
    });

    this.authUnsub?.unsubscribe();
    this.authUnsub = client.auth.onAuthStateChange((event, session) => {
      if (event === 'TOKEN_REFRESHED' && session?.access_token) {
        void client.realtime.setAuth(session.access_token);
        void this.refreshSnapshot();
      }
      if (event === 'SIGNED_OUT') {
        void this.leave({ reason: 'logout' });
      }
    }).data.subscription;

    await this.refreshSnapshot();
  }

  async refreshSnapshot(): Promise<LiveMatchSnapshot | null> {
    if (!this.matchId) {
      return null;
    }
    try {
      const snapshot = await getLiveMatchSnapshot(this.matchId);
      this.emitSnapshot(snapshot);
      return snapshot;
    } catch {
      return this.snapshot;
    }
  }

  async sampleClock(): Promise<ClockOffsetEstimate | null> {
    const started = Date.now();
    try {
      const { serverNow } = await getLivePvpServerTime();
      const received = Date.now();
      this.clockSamples = [
        ...this.clockSamples,
        {
          localRequestStartedAt: started,
          localResponseReceivedAt: received,
          serverNowMs: Date.parse(serverNow),
        },
      ].slice(-5);
      this.clockEstimate = estimateServerClockOffset(this.clockSamples);
      for (const listener of this.listeners) {
        listener.onClock?.(this.clockEstimate);
      }
      return this.clockEstimate;
    } catch {
      return this.clockEstimate;
    }
  }

  async reconnect(): Promise<void> {
    if (!this.userId || !this.matchId) {
      return;
    }
    this.emitStatus('reconnecting');
    const userId = this.userId;
    const matchId = this.matchId;
    await this.leave({ reason: 'reconnect', soft: true });
    await this.ensureJoined({ userId, matchId });
  }

  startProgressScheduler(
    submitter: (sequence: number, fingerprint: string) => Promise<void>,
  ): void {
    this.stopProgressScheduler();
    this.progressSubmitter = submitter;
    const interval = LIVE_PVP_CONFIG.progressMinimumIntervalMs;
    this.progressTimer = setInterval(() => {
      void this.flushProgress();
    }, interval);
  }

  queueProgress(fingerprint: string): void {
    this.lastProgressFingerprint = fingerprint;
  }

  private async flushProgress(): Promise<void> {
    if (!this.progressSubmitter || !this.lastProgressFingerprint) {
      return;
    }
    if (this.status !== 'subscribed') {
      return;
    }
    const fingerprint = this.lastProgressFingerprint;
    const sequence = this.progressSequence;
    try {
      await this.progressSubmitter(sequence, fingerprint);
      this.progressSequence = sequence + 1;
    } catch {
      // Keep sequence; retry newest consolidated state next tick.
    }
  }

  stopProgressScheduler(): void {
    if (this.progressTimer) {
      clearInterval(this.progressTimer);
      this.progressTimer = null;
    }
    this.progressSubmitter = null;
  }

  async leave(options?: { reason?: string; soft?: boolean }): Promise<void> {
    this.stopProgressScheduler();
    this.authUnsub?.unsubscribe();
    this.authUnsub = null;
    if (this.channel) {
      try {
        await this.channel.untrack();
      } catch {
        // ignore
      }
      await supabase.removeChannel(this.channel);
      this.channel = null;
    }
    if (!options?.soft) {
      this.key = null;
      this.matchId = null;
      this.userId = null;
      this.snapshot = null;
      this.progressSequence = 1;
      this.lastProgressFingerprint = null;
      this.disposed = true;
      this.emitStatus('closed');
    }
  }
}

export const livePvpMatchCoordinator = new LivePvpMatchCoordinator();

/** Dev diagnostic — channel singleton identity. */
export function __livePvpCoordinatorDebug(): {
  status: LivePvpAppChannelStatus;
  matchId: string | null;
} {
  return {
    status: livePvpMatchCoordinator.getChannelStatus(),
    matchId: livePvpMatchCoordinator.getSnapshot()?.matchId ?? null,
  };
}
