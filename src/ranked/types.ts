import type { RankedDivisionKey } from './divisions';
import type { QuickMatchStatus } from '../matchmaking/types';

export type { RankedDivisionKey };

export type RankedSeasonSummary = {
  id: string;
  name: string;
  slug?: string;
  status?: string;
  starts_at?: string;
  ends_at: string;
};

export type RankedProfileBase = {
  seasonId: string;
  seasonName: string;
  seasonEndsAt?: string;
  division: RankedDivisionKey;
  placementMatchesCompleted: number;
  placementMatchesRequired: number;
  rankedMatchesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
  currentWinStreak: number;
  longestWinStreak: number;
  peakDivision: RankedDivisionKey;
};

export type PlacementRankedProfile = RankedProfileBase & {
  rating: null;
  peakRating: null;
  placementComplete: false;
};

export type PlacedRankedProfile = RankedProfileBase & {
  rating: number;
  peakRating: number;
  placementComplete: true;
};

export type RankedProfile = PlacementRankedProfile | PlacedRankedProfile;

export type RankedMatchOutcome =
  | 'win'
  | 'loss'
  | 'draw'
  | 'forfeit_win'
  | 'forfeit_loss'
  | 'no_contest';

type RankedMatchResultBase = {
  matchId: string;
  result: RankedMatchOutcome;
  opponentName: string;
  opponentDivision: RankedDivisionKey;
  localScore: number;
  opponentScore: number;
  completedAt: string;
  forfeit?: boolean;
};

export type PlacementRankedMatchResult = RankedMatchResultBase & {
  ratingBefore: null;
  ratingAfter: null;
  ratingChange: null;
  placement: true;
};

export type RatedRankedMatchResult = RankedMatchResultBase & {
  ratingBefore: number;
  ratingAfter: number;
  ratingChange: number;
  placement: false;
};

export type RankedMatchResult = PlacementRankedMatchResult | RatedRankedMatchResult;

export type RankedLeaderboardRow = {
  rank: number;
  user_id: string;
  display_name: string;
  rating: number;
  current_division: RankedDivisionKey;
  placement_matches_completed: number;
  ranked_matches_played: number;
  wins: number;
  losses: number;
  draws: number;
  current_win_streak: number;
  peak_rating: number;
  peak_division: RankedDivisionKey;
  last_ranked_match_at: string | null;
};

export type RankedOpponentProfile = {
  userId: string;
  displayName: string;
  seat: number;
  division?: RankedDivisionKey;
  placementComplete?: boolean;
};

export type RankedQueueState = {
  queueId: string | null;
  status: QuickMatchStatus;
  queuedAt: string | null;
  expiresAt: string | null;
  elapsedSeconds: number;
  matchId: string | null;
  opponent: RankedOpponentProfile | null;
  acceptanceExpiresAt: string | null;
  localAccepted: boolean;
  opponentAccepted: boolean;
  error: string | null;
  region: string | null;
  seed: number | null;
  startsAt: string | null;
  endsAt: string | null;
  ratingRange: number | null;
  ratingRangeLabel: string | null;
};

export type RankedServerResponse = {
  status: string;
  error?: string;
  queueId?: string;
  queuedAt?: string;
  expiresAt?: string;
  elapsedSeconds?: number;
  region?: string | null;
  matchId?: string;
  opponent?: RankedOpponentProfile | null;
  acceptanceExpiresAt?: string | null;
  localAccepted?: boolean;
  opponentAccepted?: boolean;
  startsAt?: string | null;
  endsAt?: string | null;
  seed?: number;
  matchStatus?: string;
  roomType?: string;
  ratingRange?: number | null;
  ratingRangeLabel?: string | null;
  season?: RankedSeasonSummary | null;
  rankedProfile?: Record<string, unknown> | null;
  rows?: RankedLeaderboardRow[];
  history?: Array<Record<string, unknown>>;
};

export const IDLE_RANKED_QUEUE_STATE: RankedQueueState = {
  queueId: null,
  status: 'idle',
  queuedAt: null,
  expiresAt: null,
  elapsedSeconds: 0,
  matchId: null,
  opponent: null,
  acceptanceExpiresAt: null,
  localAccepted: false,
  opponentAccepted: false,
  error: null,
  region: null,
  seed: null,
  startsAt: null,
  endsAt: null,
  ratingRange: null,
  ratingRangeLabel: null,
};

export function isRankedDivisionKey(value: unknown): value is RankedDivisionKey {
  return (
    value === 'unranked' ||
    value === 'ember' ||
    value === 'spark' ||
    value === 'flame' ||
    value === 'inferno' ||
    value === 'blaze' ||
    value === 'blaze_elite'
  );
}

export function normalizeRankedProfile(
  raw: Record<string, unknown> | null | undefined,
): RankedProfile | null {
  if (!raw) {
    return null;
  }
  const seasonId = typeof raw.seasonId === 'string' ? raw.seasonId : null;
  const seasonName = typeof raw.seasonName === 'string' ? raw.seasonName : null;
  if (!seasonId || !seasonName) {
    return null;
  }

  const placementMatchesCompleted =
    typeof raw.placementMatchesCompleted === 'number'
      ? raw.placementMatchesCompleted
      : 0;
  const placementMatchesRequired =
    typeof raw.placementMatchesRequired === 'number'
      ? raw.placementMatchesRequired
      : 5;
  const division = isRankedDivisionKey(raw.division) ? raw.division : 'unranked';
  const peakDivision = isRankedDivisionKey(raw.peakDivision)
    ? raw.peakDivision
    : 'unranked';

  const base: RankedProfileBase = {
    seasonId,
    seasonName,
    seasonEndsAt:
      typeof raw.seasonEndsAt === 'string' ? raw.seasonEndsAt : undefined,
    division,
    placementMatchesCompleted,
    placementMatchesRequired,
    rankedMatchesPlayed:
      typeof raw.rankedMatchesPlayed === 'number' ? raw.rankedMatchesPlayed : 0,
    wins: typeof raw.wins === 'number' ? raw.wins : 0,
    losses: typeof raw.losses === 'number' ? raw.losses : 0,
    draws: typeof raw.draws === 'number' ? raw.draws : 0,
    currentWinStreak:
      typeof raw.currentWinStreak === 'number' ? raw.currentWinStreak : 0,
    longestWinStreak:
      typeof raw.longestWinStreak === 'number' ? raw.longestWinStreak : 0,
    peakDivision,
  };

  if (placementMatchesCompleted >= placementMatchesRequired) {
    return {
      ...base,
      rating: typeof raw.rating === 'number' ? raw.rating : 1200,
      peakRating: typeof raw.peakRating === 'number' ? raw.peakRating : 1200,
      placementComplete: true,
    };
  }

  return {
    ...base,
    rating: null,
    peakRating: null,
    placementComplete: false,
  };
}
