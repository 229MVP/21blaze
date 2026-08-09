/**
 * Progression reward registry — level-up rewards and future unlock types.
 * Cosmetic ids must exist in cosmetic_catalog / client catalog or be DEFERRED.
 */

export type ProgressionRewardType =
  | 'blaze_coins'
  | 'cosmetic'
  | 'title'
  | 'sabotage_unlock'
  | 'defense_unlock'
  | 'deferred';

export type ProgressionRewardEntry = {
  level: number;
  rewardType: ProgressionRewardType;
  blazeCoins: number;
  cosmeticId: string | null;
  title: string | null;
  displayName: string;
  deferred?: boolean;
};

/** Future Sabotage / defense hooks — architecture only in v1.3. */
export const FUTURE_SABOTAGE_UNLOCK_KEYS = [
  'time_burn',
  'blind_draw',
  'frozen_lane',
  'lane_fog',
  'multiplier_jam',
] as const;

export const FUTURE_DEFENSE_UNLOCK_KEYS = [
  'blaze_shield',
  'cleanse',
  'mirror_flame',
] as const;

/**
 * v1.3 display schedule aligned with existing earnable assets.
 * Levels without a real asset are marked deferred.
 */
export const V1_3_LEVEL_REWARD_SCHEDULE: ReadonlyArray<ProgressionRewardEntry> = [
  {
    level: 2,
    rewardType: 'blaze_coins',
    blazeCoins: 50,
    cosmeticId: null,
    title: null,
    displayName: '50 Blaze Coins',
  },
  {
    level: 3,
    rewardType: 'title',
    blazeCoins: 0,
    cosmeticId: 'rookie_blazer_title',
    title: 'Rookie Blazer',
    displayName: 'Rookie Blazer Title',
  },
  {
    level: 5,
    rewardType: 'deferred',
    blazeCoins: 0,
    cosmeticId: null,
    title: null,
    displayName: 'Board Skin',
    deferred: true,
  },
  {
    level: 7,
    rewardType: 'blaze_coins',
    blazeCoins: 100,
    cosmeticId: null,
    title: null,
    displayName: '100 Blaze Coins',
  },
  {
    level: 10,
    rewardType: 'cosmetic',
    blazeCoins: 0,
    cosmeticId: 'spark_profile_frame',
    title: null,
    displayName: 'Spark Profile Frame',
  },
  {
    level: 15,
    rewardType: 'cosmetic',
    blazeCoins: 0,
    cosmeticId: 'flame_card_face',
    title: null,
    displayName: 'Flame Card Face',
  },
  {
    level: 20,
    rewardType: 'deferred',
    blazeCoins: 250,
    cosmeticId: null,
    title: null,
    displayName: 'Special Fire Effect',
    deferred: true,
  },
] as const;

export function getNextUnlockEntry(currentLevel: number): ProgressionRewardEntry | null {
  return (
    V1_3_LEVEL_REWARD_SCHEDULE.find((entry) => entry.level > currentLevel) ?? null
  );
}

export function getLevelRewardEntry(level: number): ProgressionRewardEntry | null {
  return V1_3_LEVEL_REWARD_SCHEDULE.find((entry) => entry.level === level) ?? null;
}
