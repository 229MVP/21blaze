import type { createServiceClient } from './supabaseAdmin.ts';
import type { QueueRow } from './quickMatchHelpers.ts';

type AdminClient = ReturnType<typeof createServiceClient>;

export type RankedSeasonRow = {
  id: string;
  name: string;
  slug: string;
  status: string;
  starts_at: string;
  ends_at: string;
};

export type PlayerRankingRow = {
  user_id: string;
  season_id: string;
  rating: number;
  placement_matches_completed: number;
  ranked_matches_played: number;
  wins: number;
  losses: number;
  draws: number;
  current_win_streak: number;
  longest_win_streak: number;
  peak_rating: number;
  current_division: string;
  peak_division: string;
  last_ranked_match_at: string | null;
};

export type RankedQueueRow = QueueRow & {
  season_id: string | null;
  rating_snapshot: number | null;
  placement_status: string | null;
  rating_range_at_join: number | null;
};

export const PLACEMENT_MATCHES_REQUIRED = 5;
export const DEFAULT_RANKED_RATING = 1200;

export function matchmakingRangeForElapsed(elapsedSeconds: number): number | null {
  if (elapsedSeconds < 10) {
    return 100;
  }
  if (elapsedSeconds < 20) {
    return 200;
  }
  if (elapsedSeconds < 30) {
    return 300;
  }
  if (elapsedSeconds < 45) {
    return 450;
  }
  return null;
}

export async function loadActiveSeason(
  admin: AdminClient,
): Promise<RankedSeasonRow | null> {
  const { data } = await admin
    .from('ranked_seasons')
    .select('id, name, slug, status, starts_at, ends_at')
    .eq('status', 'active')
    .maybeSingle();
  return (data as RankedSeasonRow | null) ?? null;
}

export async function ensureRanking(
  admin: AdminClient,
  userId: string,
  seasonId: string,
): Promise<PlayerRankingRow | null> {
  const { data, error } = await admin.rpc('ensure_player_ranking', {
    p_user_id: userId,
    p_season_id: seasonId,
  });
  if (error || !data) {
    const { data: existing } = await admin
      .from('player_rankings')
      .select('*')
      .eq('user_id', userId)
      .eq('season_id', seasonId)
      .maybeSingle();
    return (existing as PlayerRankingRow | null) ?? null;
  }
  return data as PlayerRankingRow;
}

export function publicRankedProfile(
  season: RankedSeasonRow,
  ranking: PlayerRankingRow,
): Record<string, unknown> {
  const placed = ranking.placement_matches_completed >= PLACEMENT_MATCHES_REQUIRED;
  return {
    seasonId: season.id,
    seasonName: season.name,
    seasonEndsAt: season.ends_at,
    seasonStartsAt: season.starts_at,
    rating: placed ? ranking.rating : null,
    division: ranking.current_division,
    placementMatchesCompleted: ranking.placement_matches_completed,
    placementMatchesRequired: PLACEMENT_MATCHES_REQUIRED,
    rankedMatchesPlayed: ranking.ranked_matches_played,
    wins: ranking.wins,
    losses: ranking.losses,
    draws: ranking.draws,
    currentWinStreak: ranking.current_win_streak,
    longestWinStreak: ranking.longest_win_streak,
    peakRating: placed ? ranking.peak_rating : null,
    peakDivision: ranking.peak_division,
  };
}

export async function loadVisibleOpponentRanked(
  admin: AdminClient,
  opponentUserId: string,
  seasonId: string,
): Promise<{ division: string; placementComplete: boolean }> {
  const ranking = await ensureRanking(admin, opponentUserId, seasonId);
  if (!ranking) {
    return { division: 'unranked', placementComplete: false };
  }
  const placementComplete =
    ranking.placement_matches_completed >= PLACEMENT_MATCHES_REQUIRED;
  return {
    division: placementComplete ? ranking.current_division : 'unranked',
    placementComplete,
  };
}

export async function maybeFinalizeRankedMatch(
  admin: AdminClient,
  matchId: string,
  mode: string,
  status: string,
  startsAt: string | null,
): Promise<Record<string, unknown> | null> {
  if (mode !== 'ranked') {
    return null;
  }
  if (status !== 'completed' && status !== 'forfeited') {
    return null;
  }
  if (!startsAt) {
    return null;
  }

  const { data, error } = await admin.rpc('finalize_ranked_match', {
    p_match_id: matchId,
  });

  if (error) {
    return null;
  }
  return (data as Record<string, unknown> | null) ?? null;
}

export function asRankedQueue(row: QueueRow | null): RankedQueueRow | null {
  return row as RankedQueueRow | null;
}
