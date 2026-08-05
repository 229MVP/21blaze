import { GAME_DURATION_SECONDS } from './game/constants.ts';

export const DAILY_CHALLENGE_RULES_VERSION = 1;
export const DAILY_CHALLENGE_SCORING_VERSION = 1;
export const DAILY_CHALLENGE_RANKING_RULES_VERSION = 1;
export const DAILY_CHALLENGE_SUBMISSION_GRACE_SECONDS = 30;
export const DAILY_CHALLENGE_VERIFICATION_GRACE_MINUTES = 10;

export function getUtcChallengeDate(nowMs = Date.now()): string {
  return new Date(nowMs).toISOString().slice(0, 10);
}

export function deriveDailyChallengeSeed(challengeDate: string): number {
  const input = `21blaze-daily-v1:${challengeDate}`;
  let hash = 2_166_136_261 >>> 0;

  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 1_677_761_9) >>> 0;
  }

  return (hash % 0x8000_0000) | 0;
}

export function utcMidnightForDate(challengeDate: string): Date {
  return new Date(`${challengeDate}T00:00:00.000Z`);
}

export function utcNextMidnightForDate(challengeDate: string): Date {
  return new Date(utcMidnightForDate(challengeDate).getTime() + 24 * 60 * 60 * 1000);
}

export type DailyChallengeRow = {
  id: string;
  challenge_date: string;
  seed: number;
  rules_version: number;
  scoring_version: number;
  duration_seconds: number;
  status: string;
  starts_at: string;
  ends_at: string;
  finalized_at?: string | null;
  ranking_rules_version?: number;
};

export type DailyChallengeAttemptRow = {
  id: string;
  challenge_id: string;
  user_id: string;
  attempt_type: 'ranked' | 'practice';
  status: string;
  started_at: string | null;
  completed_at: string | null;
  first_move_at: string | null;
  verified_score: number | null;
  verified_clears: number | null;
  verified_exact_21_count: number | null;
  verified_five_card_clears: number | null;
  verified_bust_count: number | null;
  verified_multiplier: number | null;
  elapsed_time_ms: number | null;
  scoring_version: number | null;
  verification_status: string | null;
  daily_rank: number | null;
  challenge_points: number | null;
  move_log: unknown;
  game_over_reason: string | null;
  created_at: string;
};

export type VerifiedAttemptRankingRow = {
  id: string;
  verified_score: number;
  verified_exact_21_count: number;
  verified_five_card_clears: number;
  verified_bust_count: number;
  verified_multiplier: number;
  elapsed_time_ms: number | null;
  completed_at: string;
};

export function challengePointsForRank(rank: number): number {
  if (!Number.isFinite(rank) || rank < 1) {
    return 0;
  }
  if (rank === 1) {
    return 100;
  }
  if (rank === 2) {
    return 90;
  }
  if (rank === 3) {
    return 85;
  }
  if (rank <= 10) {
    return 75;
  }
  if (rank <= 25) {
    return 60;
  }
  if (rank <= 50) {
    return 45;
  }
  if (rank <= 100) {
    return 30;
  }
  return 15;
}

export function compareVerifiedAttempts(
  a: VerifiedAttemptRankingRow,
  b: VerifiedAttemptRankingRow,
): number {
  if (a.verified_score !== b.verified_score) {
    return b.verified_score - a.verified_score;
  }
  if (a.verified_exact_21_count !== b.verified_exact_21_count) {
    return b.verified_exact_21_count - a.verified_exact_21_count;
  }
  if (a.verified_five_card_clears !== b.verified_five_card_clears) {
    return b.verified_five_card_clears - a.verified_five_card_clears;
  }
  if (a.verified_bust_count !== b.verified_bust_count) {
    return a.verified_bust_count - b.verified_bust_count;
  }
  if (a.verified_multiplier !== b.verified_multiplier) {
    return b.verified_multiplier - a.verified_multiplier;
  }
  const aElapsed = a.elapsed_time_ms ?? Number.MAX_SAFE_INTEGER;
  const bElapsed = b.elapsed_time_ms ?? Number.MAX_SAFE_INTEGER;
  if (aElapsed !== bElapsed) {
    return aElapsed - bElapsed;
  }
  return Date.parse(a.completed_at) - Date.parse(b.completed_at);
}

export function utcWeekStartForDate(challengeDate: string): string {
  const date = new Date(`${challengeDate}T00:00:00.000Z`);
  const day = date.getUTCDay();
  const diffFromMonday = day === 0 ? 6 : day - 1;
  date.setUTCDate(date.getUTCDate() - diffFromMonday);
  return date.toISOString().slice(0, 10);
}

export async function finalizeExpiredDailyChallenges(
  admin: { rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ error: unknown }> },
): Promise<void> {
  const { error } = await admin.rpc('finalize_expired_daily_challenges');
  if (error) {
    throw new Error('Unable to finalize expired challenges.');
  }
}

export function isPastVerificationGrace(endsAtIso: string, nowMs = Date.now()): boolean {
  const graceMs = DAILY_CHALLENGE_VERIFICATION_GRACE_MINUTES * 60 * 1000;
  return nowMs > Date.parse(endsAtIso) + graceMs;
}

