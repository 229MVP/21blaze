import { PROGRESSION_CONFIG, xpRequiredForLevel } from '../config/progressionConfig';
import type { LevelUpReward, XpGrantResult } from './types';
import { getLevelReward } from './rewards';

export { xpRequiredForLevel };

export type ProgressionSnapshot = {
  level: number;
  totalXp: number;
  currentLevelXp: number;
  highestLevelReached: number;
};

/**
 * Apply XP to a progression snapshot. Pure — no I/O.
 * Excess XP carries across levels. Level caps at maxLevel; totalXp keeps growing.
 */
export function applyXpGrant(
  snapshot: ProgressionSnapshot,
  xpAmount: number,
  alreadyProcessed = false,
): XpGrantResult {
  if (alreadyProcessed) {
    return {
      xpGranted: 0,
      levelBefore: snapshot.level,
      levelAfter: snapshot.level,
      levelsGained: 0,
      currentLevelXp: snapshot.currentLevelXp,
      xpRequiredForNextLevel: xpRequiredForLevel(snapshot.level),
      totalXpAfter: snapshot.totalXp,
      levelsCrossed: [],
      rewardsGranted: [],
      alreadyProcessed: true,
    };
  }

  if (!Number.isFinite(xpAmount) || xpAmount <= 0) {
    return {
      xpGranted: 0,
      levelBefore: snapshot.level,
      levelAfter: snapshot.level,
      levelsGained: 0,
      currentLevelXp: snapshot.currentLevelXp,
      xpRequiredForNextLevel: xpRequiredForLevel(snapshot.level),
      totalXpAfter: snapshot.totalXp,
      levelsCrossed: [],
      rewardsGranted: [],
      alreadyProcessed: false,
    };
  }

  const xpGranted = Math.floor(xpAmount);
  const levelBefore = snapshot.level;
  let level = snapshot.level;
  let currentLevelXp = snapshot.currentLevelXp + xpGranted;
  const totalXpAfter = snapshot.totalXp + xpGranted;
  const levelsCrossed: number[] = [];
  const rewardsGranted: LevelUpReward[] = [];

  while (level < PROGRESSION_CONFIG.maxLevel) {
    const needed = xpRequiredForLevel(level);
    if (needed <= 0 || currentLevelXp < needed) {
      break;
    }
    currentLevelXp -= needed;
    level += 1;
    levelsCrossed.push(level);
    const reward = getLevelReward(level);
    if (reward) {
      rewardsGranted.push(reward);
    }
  }

  // At cap: keep overflowing XP in current_level_xp for visibility / future.
  if (level >= PROGRESSION_CONFIG.maxLevel) {
    level = PROGRESSION_CONFIG.maxLevel;
  }

  const highestLevelReached = Math.max(snapshot.highestLevelReached, level);

  return {
    xpGranted,
    levelBefore,
    levelAfter: level,
    levelsGained: level - levelBefore,
    currentLevelXp,
    xpRequiredForNextLevel: xpRequiredForLevel(level),
    totalXpAfter,
    levelsCrossed,
    rewardsGranted,
    alreadyProcessed: false,
  };
}

export function progressFraction(
  currentLevelXp: number,
  xpRequiredForNext: number,
): number {
  if (xpRequiredForNext <= 0) {
    return 1;
  }
  return Math.max(0, Math.min(1, currentLevelXp / xpRequiredForNext));
}
