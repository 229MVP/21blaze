/** Client-visible matchmaking range labels — mirrors server expansion. */
export function matchmakingRangeForElapsed(elapsedSeconds: number): number | null {
  if (elapsedSeconds < 10) {
    return 100;
  }
  if (elapsedSeconds < 20) {
    return 200;
  }
  if (elapsedSeconds < 30) {
    return 300;
  }
  if (elapsedSeconds < 45) {
    return 450;
  }
  return null;
}

export function matchmakingRangeLabel(elapsedSeconds: number): string {
  const range = matchmakingRangeForElapsed(elapsedSeconds);
  if (range === null) {
    if (elapsedSeconds >= 60) {
      return 'EXPANDING SEARCH · ANY REGION';
    }
    return 'SEARCHING ANY ELIGIBLE RATING';
  }
  if (elapsedSeconds < 10) {
    return `SEARCHING WITHIN ±${range} RATING`;
  }
  return `EXPANDING SEARCH TO ±${range}`;
}
