import { GAME_DURATION_SECONDS } from './game/constants.ts';

export const DAILY_CHALLENGE_RULES_VERSION = 1;
export const DAILY_CHALLENGE_SCORING_VERSION = 1;
export const DAILY_CHALLENGE_SUBMISSION_GRACE_SECONDS = 30;

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
  move_log: unknown;
  game_over_reason: string | null;
  created_at: string;
};

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

export async function computeRankForAttempt(
  admin: { from: (table: string) => any },
  challengeId: string,
  attemptId: string,
  score: number,
): Promise<{ rank: number; totalPlayers: number; percentile: number | null }> {
  const { count: betterCount } = await admin
    .from('daily_challenge_attempts')
    .select('id', { count: 'exact', head: true })
    .eq('challenge_id', challengeId)
    .eq('attempt_type', 'ranked')
    .eq('status', 'completed')
    .eq('verification_status', 'verified')
    .gt('verified_score', score);

  const { count: totalCount } = await admin
    .from('daily_challenge_attempts')
    .select('id', { count: 'exact', head: true })
    .eq('challenge_id', challengeId)
    .eq('attempt_type', 'ranked')
    .eq('status', 'completed')
    .eq('verification_status', 'verified');

  const rank = (betterCount ?? 0) + 1;
  const totalPlayers = totalCount ?? 0;
  const percentile =
    totalPlayers > 1
      ? Math.round(((totalPlayers - rank) / (totalPlayers - 1)) * 100)
      : null;

  void attemptId;
  return { rank, totalPlayers, percentile };
}