/**
 * Lazy creation strategy: the first authenticated request for a UTC day
 * inserts the challenge row idempotently. Historical rows remain immutable.
 */
export async function ensureDailyChallenge(
  admin: { from: (table: string) => any },
  challengeDate: string,
): Promise<DailyChallengeRow> {
  const { data: existing, error: selectError } = await admin
    .from('daily_challenges')
    .select('*')
    .eq('challenge_date', challengeDate)
    .maybeSingle();

  if (selectError) {
    throw new Error('Unable to load daily challenge.');
  }

  if (existing) {
    return existing as DailyChallengeRow;
  }

  const startsAt = utcMidnightForDate(challengeDate).toISOString();
  const endsAt = utcNextMidnightForDate(challengeDate).toISOString();
  const seed = deriveDailyChallengeSeed(challengeDate);

  const { data: inserted, error: insertError } = await admin
    .from('daily_challenges')
    .insert({
      challenge_date: challengeDate,
      seed,
      rules_version: DAILY_CHALLENGE_RULES_VERSION,
      scoring_version: DAILY_CHALLENGE_SCORING_VERSION,
      duration_seconds: GAME_DURATION_SECONDS,
      status: 'active',
      starts_at: startsAt,
      ends_at: endsAt,
    })
    .select('*')
    .single();

  if (insertError) {
    if (insertError.code === '23505') {
      const { data: raced } = await admin
        .from('daily_challenges')
        .select('*')
        .eq('challenge_date', challengeDate)
        .maybeSingle();
      if (raced) {
        return raced as DailyChallengeRow;
      }
    }
    throw new Error('Unable to create daily challenge.');
  }

  return inserted as DailyChallengeRow;
}

export function mapChallengeConfig(row: DailyChallengeRow) {
  return {
    challengeId: row.id,
    challengeDate: row.challenge_date,
    seed: row.seed,
    rulesVersion: row.rules_version,
    scoringVersion: row.scoring_version,
    durationSeconds: row.duration_seconds,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
  };
}

export function attemptExpiresAt(startedAtIso: string): string {
  const startedMs = Date.parse(startedAtIso);
  const graceMs = (GAME_DURATION_SECONDS + DAILY_CHALLENGE_SUBMISSION_GRACE_SECONDS) * 1000;
  return new Date(startedMs + graceMs).toISOString();
}

export async function updateChallengeStreak(
  admin: { from: (table: string) => any },
  userId: string,
  completedDate: string,
): Promise<{ currentStreak: number; longestStreak: number }> {
  const { data: existing } = await admin
    .from('daily_challenge_streaks')
    .select('current_streak, longest_streak, last_completed_date')
    .eq('user_id', userId)
    .maybeSingle();

  let currentStreak = 1;
  let longestStreak = 1;

  if (existing?.last_completed_date) {
    const lastDate = String(existing.last_completed_date);
    if (lastDate === completedDate) {
      currentStreak = existing.current_streak ?? 1;
      longestStreak = existing.longest_streak ?? currentStreak;
    } else {
      const lastMs = Date.parse(`${lastDate}T00:00:00.000Z`);
      const completedMs = Date.parse(`${completedDate}T00:00:00.000Z`);
      const dayGap = Math.round((completedMs - lastMs) / (24 * 60 * 60 * 1000));
      if (dayGap === 1) {
        currentStreak = (existing.current_streak ?? 0) + 1;
      }
      longestStreak = Math.max(existing.longest_streak ?? 0, currentStreak);
    }
  }

  await admin.from('daily_challenge_streaks').upsert({
    user_id: userId,
    current_streak: currentStreak,
    longest_streak: longestStreak,
    last_completed_date: completedDate,
    updated_at: new Date().toISOString(),
  });

  return { currentStreak, longestStreak };
}

export async function loadVerifiedRankingAttempts(
  admin: { from: (table: string) => any },
  challengeId: string,
): Promise<VerifiedAttemptRankingRow[]> {
  const { data, error } = await admin
    .from('daily_challenge_attempts')
    .select(
      'id, verified_score, verified_exact_21_count, verified_five_card_clears, verified_bust_count, verified_multiplier, elapsed_time_ms, completed_at',
    )
    .eq('challenge_id', challengeId)
    .eq('attempt_type', 'ranked')
    .eq('status', 'completed')
    .eq('verification_status', 'verified')
    .not('verified_score', 'is', null);

  if (error) {
    throw new Error('Unable to load verified attempts for ranking.');
  }

  return (data ?? []) as VerifiedAttemptRankingRow[];
}

export function rankVerifiedAttempts(
  rows: VerifiedAttemptRankingRow[],
): Array<VerifiedAttemptRankingRow & { rank: number; challengePoints: number }> {
  const sorted = [...rows].sort(compareVerifiedAttempts);
  return sorted.map((row, index) => ({
    ...row,
    rank: index + 1,
    challengePoints: challengePointsForRank(index + 1),
  }));
}

