/**
 * Estimate server clock offset using RTT midpoint.
 * Match eligibility always uses server timestamps from snapshots / RPCs —
 * never the device wall clock alone.
 */
export type ClockSample = {
  localRequestStartedAt: number;
  localResponseReceivedAt: number;
  serverNowMs: number;
};

export type ClockOffsetEstimate = {
  offsetMs: number;
  rttMs: number;
  sampleCount: number;
};

export function estimateServerClockOffset(
  samples: readonly ClockSample[],
): ClockOffsetEstimate | null {
  if (samples.length === 0) {
    return null;
  }
  const offsets = samples.map((sample) => {
    const rtt = Math.max(0, sample.localResponseReceivedAt - sample.localRequestStartedAt);
    const midpoint = sample.localRequestStartedAt + rtt / 2;
    return {
      offsetMs: sample.serverNowMs - midpoint,
      rttMs: rtt,
    };
  });
  const best = offsets.reduce((a, b) => (a.rttMs <= b.rttMs ? a : b));
  const avgOffset =
    offsets.reduce((sum, item) => sum + item.offsetMs, 0) / offsets.length;
  return {
    offsetMs: Number.isFinite(avgOffset) ? avgOffset : best.offsetMs,
    rttMs: best.rttMs,
    sampleCount: samples.length,
  };
}

export function serverNowEstimateMs(
  estimate: ClockOffsetEstimate | null,
  localNowMs: number = Date.now(),
): number {
  if (!estimate) {
    return localNowMs;
  }
  return localNowMs + estimate.offsetMs;
}
