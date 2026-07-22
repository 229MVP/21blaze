import {
  DEFAULT_RANKED_RATING,
  MINIMUM_RANKED_RATING,
  PLACEMENT_MATCHES_REQUIRED,
} from './divisions';

export type RankedActualResult = 0 | 0.5 | 1;

export function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + 10 ** ((ratingB - ratingA) / 400));
}

export function kFactor(
  placementMatchesCompleted: number,
  rankedMatchesPlayed: number,
): number {
  if (placementMatchesCompleted < PLACEMENT_MATCHES_REQUIRED) {
    return 40;
  }
  if (rankedMatchesPlayed >= 100) {
    return 16;
  }
  return 24;
}

export function clampRating(rating: number): number {
  return Math.max(MINIMUM_RANKED_RATING, Math.round(rating));
}

export function computeRatingChange(
  rating: number,
  opponentRating: number,
  actual: RankedActualResult,
  placementMatchesCompleted: number,
  rankedMatchesPlayed: number,
): { ratingAfter: number; ratingChange: number; expected: number; k: number } {
  const k = kFactor(placementMatchesCompleted, rankedMatchesPlayed);
  const expected = expectedScore(rating, opponentRating);
  const rawAfter = rating + k * (actual - expected);
  const ratingAfter = clampRating(rawAfter);
  const ratingChange = ratingAfter - rating;
  return { ratingAfter, ratingChange, expected, k };
}

export function softResetRating(oldRating: number): number {
  return clampRating(DEFAULT_RANKED_RATING + (oldRating - DEFAULT_RANKED_RATING) * 0.5);
}
