import { supabase } from '../lib/supabase';
import type { GlobalLeaderboardRow } from '../lib/database.types';

function isLeaderboardRow(value: unknown): value is GlobalLeaderboardRow {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const row = value as Record<string, unknown>;
  return (
    typeof row.user_id === 'string' &&
    typeof row.display_name === 'string' &&
    typeof row.score === 'number' &&
    typeof row.lanes_cleared === 'number' &&
    typeof row.cards_played === 'number' &&
    typeof row.rank === 'number'
  );
}

export async function loadGlobalLeaderboard(
  limit = 25,
): Promise<GlobalLeaderboardRow[]> {
  const safeLimit = Math.min(100, Math.max(1, Math.floor(limit)));

  const { data, error } = await supabase
    .from('global_leaderboard')
    .select(
      'user_id, display_name, score, lanes_cleared, cards_played, busts, time_remaining_seconds, game_over_reason, created_at, rank',
    )
    .order('rank', { ascending: true })
    .limit(safeLimit);

  if (error) {
    throw new Error(error.message || 'Unable to load global leaderboard.');
  }

  if (!Array.isArray(data)) {
    return [];
  }

  return data.filter(isLeaderboardRow);
}

export async function loadCurrentPlayerRank(
  userId: string,
): Promise<GlobalLeaderboardRow | null> {
  const { data, error } = await supabase
    .from('global_leaderboard')
    .select(
      'user_id, display_name, score, lanes_cleared, cards_played, busts, time_remaining_seconds, game_over_reason, created_at, rank',
    )
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || 'Unable to load player rank.');
  }

  if (!data || !isLeaderboardRow(data)) {
    return null;
  }

  return data;
}

export async function loadCurrentPlayerVerifiedScores(
  userId: string,
  limit = 10,
): Promise<
  Array<{
    id: string;
    score: number;
    lanes_cleared: number;
    cards_played: number;
    busts: number;
    time_remaining_seconds: number;
    game_over_reason: string;
    created_at: string;
  }>
> {
  const safeLimit = Math.min(50, Math.max(1, Math.floor(limit)));

  const { data, error } = await supabase
    .from('verified_scores')
    .select(
      'id, score, lanes_cleared, cards_played, busts, time_remaining_seconds, game_over_reason, created_at',
    )
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(safeLimit);

  if (error) {
    throw new Error(error.message || 'Unable to load verified scores.');
  }

  return Array.isArray(data) ? data : [];
}