export async function persistDailyRanksForChallenge(
  admin: { from: (table: string) => any },
  challengeId: string,
): Promise<void> {
  const rows = await loadVerifiedRankingAttempts(admin, challengeId);
  const ranked = rankVerifiedAttempts(rows);

  for (const row of ranked) {
    await admin
      .from('daily_challenge_attempts')
      .update({
        daily_rank: row.rank,
        challenge_points: row.challengePoints,
      })
      .eq('id', row.id);
  }
}

export async function computeRankForAttempt(
  admin: { from: (table: string) => any },
  challengeId: string,
  attemptId: string,
): Promise<{
  rank: number;
  challengePoints: number;
  totalPlayers: number;
  percentile: number | null;
}> {
  const rows = await loadVerifiedRankingAttempts(admin, challengeId);
  const ranked = rankVerifiedAttempts(rows);
  const totalPlayers = ranked.length;
  const match = ranked.find((row) => row.id === attemptId);
  const rank = match?.rank ?? totalPlayers;
  const challengePoints = match?.challengePoints ?? challengePointsForRank(rank);
  const percentile =
    totalPlayers > 1
      ? Math.round(((totalPlayers - rank) / (totalPlayers - 1)) * 100)
      : null;

  return { rank, challengePoints, totalPlayers, percentile };
}

type WeeklyAggregateRow = {
  user_id: string;
  challenge_points: number;
  verified_days_completed: number;
  best_daily_rank: number;
  total_verified_score: number;
  total_exact_21_count: number;
  total_five_card_clears: number;
  total_bust_count: number;
  last_contributed_at: string;
};

function compareWeeklyAggregates(a: WeeklyAggregateRow, b: WeeklyAggregateRow): number {
  if (a.challenge_points !== b.challenge_points) {
    return b.challenge_points - a.challenge_points;
  }
  if (a.verified_days_completed !== b.verified_days_completed) {
    return b.verified_days_completed - a.verified_days_completed;
  }
  if (a.best_daily_rank !== b.best_daily_rank) {
    return a.best_daily_rank - b.best_daily_rank;
  }
  if (a.total_verified_score !== b.total_verified_score) {
    return b.total_verified_score - a.total_verified_score;
  }
  if (a.total_exact_21_count !== b.total_exact_21_count) {
    return b.total_exact_21_count - a.total_exact_21_count;
  }
  if (a.total_five_card_clears !== b.total_five_card_clears) {
    return b.total_five_card_clears - a.total_five_card_clears;
  }
  if (a.total_bust_count !== b.total_bust_count) {
    return a.total_bust_count - b.total_bust_count;
  }
  return Date.parse(a.last_contributed_at) - Date.parse(b.last_contributed_at);
}

export async function computeWeeklyRankForUser(
  admin: { from: (table: string) => any },
  userId: string,
  challengeDate: string,
): Promise<number | null> {
  const weekStart = utcWeekStartForDate(challengeDate);
  const weekStartMs = Date.parse(`${weekStart}T00:00:00.000Z`);
  const weekEndMs = weekStartMs + 7 * 24 * 60 * 60 * 1000;

  const { data, error } = await admin
    .from('daily_challenge_leaderboard')
    .select(
      'user_id, challenge_date, rank, score, exact_21_count, five_card_clears, bust_count, challenge_points, completed_at',
    )
    .gte('challenge_date', weekStart);

  if (error) {
    return null;
  }

  const inWeek = (data ?? []).filter((row: { challenge_date: string }) => {
    const dateMs = Date.parse(`${row.challenge_date}T00:00:00.000Z`);
    return dateMs >= weekStartMs && dateMs < weekEndMs;
  });

  const aggregates = new Map<string, WeeklyAggregateRow>();
  for (const row of inWeek as Array<{
    user_id: string;
    rank: number;
    score: number;
    exact_21_count: number;
    five_card_clears: number;
    bust_count: number;
    challenge_points: number;
    completed_at: string;
  }>) {
    const existing = aggregates.get(row.user_id);
    if (!existing) {
      aggregates.set(row.user_id, {
        user_id: row.user_id,
        challenge_points: row.challenge_points,
        verified_days_completed: 1,
        best_daily_rank: row.rank,
        total_verified_score: row.score,
        total_exact_21_count: row.exact_21_count,
        total_five_card_clears: row.five_card_clears,
        total_bust_count: row.bust_count,
        last_contributed_at: row.completed_at,
      });
      continue;
    }
    existing.challenge_points += row.challenge_points;
    existing.verified_days_completed += 1;
    existing.best_daily_rank = Math.min(existing.best_daily_rank, row.rank);
    existing.total_verified_score += row.score;
    existing.total_exact_21_count += row.exact_21_count;
    existing.total_five_card_clears += row.five_card_clears;
    existing.total_bust_count += row.bust_count;
    if (Date.parse(row.completed_at) > Date.parse(existing.last_contributed_at)) {
      existing.last_contributed_at = row.completed_at;
    }
  }

  const sorted = [...aggregates.values()].sort(compareWeeklyAggregates);
  const index = sorted.findIndex((row) => row.user_id === userId);
  return index >= 0 ? index + 1 : null;
}
