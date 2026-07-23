import type { DailyRewardDay, LevelUpReward } from './types';

export const DAILY_REWARD_CALENDAR: readonly DailyRewardDay[] = [
  { day: 1, blazeCoins: 25, xp: 25, cosmeticId: null },
  { day: 2, blazeCoins: 30, xp: 30, cosmeticId: null },
  { day: 3, blazeCoins: 40, xp: 40, cosmeticId: null },
  { day: 4, blazeCoins: 50, xp: 50, cosmeticId: null },
  { day: 5, blazeCoins: 60, xp: 60, cosmeticId: null },
  { day: 6, blazeCoins: 75, xp: 75, cosmeticId: null },
  {
    day: 7,
    blazeCoins: 100,
    xp: 100,
    cosmeticId: 'seven_day_blaze_title',
  },
] as const;

/** streakDay is 1-based cycle position (1..7). */
export function dailyRewardForStreakDay(streakDay: number): DailyRewardDay {
  const cycle = ((Math.max(1, streakDay) - 1) % 7) + 1;
  return (
    DAILY_REWARD_CALENDAR.find((entry) => entry.day === cycle) ??
    DAILY_REWARD_CALENDAR[0]
  );
}

/**
 * After a successful claim that advances streak to `newStreak`,
 * the reward day is the cycle position of that streak.
 */
export function streakDayFromStreak(newStreak: number): number {
  if (newStreak <= 0) {
    return 1;
  }
  return ((newStreak - 1) % 7) + 1;
}

export const LEVEL_REWARDS: ReadonlyArray<LevelUpReward> = [
  { level: 2, blazeCoins: 50, cosmeticId: null, title: null },
  {
    level: 3,
    blazeCoins: 0,
    cosmeticId: 'rookie_blazer_title',
    title: 'Rookie Blazer',
  },
  {
    level: 5,
    blazeCoins: 0,
    cosmeticId: 'ember_card_back',
    title: null,
  },
  { level: 7, blazeCoins: 100, cosmeticId: null, title: null },
  {
    level: 10,
    blazeCoins: 0,
    cosmeticId: 'spark_profile_frame',
    title: null,
  },
  {
    level: 15,
    blazeCoins: 0,
    cosmeticId: 'flame_card_face',
    title: null,
  },
  { level: 20, blazeCoins: 250, cosmeticId: null, title: null },
  {
    level: 25,
    blazeCoins: 0,
    cosmeticId: 'inferno_player_title',
    title: 'Inferno Player',
  },
  {
    level: 30,
    blazeCoins: 0,
    cosmeticId: 'veteran_blazer_card_back',
    title: null,
  },
  { level: 35, blazeCoins: 350, cosmeticId: null, title: null },
  {
    level: 40,
    blazeCoins: 0,
    cosmeticId: 'blaze_profile_frame',
    title: null,
  },
  { level: 45, blazeCoins: 500, cosmeticId: null, title: null },
  {
    level: 50,
    blazeCoins: 0,
    cosmeticId: 'blaze_master_title',
    title: 'Blaze Master',
  },
] as const;

/** Level 50 also unlocks a second cosmetic. */
export const LEVEL_50_EXTRA_COSMETIC = 'level_50_champion_card_back';

export function getLevelReward(level: number): LevelUpReward | null {
  return LEVEL_REWARDS.find((entry) => entry.level === level) ?? null;
}

export function cosmeticsGrantedAtLevel(level: number): string[] {
  const reward = getLevelReward(level);
  const keys: string[] = [];
  if (reward?.cosmeticId) {
    keys.push(reward.cosmeticId);
  }
  if (level === 50) {
    keys.push(LEVEL_50_EXTRA_COSMETIC);
  }
  return keys;
}
