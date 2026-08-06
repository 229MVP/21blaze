/** Version 1.3B — deterministic daily and weekly ordering (mirrors SQL). */

export type DailyLeaderboardRow = {
  verifiedScore: number;
  exact21Count: number;
  fiveCardClears: number;
  bustCount: number;
  bestMultiplier: number;
  elapsedTimeMs: number;
  completedAt: string;
};

export function compareDailyLeaderboardRows(a: DailyLeaderboardRow, b: DailyLeaderboardRow): number {
  if (a.verifiedScore !== b.verifiedScore) {
    return b.verifiedScore - a.verifiedScore;
  }
  if (a.exact21Count !== b.exact21Count) {
    return b.exact21Count - a.exact21Count;
  }
  if (a.fiveCardClears !== b.fiveCardClears) {
    return b.fiveCardClears - a.fiveCardClears;
  }
  if (a.bustCount !== b.bustCount) {
    return a.bustCount - b.bustCount;
  }
  if (a.bestMultiplier !== b.bestMultiplier) {
    return b.bestMultiplier - a.bestMultiplier;
  }
  if (a.elapsedTimeMs !== b.elapsedTimeMs) {
    return a.elapsedTimeMs - b.elapsedTimeMs;
  }
  return Date.parse(a.completedAt) - Date.parse(b.completedAt);
}

export function rankDailyLeaderboardRows<T extends DailyLeaderboardRow>(
  rows: T[],
): Array<T & { rank: number }> {
  const sorted = [...rows].sort(compareDailyLeaderboardRows);
  return sorted.map((row, index) => ({ ...row, rank: index + 1 }));
}

export type WeeklyLeaderboardRow = {
  challengePoints: number;
  verifiedDaysCompleted: number;
  bestDailyRank: number;
  totalVerifiedScore: number;
  totalExact21Count: number;
  totalFiveCardClears: number;
  totalBustCount: number;
  lastContributedAt: string;
};

export function compareWeeklyLeaderboardRows(a: WeeklyLeaderboardRow, b: WeeklyLeaderboardRow): number {
  if (a.challengePoints !== b.challengePoints) {
    return b.challengePoints - a.challengePoints;
  }
  if (a.verifiedDaysCompleted !== b.verifiedDaysCompleted) {
    return b.verifiedDaysCompleted - a.verifiedDaysCompleted;
  }
  if (a.bestDailyRank !== b.bestDailyRank) {
    return a.bestDailyRank - b.bestDailyRank;
  }
  if (a.totalVerifiedScore !== b.totalVerifiedScore) {
    return b.totalVerifiedScore - a.totalVerifiedScore;
  }
  if (a.totalExact21Count !== b.totalExact21Count) {
    return b.totalExact21Count - a.totalExact21Count;
  }
  if (a.totalFiveCardClears !== b.totalFiveCardClears) {
    return b.totalFiveCardClears - a.totalFiveCardClears;
  }
  if (a.totalBustCount !== b.totalBustCount) {
    return a.totalBustCount - b.totalBustCount;
  }
  return Date.parse(a.lastContributedAt) - Date.parse(b.lastContributedAt);
}

export function rankWeeklyLeaderboardRows<T extends WeeklyLeaderboardRow>(
  rows: T[],
): Array<T & { rank: number }> {
  const sorted = [...rows].sort(compareWeeklyLeaderboardRows);
  return sorted.map((row, index) => ({ ...row, rank: index + 1 }));
}
