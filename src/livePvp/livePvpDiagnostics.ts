type LivePvpDiagnosticEvent = {
  atMs: number;
  kind: string;
  detail?: string;
};

const MAX_EVENTS = 40;
const events: LivePvpDiagnosticEvent[] = [];

function push(kind: string, detail?: string): void {
  events.push({ atMs: Date.now(), kind, detail });
  if (events.length > MAX_EVENTS) {
    events.splice(0, events.length - MAX_EVENTS);
  }
}

export const livePvpDiagnostics = {
  channelJoinStarted(matchId: string): void {
    push('channel_join_started', matchId.slice(0, 8));
  },
  channelJoinLatency(ms: number): void {
    push('channel_join_latency', `${Math.round(ms)}ms`);
  },
  reconnectAttempt(attempt: number, reason: string): void {
    push('reconnect_attempt', `${attempt}:${reason}`);
  },
  reconnectOutcome(outcome: 'success' | 'failed' | 'cancelled'): void {
    push('reconnect_outcome', outcome);
  },
  stateVersionGap(gap: number): void {
    push('state_version_gap', String(gap));
  },
  snapshotRecovered(stateVersion: number): void {
    push('snapshot_recovered', String(stateVersion));
  },
  checkpointAccepted(matchId: string): void {
    push('checkpoint_accepted', matchId.slice(0, 8));
  },
  checkpointDiscarded(reason: string): void {
    push('checkpoint_discarded', reason);
  },
  progressSequenceResync(sequence: number): void {
    push('progress_sequence_resync', String(sequence));
  },
  rematchOutcome(outcome: string): void {
    push('rematch_outcome', outcome);
  },
  settlementOutcome(outcome: string): void {
    push('settlement_outcome', outcome);
  },
  getRecent(): LivePvpDiagnosticEvent[] {
    return [...events];
  },
  clear(): void {
    events.length = 0;
  },
};

export function __resetLivePvpDiagnosticsForTests(): void {
  events.length = 0;
}
