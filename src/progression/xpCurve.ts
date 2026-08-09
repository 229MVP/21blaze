/**
 * Centralized XP progression curve — keep in sync with
 * `public.xp_required_for_level` in
 * `supabase/migrations/0014_v1_3_phase4_progression.sql`.
 */

export const XP_MAX_LEVEL = 50;

/** XP required to advance from `level` to `level + 1`. */
export function getXpRequiredForLevel(level: number): number {
  if (level < 1) {
    return 0;
  }
  if (level >= XP_MAX_LEVEL) {
    return 0;
  }
  return 500 + (level - 1) * 100;
}

export type LifetimeXpProgress = {
  level: number;
  totalXp: number;
  currentLevelXp: number;
  xpRequiredForNextLevel: number;
};

/** Derive level and bar progress from lifetime XP (deterministic). */
export function getLevelFromLifetimeXp(totalXp: number): LifetimeXpProgress {
  const safeTotal = Math.max(0, Math.floor(totalXp));
  let level = 1;
  let remaining = safeTotal;

  while (level < XP_MAX_LEVEL) {
    const needed = getXpRequiredForLevel(level);
    if (needed <= 0 || remaining < needed) {
      break;
    }
    remaining -= needed;
    level += 1;
  }

  return {
    level,
    totalXp: safeTotal,
    currentLevelXp: remaining,
    xpRequiredForNextLevel: getXpRequiredForLevel(level),
  };
}

export function getProgressToNextLevel(totalXp: number): LifetimeXpProgress {
  return getLevelFromLifetimeXp(totalXp);
}
