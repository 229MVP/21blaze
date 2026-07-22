export type RankedDivisionKey =
  | 'unranked'
  | 'ember'
  | 'spark'
  | 'flame'
  | 'inferno'
  | 'blaze'
  | 'blaze_elite';

export type RankedDivision = {
  key: RankedDivisionKey;
  displayName: string;
  minimumRating: number | null;
  maximumRating: number | null;
  shortDescription: string;
  iconIdentifier: string;
  accentToken: string;
};

/** Shared client/server division thresholds — keep in sync with SQL helpers. */
export const RANKED_DIVISIONS: readonly RankedDivision[] = [
  {
    key: 'unranked',
    displayName: 'UNRANKED',
    minimumRating: null,
    maximumRating: null,
    shortDescription: 'Complete five placement matches to earn a rank.',
    iconIdentifier: 'unranked',
    accentToken: 'textMuted',
  },
  {
    key: 'ember',
    displayName: 'EMBER',
    minimumRating: 100,
    maximumRating: 899,
    shortDescription: 'The fire is just starting.',
    iconIdentifier: 'ember',
    accentToken: 'warningRed',
  },
  {
    key: 'spark',
    displayName: 'SPARK',
    minimumRating: 900,
    maximumRating: 1099,
    shortDescription: 'Building heat and tempo.',
    iconIdentifier: 'spark',
    accentToken: 'brightOrange',
  },
  {
    key: 'flame',
    displayName: 'FLAME',
    minimumRating: 1100,
    maximumRating: 1299,
    shortDescription: 'Steady ranked firepower.',
    iconIdentifier: 'flame',
    accentToken: 'primary',
  },
  {
    key: 'inferno',
    displayName: 'INFERNO',
    minimumRating: 1300,
    maximumRating: 1499,
    shortDescription: 'High-pressure Blaze play.',
    iconIdentifier: 'inferno',
    accentToken: 'gold',
  },
  {
    key: 'blaze',
    displayName: 'BLAZE',
    minimumRating: 1500,
    maximumRating: 1699,
    shortDescription: 'Elite tempo and control.',
    iconIdentifier: 'blaze',
    accentToken: 'gold',
  },
  {
    key: 'blaze_elite',
    displayName: 'BLAZE ELITE',
    minimumRating: 1700,
    maximumRating: null,
    shortDescription: 'The top of the inferno.',
    iconIdentifier: 'blaze_elite',
    accentToken: 'gold',
  },
] as const;

export const PLACEMENT_MATCHES_REQUIRED = 5;
export const DEFAULT_RANKED_RATING = 1200;
export const MINIMUM_RANKED_RATING = 100;

export function divisionForRating(
  rating: number,
  placementMatchesCompleted: number,
): RankedDivision {
  if (placementMatchesCompleted < PLACEMENT_MATCHES_REQUIRED) {
    return RANKED_DIVISIONS[0]!;
  }

  for (let index = RANKED_DIVISIONS.length - 1; index >= 1; index -= 1) {
    const division = RANKED_DIVISIONS[index]!;
    const min = division.minimumRating ?? Number.NEGATIVE_INFINITY;
    const max = division.maximumRating ?? Number.POSITIVE_INFINITY;
    if (rating >= min && rating <= max) {
      return division;
    }
  }

  return RANKED_DIVISIONS[1]!;
}

export function divisionRankIndex(key: RankedDivisionKey): number {
  return RANKED_DIVISIONS.findIndex((division) => division.key === key);
}
