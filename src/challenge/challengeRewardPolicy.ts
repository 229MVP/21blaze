/** Version 1.3C — Challenge reward tiers (mirrors SQL). */

export const CHALLENGE_PARTICIPATION_COINS = 20;
export const CHALLENGE_PARTICIPATION_XP = 75;

export const DAILY_PLACEMENT_COINS = {
  first: 200,
  top3: 125,
  top10: 75,
  top25: 50,
  top100: 25,
} as const;

export type WeeklyChallengeTier =
  | 'bronze_blazer'
  | 'silver_blazer'
  | 'gold_blazer'
  | 'elite_blazer'
  | 'inferno_blazer';

export type WeeklyTierDefinition = {
  id: WeeklyChallengeTier;
  label: string;
  minChallengePoints: number;
  blazeCoins: number;
  titleId?: string;
  badgeId?: string;
};

export const WEEKLY_CHALLENGE_TIERS: readonly WeeklyTierDefinition[] = [
  { id: 'inferno_blazer', label: 'INFERNO BLAZER', minChallengePoints: 600, blazeCoins: 600, titleId: 'inferno_blazer_title', badgeId: 'inferno_challenge_badge' },
  { id: 'elite_blazer', label: 'ELITE BLAZER', minChallengePoints: 450, blazeCoins: 400, titleId: 'elite_blazer_title' },
  { id: 'gold_blazer', label: 'GOLD BLAZER', minChallengePoints: 300, blazeCoins: 250 },
  { id: 'silver_blazer', label: 'SILVER BLAZER', minChallengePoints: 175, blazeCoins: 150 },
  { id: 'bronze_blazer', label: 'BRONZE BLAZER', minChallengePoints: 75, blazeCoins: 75 },
];

export const STREAK_MILESTONES = [
  { days: 3, blazeCoins: 50 },
  { days: 7, blazeCoins: 125, titleId: 'weekly_warrior_title' },
  { days: 14, blazeCoins: 250, badgeId: 'challenge_flame_badge' },
  { days: 30, blazeCoins: 500, titleId: 'daily_legend_title', badgeId: 'daily_legend_badge' },
] as const;

export function dailyPlacementCoinsForRank(rank: number): number {
  if (!Number.isFinite(rank) || rank < 1) {
    return 0;
  }
  if (rank === 1) {
    return DAILY_PLACEMENT_COINS.first;
  }
  if (rank <= 3) {
    return DAILY_PLACEMENT_COINS.top3;
  }
  if (rank <= 10) {
    return DAILY_PLACEMENT_COINS.top10;
  }
  if (rank <= 25) {
    return DAILY_PLACEMENT_COINS.top25;
  }
  if (rank <= 100) {
    return DAILY_PLACEMENT_COINS.top100;
  }
  return 0;
}

export function dailyPlacementTierForRank(rank: number): string | null {
  if (!Number.isFinite(rank) || rank < 1) {
    return null;
  }
  if (rank === 1) {
    return 'first';
  }
  if (rank <= 3) {
    return 'top3';
  }
  if (rank <= 10) {
    return 'top10';
  }
  if (rank <= 25) {
    return 'top25';
  }
  if (rank <= 100) {
    return 'top100';
  }
  return null;
}

export function weeklyTierForChallengePoints(
  challengePoints: number,
): WeeklyTierDefinition | null {
  for (const tier of WEEKLY_CHALLENGE_TIERS) {
    if (challengePoints >= tier.minChallengePoints) {
      return tier;
    }
  }
  return null;
}

export function nextWeeklyTier(challengePoints: number): WeeklyTierDefinition | null {
  const tiers = [...WEEKLY_CHALLENGE_TIERS].reverse();
  for (const tier of tiers) {
    if (challengePoints < tier.minChallengePoints) {
      return tier;
    }
  }
  return null;
}
