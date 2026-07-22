export type ProgressionSource =
  | 'solo_match'
  | 'casual_duel'
  | 'ranked_duel'
  | 'daily_mission'
  | 'daily_reward'
  | 'level_reward'
  | 'admin_adjustment'
  | 'reversal';

export type ProgressionTransactionType =
  | 'xp_earned'
  | 'level_reward'
  | 'admin_adjustment'
  | 'reversal';

export type PlayerProgression = {
  userId: string;
  level: number;
  totalXp: number;
  currentLevelXp: number;
  xpRequiredForNextLevel: number;
  highestLevelReached: number;
  dailyStreak: number;
  longestDailyStreak: number;
  lastDailyClaimAt: string | null;
  nextDailyClaimAt: string | null;
  isDailyRewardAvailable: boolean;
};

export type LevelUpReward = {
  level: number;
  blazeCoins: number;
  cosmeticId: string | null;
  title: string | null;
};

export type XpGrantResult = {
  xpGranted: number;
  levelBefore: number;
  levelAfter: number;
  levelsGained: number;
  currentLevelXp: number;
  xpRequiredForNextLevel: number;
  totalXpAfter: number;
  levelsCrossed: number[];
  rewardsGranted: LevelUpReward[];
  alreadyProcessed: boolean;
};

export type DailyRewardDay = {
  day: number;
  blazeCoins: number;
  xp: number;
  cosmeticId: string | null;
};

export type DailyRewardStatus = {
  isAvailable: boolean;
  currentStreak: number;
  longestStreak: number;
  nextStreakDay: number;
  nextClaimAt: string | null;
  currentReward: DailyRewardDay;
  calendar: DailyRewardDay[];
};

export type DailyMissionView = {
  id: string;
  templateId: string;
  name: string;
  description: string;
  category: 'participation' | 'skill' | 'mode';
  progress: number;
  targetValue: number;
  xpReward: number;
  blazeCoinReward: number;
  completedAt: string | null;
  claimedAt: string | null;
  isComplete: boolean;
  isClaimed: boolean;
};

export type DailyMissionsStatus = {
  missions: DailyMissionView[];
  resetAt: string;
  claimableCount: number;
};

export type ProgressionTransactionView = {
  id: string;
  transactionType: ProgressionTransactionType;
  xpAmount: number;
  levelBefore: number;
  levelAfter: number;
  totalXpAfter: number;
  sourceType: ProgressionSource | string;
  sourceId: string | null;
  createdAt: string;
};

export type MatchProgressionSummary = {
  exactTwentyOneClears: number;
  fiveCardClears: number;
  totalLaneClears: number;
  maximumMultiplierReached: number;
  matchMode: 'solo' | 'casual' | 'ranked' | 'unknown';
  matchCompleted: boolean;
  validCompletion: boolean;
  wonDuel: boolean | null;
};

export type PendingLevelUp = {
  levelBefore: number;
  levelAfter: number;
  levelsCrossed: number[];
  rewards: LevelUpReward[];
  eventKey: string;
};
