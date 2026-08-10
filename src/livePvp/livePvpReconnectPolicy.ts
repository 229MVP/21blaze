export type LivePvpReconnectBackoffConfig = {
  maxAttempts: number;
  baseMs: number;
  capMs: number;
  jitterMaxMs: number;
};

export const DEFAULT_LIVE_PVP_RECONNECT_BACKOFF: LivePvpReconnectBackoffConfig = {
  maxAttempts: 5,
  baseMs: 500,
  capMs: 8000,
  jitterMaxMs: 250,
};

export function computeLivePvpBackoffDelayMs(
  attempt: number,
  config: LivePvpReconnectBackoffConfig = DEFAULT_LIVE_PVP_RECONNECT_BACKOFF,
  jitter = 0,
): number {
  const exp = Math.min(config.capMs, config.baseMs * 2 ** attempt);
  const safeJitter = Math.max(0, Math.min(config.jitterMaxMs, jitter));
  return exp + safeJitter;
}

export function shouldScheduleLivePvpReconnect(input: {
  disposed: boolean;
  matchId: string | null;
  userId: string | null;
  intentionalLeave: boolean;
  snapshotStatus: string | null;
}): boolean {
  if (input.intentionalLeave || input.disposed) {
    return false;
  }
  if (!input.matchId || !input.userId) {
    return false;
  }
  if (
    input.snapshotStatus === 'completed' ||
    input.snapshotStatus === 'declined' ||
    input.snapshotStatus === 'cancelled' ||
    input.snapshotStatus === 'expired' ||
    input.snapshotStatus === 'invalid'
  ) {
    return false;
  }
  return true;
}

export type LivePvpUnexpectedDisconnectReason =
  | 'channel_error'
  | 'timed_out'
  | 'closed'
  | 'snapshot_failed'
  | 'foreground'
  | 'join_failed';
