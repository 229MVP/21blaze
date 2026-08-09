export type DailyLeaderboardEntry = {
  rank: number;
  displayName: string;
  score: number;
  exact21Count?: number;
  fiveCardClearCount?: number;
  bustCount?: number;
  completionMs?: number;
  profileFrameId?: string | null;
  isCurrentPlayer: boolean;
};

export type DailyLeaderboardPage = {
  entries: DailyLeaderboardEntry[];
  totalPlayers: number;
  limit: number;
  offset: number;
};

export type DailyLeaderboardPosition = {
  entry: DailyLeaderboardEntry | null;
  totalPlayers: number;
};

export type WeeklyLeaderboardEntry = {
  rank: number;
  displayName: string;
  weeklyScore: number;
  daysPlayed: number;
  bestDailyScore: number;
  profileFrameId?: string | null;
  isCurrentPlayer: boolean;
};

export type WeeklyLeaderboardPage = {
  weekStart: string;
  weekEnd: string;
  entries: WeeklyLeaderboardEntry[];
  totalPlayers: number;
  limit: number;
  offset: number;
};

export type WeeklyLeaderboardPosition = {
  weekStart: string;
  weekEnd: string;
  entry: WeeklyLeaderboardEntry | null;
  totalPlayers: number;
};

export type StreakEligibleReward = {
  grantId: string;
  milestone: number;
  amount: number;
  status: string;
  sourceId: string;
};

export type DailyStreakStatus = {
  currentStreak: number;
  longestStreak: number;
  lastCompletedChallengeDate: string | null;
  updatedAt: string | null;
  eligibleRewards: StreakEligibleReward[];
};

export type ClaimStreakRewardResult = {
  alreadyClaimed: boolean;
  milestone: number;
  amount: number;
  balance?: number;
};
