/** Version 1.3B — Challenge Points from daily rank (UTC week aggregation). */

export function challengePointsForRank(rank: number): number {
  if (!Number.isFinite(rank) || rank < 1) {
    return 0;
  }
  if (rank === 1) {
    return 100;
  }
  if (rank === 2) {
    return 90;
  }
  if (rank === 3) {
    return 85;
  }
  if (rank <= 10) {
    return 75;
  }
  if (rank <= 25) {
    return 60;
  }
  if (rank <= 50) {
    return 45;
  }
  if (rank <= 100) {
    return 30;
  }
  return 15;
}
