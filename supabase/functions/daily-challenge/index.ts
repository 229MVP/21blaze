import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

import { parseJsonBody, requireAuthedUser } from '../_shared/auth.ts';
import { corsHeaders, errorResponse, jsonResponse } from '../_shared/cors.ts';
import {
  grantParticipationReward,
  grantStreakMilestones,
} from '../_shared/challengeRewards.ts';
import {
  computeRankForAttempt,
  computeWeeklyRankForUser,
  finalizeExpiredDailyChallenges,
  ensureDailyChallenge,
  getUtcChallengeDate,
  isPastVerificationGrace,
  mapChallengeConfig,
  persistDailyRanksForChallenge,
  updateChallengeStreak,
  utcWeekStartForDate,
} from '../_shared/dailyChallenge.ts';
import { replayMatch, validateMoveLog } from '../_shared/game/replayMatch.ts';
import type { MoveLogEntry } from '../_shared/game/types.ts';

type DailyChallengeAction =
  | 'get_status'
  | 'start_attempt'
  | 'record_first_move'
  | 'complete_attempt'
  | 'abandon_attempt'
  | 'get_leaderboard'
  | 'get_daily_leaderboard'
  | 'get_weekly_leaderboard'
  | 'get_nearby_daily_ranks'
  | 'get_nearby_weekly_ranks'
  | 'get_reward_status'
  | 'claim_weekly_reward';

function isAction(value: unknown): value is DailyChallengeAction {
  return (
    value === 'get_status' ||
    value === 'start_attempt' ||
    value === 'record_first_move' ||
    value === 'complete_attempt' ||
    value === 'abandon_attempt' ||
    value === 'get_leaderboard' ||
    value === 'get_daily_leaderboard' ||
    value === 'get_weekly_leaderboard' ||
    value === 'get_nearby_daily_ranks' ||
    value === 'get_nearby_weekly_ranks' ||
    value === 'get_reward_status' ||
    value === 'claim_weekly_reward'
  );
}

function isAttemptType(value: unknown): value is 'ranked' | 'practice' {
  return value === 'ranked' || value === 'practice';
}

function mapAttempt(row: Record<string, unknown>) {
  return {
    attemptId: row.id,
    challengeId: row.challenge_id,
    attemptType: row.attempt_type,
    status: row.status,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    firstMoveAt: row.first_move_at,
    verifiedScore: row.verified_score,
    verificationStatus: row.verification_status,
    scoringVersion: row.scoring_version,
  };
}

async function loadRankedAttempt(
  admin: ReturnType<typeof import('../_shared/supabaseAdmin.ts').createServiceClient>,
  challengeId: string,
  userId: string,
) {
  const { data } = await admin
    .from('daily_challenge_attempts')
    .select('*')
    .eq('challenge_id', challengeId)
    .eq('user_id', userId)
    .eq('attempt_type', 'ranked')
    .maybeSingle();

  return data;
}

async function handleGetStatus(
  admin: ReturnType<typeof import('../_shared/supabaseAdmin.ts').createServiceClient>,
  userId: string,
) {
  await finalizeExpiredDailyChallenges(admin);
  const nowMs = Date.now();
  const challengeDate = getUtcChallengeDate(nowMs);
  const challenge = await ensureDailyChallenge(admin, challengeDate);

  const rankedAttempt = await loadRankedAttempt(admin, challenge.id, userId);

  const { data: streakRow } = await admin
    .from('daily_challenge_streaks')
    .select('current_streak, longest_streak, last_completed_date')
    .eq('user_id', userId)
    .maybeSingle();

  return jsonResponse({
    serverTime: new Date(nowMs).toISOString(),
    challenge: mapChallengeConfig(challenge),
    rankedAttempt: rankedAttempt ? mapAttempt(rankedAttempt) : null,
    streak: {
      current: streakRow?.current_streak ?? 0,
      longest: streakRow?.longest_streak ?? 0,
      lastCompletedDate: streakRow?.last_completed_date ?? null,
    },
  });
}

async function handleStartAttempt(
  admin: ReturnType<typeof import('../_shared/supabaseAdmin.ts').createServiceClient>,
  userId: string,
  attemptType: 'ranked' | 'practice',
) {
  await finalizeExpiredDailyChallenges(admin);
  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const challengeDate = getUtcChallengeDate(nowMs);
  const challenge = await ensureDailyChallenge(admin, challengeDate);

  if (attemptType === 'ranked' && isPastVerificationGrace(challenge.ends_at, nowMs)) {
    return errorResponse('Daily Challenge ranked attempts are closed for today.', 409);
  }

  if (attemptType === 'ranked') {
    const existing = await loadRankedAttempt(admin, challenge.id, userId);

    if (existing) {
      if (existing.status === 'completed') {
        return errorResponse('Ranked attempt already completed for today.', 409);
      }

      if (existing.status === 'abandoned' || existing.status === 'rejected') {
        return errorResponse('Ranked attempt is no longer available.', 409);
      }

      if (existing.status === 'expired') {
        return errorResponse('Ranked attempt has expired.', 409);
      }

      // Idempotent resume before gameplay begins.
      if (existing.status === 'created' || existing.status === 'started') {
        const expiresAt = existing.started_at
          ? attemptExpiresAt(existing.started_at)
          : attemptExpiresAt(nowIso);

        return jsonResponse({
          challenge: mapChallengeConfig(challenge),
          attempt: mapAttempt(existing),
          serverTime: nowIso,
          expiresAt,
        });
      }
    }

    const { data: inserted, error } = await admin
      .from('daily_challenge_attempts')
      .insert({
        challenge_id: challenge.id,
        user_id: userId,
        attempt_type: 'ranked',
        status: 'created',
        started_at: nowIso,
        scoring_version: challenge.scoring_version,
        verification_status: 'pending',
      })
      .select('*')
      .single();

    if (error) {
      if (error.code === '23505') {
        const raced = await loadRankedAttempt(admin, challenge.id, userId);
        if (raced) {
          return jsonResponse({
            challenge: mapChallengeConfig(challenge),
            attempt: mapAttempt(raced),
            serverTime: nowIso,
            expiresAt: raced.started_at
              ? attemptExpiresAt(raced.started_at)
              : attemptExpiresAt(nowIso),
          });
        }
      }
      return errorResponse('Unable to start ranked attempt.', 500);
    }

    return jsonResponse({
      challenge: mapChallengeConfig(challenge),
      attempt: mapAttempt(inserted),
      serverTime: nowIso,
      expiresAt: attemptExpiresAt(nowIso),
    });
  }

  const { data: practiceAttempt, error: practiceError } = await admin
    .from('daily_challenge_attempts')
    .insert({
      challenge_id: challenge.id,
      user_id: userId,
      attempt_type: 'practice',
      status: 'created',
      started_at: nowIso,
      scoring_version: challenge.scoring_version,
      verification_status: 'pending',
    })
    .select('*')
    .single();

  if (practiceError || !practiceAttempt) {
    return errorResponse('Unable to start practice attempt.', 500);
  }

  return jsonResponse({
    challenge: mapChallengeConfig(challenge),
    attempt: mapAttempt(practiceAttempt),
    serverTime: nowIso,
    expiresAt: attemptExpiresAt(nowIso),
  });
}

async function handleRecordFirstMove(
  admin: ReturnType<typeof import('../_shared/supabaseAdmin.ts').createServiceClient>,
  userId: string,
  attemptId: string,
) {
  const { data: attempt, error } = await admin
    .from('daily_challenge_attempts')
    .select('*')
    .eq('id', attemptId)
    .maybeSingle();

  if (error || !attempt) {
    return errorResponse('Attempt not found.', 404);
  }

  if (attempt.user_id !== userId) {
    return errorResponse('Attempt ownership mismatch.', 403);
  }

  if (attempt.status === 'completed') {
    return jsonResponse({ attempt: mapAttempt(attempt) });
  }

  if (attempt.status === 'abandoned' || attempt.status === 'rejected' || attempt.status === 'expired') {
    return errorResponse('Attempt is no longer active.', 409);
  }

  const nowIso = new Date().toISOString();

  if (attempt.first_move_at) {
    return jsonResponse({ attempt: mapAttempt(attempt) });
  }

  const { data: updated, error: updateError } = await admin
    .from('daily_challenge_attempts')
    .update({
      status: 'started',
      first_move_at: nowIso,
    })
    .eq('id', attemptId)
    .in('status', ['created', 'started'])
    .select('*')
    .maybeSingle();

  if (updateError || !updated) {
    return errorResponse('Unable to record first move.', 500);
  }

  return jsonResponse({ attempt: mapAttempt(updated) });
}

async function handleCompleteAttempt(
  admin: ReturnType<typeof import('../_shared/supabaseAdmin.ts').createServiceClient>,
  userId: string,
  attemptId: string,
  moves: MoveLogEntry[],
) {
  const { data: attempt, error } = await admin
    .from('daily_challenge_attempts')
    .select('*, daily_challenges!inner(challenge_date, seed, scoring_version, duration_seconds, ends_at, status, finalized_at)')
    .eq('id', attemptId)
    .maybeSingle();

  if (error || !attempt) {
    return errorResponse('Attempt not found.', 404);
  }

  if (attempt.user_id !== userId) {
    return errorResponse('Attempt ownership mismatch.', 403);
  }

  if (attempt.attempt_type === 'practice') {
    return errorResponse('Practice attempts cannot be submitted to the leaderboard.', 400);
  }

  if (attempt.status === 'completed' && attempt.verification_status === 'verified') {
    const rankInfo = await computeRankForAttempt(
      admin,
      attempt.challenge_id,
      attemptId,
    );
    const weeklyRank = await computeWeeklyRankForUser(
      admin,
      userId,
      challenge.challenge_date,
    );

    return jsonResponse({
      verified: true,
      attempt: mapAttempt(attempt),
      result: {
        score: attempt.verified_score,
        lanesCleared: attempt.verified_clears,
        exact21Count: attempt.verified_exact_21_count,
        fiveCardClears: attempt.verified_five_card_clears,
        bustCount: attempt.verified_bust_count,
        bestMultiplier: attempt.verified_multiplier,
        elapsedTimeMs: attempt.elapsed_time_ms,
        gameOverReason: attempt.game_over_reason,
        rank: rankInfo.rank,
        challengePoints: rankInfo.challengePoints,
        weeklyRank,
        percentile: rankInfo.percentile,
        totalPlayers: rankInfo.totalPlayers,
      },
    });
  }

  if (attempt.status === 'abandoned' || attempt.status === 'rejected' || attempt.status === 'expired') {
    return jsonResponse(
      { verified: false, rejectionReason: `Attempt is ${attempt.status}.` },
      409,
    );
  }

  const challenge = attempt.daily_challenges as {
    challenge_date: string;
    seed: number;
    scoring_version: number;
    ends_at: string;
    status: string;
    finalized_at: string | null;
  };

  if (isPastVerificationGrace(challenge.ends_at, Date.now())) {
    return jsonResponse(
      { verified: false, rejectionReason: 'Challenge submission grace period has ended.' },
      409,
    );
  }

  const moveValidation = validateMoveLog(moves);
  if (!moveValidation.ok) {
    await admin
      .from('daily_challenge_attempts')
      .update({
        status: 'rejected',
        verification_status: 'rejected',
        completed_at: new Date().toISOString(),
      })
      .eq('id', attemptId);

    return jsonResponse(
      { verified: false, rejectionReason: moveValidation.reason },
      400,
    );
  }

  const replay = replayMatch(challenge.seed, moveValidation.moves);
  if (!replay.ok) {
    await admin
      .from('daily_challenge_attempts')
      .update({
        status: 'rejected',
        verification_status: 'rejected',
        completed_at: new Date().toISOString(),
      })
      .eq('id', attemptId);

    return jsonResponse(
      { verified: false, rejectionReason: replay.reason },
      400,
    );
  }

  const completedAt = new Date().toISOString();
  const elapsedTimeMs =
    moveValidation.moves.length > 0
      ? moveValidation.moves[moveValidation.moves.length - 1].elapsedMilliseconds
      : 0;

  const { data: updated, error: updateError } = await admin
    .from('daily_challenge_attempts')
    .update({
      status: 'completed',
      completed_at: completedAt,
      verified_score: replay.result.score,
      verified_clears: replay.result.lanesCleared,
      verified_exact_21_count: replay.result.lanesCleared,
      verified_five_card_clears: 0,
      verified_bust_count: replay.result.busts,
      verified_multiplier: 1,
      elapsed_time_ms: elapsedTimeMs,
      scoring_version: challenge.scoring_version,
      verification_status: 'verified',
      move_log: moveValidation.moves,
      game_over_reason: replay.result.gameOverReason,
    })
    .eq('id', attemptId)
    .in('status', ['created', 'started'])
    .select('*')
    .single();

  if (updateError) {
    if (updateError.code === '23505') {
      const { data: raced } = await admin
        .from('daily_challenge_attempts')
        .select('*')
        .eq('id', attemptId)
        .maybeSingle();
      if (raced?.verification_status === 'verified') {
        const rankInfo = await computeRankForAttempt(
          admin,
          raced.challenge_id,
          attemptId,
        );
        const weeklyRank = await computeWeeklyRankForUser(
          admin,
          userId,
          challenge.challenge_date,
        );
        return jsonResponse({
          verified: true,
          attempt: mapAttempt(raced),
          result: {
            score: raced.verified_score,
            lanesCleared: raced.verified_clears,
            exact21Count: raced.verified_exact_21_count,
            fiveCardClears: raced.verified_five_card_clears,
            bustCount: raced.verified_bust_count,
            bestMultiplier: raced.verified_multiplier,
            elapsedTimeMs: raced.elapsed_time_ms,
            gameOverReason: raced.game_over_reason,
            rank: rankInfo.rank,
            challengePoints: rankInfo.challengePoints,
            weeklyRank,
            percentile: rankInfo.percentile,
            totalPlayers: rankInfo.totalPlayers,
          },
        });
      }
    }
    return errorResponse('Unable to store verified result.', 500);
  }

  await persistDailyRanksForChallenge(admin, updated.challenge_id);

  const participationReward = await grantParticipationReward(
    admin,
    userId,
    updated.challenge_id,
  );

  const streak = await updateChallengeStreak(
    admin,
    userId,
    challenge.challenge_date,
  );

  await grantStreakMilestones(admin, userId, streak.currentStreak);

  const rankInfo = await computeRankForAttempt(
    admin,
    updated.challenge_id,
    attemptId,
  );
  const weeklyRank = await computeWeeklyRankForUser(
    admin,
    userId,
    challenge.challenge_date,
  );

  return jsonResponse({
    verified: true,
    attempt: mapAttempt(updated),
    result: {
      score: replay.result.score,
      lanesCleared: replay.result.lanesCleared,
      exact21Count: replay.result.lanesCleared,
      fiveCardClears: 0,
      bustCount: replay.result.busts,
      bestMultiplier: 1,
      elapsedTimeMs,
      gameOverReason: replay.result.gameOverReason,
      rank: rankInfo.rank,
      challengePoints: rankInfo.challengePoints,
      weeklyRank,
      percentile: rankInfo.percentile,
      totalPlayers: rankInfo.totalPlayers,
      participationCoins: participationReward.blazeCoins,
      participationXp: participationReward.xp,
    },
    streak,
    participationReward,
  });
}

async function handleAbandonAttempt(
  admin: ReturnType<typeof import('../_shared/supabaseAdmin.ts').createServiceClient>,
  userId: string,
  attemptId: string,
) {
  const { data: attempt } = await admin
    .from('daily_challenge_attempts')
    .select('*')
    .eq('id', attemptId)
    .maybeSingle();

  if (!attempt) {
    return errorResponse('Attempt not found.', 404);
  }

  if (attempt.user_id !== userId) {
    return errorResponse('Attempt ownership mismatch.', 403);
  }

  if (attempt.status === 'completed') {
    return errorResponse('Completed attempts cannot be abandoned.', 409);
  }

  if (attempt.attempt_type !== 'ranked') {
    await admin
      .from('daily_challenge_attempts')
      .update({ status: 'abandoned', completed_at: new Date().toISOString() })
      .eq('id', attemptId);
    return jsonResponse({ attempt: { attemptId, status: 'abandoned' } });
  }

  const nextStatus = attempt.first_move_at ? 'abandoned' : 'expired';

  await admin
    .from('daily_challenge_attempts')
    .update({
      status: nextStatus,
      completed_at: new Date().toISOString(),
    })
    .eq('id', attemptId)
    .in('status', ['created', 'started']);

  return jsonResponse({ attempt: { attemptId, status: nextStatus } });
}

async function handleGetLeaderboard(
  admin: ReturnType<typeof import('../_shared/supabaseAdmin.ts').createServiceClient>,
  userId: string,
  challengeDate?: string,
) {
  return await handleGetDailyLeaderboard(admin, userId, challengeDate);
}

function mapDailyLeaderboardEntry(
  row: Record<string, unknown>,
  userId: string,
) {
  return {
    rank: row.rank,
    playerName: row.player_name,
    score: row.score,
    exact21Count: row.exact_21_count,
    fiveCardClears: row.five_card_clears,
    bustCount: row.bust_count,
    bestMultiplier: row.best_multiplier,
    elapsedTimeMs: row.elapsed_time_ms,
    challengePoints: row.challenge_points,
    profileFrameId: row.profile_frame_id,
    playerTitleId: row.player_title_id,
    isCurrentPlayer: row.user_id === userId,
  };
}

async function handleGetDailyLeaderboard(
  admin: ReturnType<typeof import('../_shared/supabaseAdmin.ts').createServiceClient>,
  userId: string,
  challengeDate?: string,
  afterRank = 0,
  limit = 100,
) {
  await finalizeExpiredDailyChallenges(admin);
  const date = challengeDate ?? getUtcChallengeDate(Date.now());
  const challenge = await ensureDailyChallenge(admin, date);
  const boundedLimit = Math.min(Math.max(limit, 1), 100);
  const boundedAfter = Math.max(afterRank, 0);

  const { count: totalParticipants } = await admin
    .from('daily_challenge_leaderboard')
    .select('user_id', { count: 'exact', head: true })
    .eq('challenge_id', challenge.id);

  const { data: rows, error } = await admin
    .from('daily_challenge_leaderboard')
    .select('*')
    .eq('challenge_id', challenge.id)
    .gt('rank', boundedAfter)
    .order('rank', { ascending: true })
    .limit(boundedLimit);

  if (error) {
    return errorResponse('Unable to load leaderboard.', 500);
  }

  const entries = (rows ?? []).map((row: Record<string, unknown>) =>
    mapDailyLeaderboardEntry(row, userId),
  );

  const { data: playerRow } = await admin
    .from('daily_challenge_leaderboard')
    .select('*')
    .eq('challenge_id', challenge.id)
    .eq('user_id', userId)
    .maybeSingle();

  const finalized =
    challenge.status === 'closed' ||
  Boolean((challenge as { finalized_at?: string | null }).finalized_at);

  return jsonResponse({
    challengeDate: date,
    challengeId: challenge.id,
    endsAt: challenge.ends_at,
    finalized,
    totalParticipants: totalParticipants ?? 0,
    entries,
    playerRank: playerRow
      ? {
          rank: playerRow.rank,
          score: playerRow.score,
          challengePoints: playerRow.challenge_points,
          verificationStatus: 'verified',
        }
      : null,
    serverTime: new Date().toISOString(),
  });
}

async function handleGetNearbyDailyRanks(
  admin: ReturnType<typeof import('../_shared/supabaseAdmin.ts').createServiceClient>,
  userId: string,
  challengeDate?: string,
  window = 2,
) {
  const date = challengeDate ?? getUtcChallengeDate(Date.now());
  const challenge = await ensureDailyChallenge(admin, date);
  const boundedWindow = Math.min(Math.max(window, 1), 10);

  const { data: playerRow } = await admin
    .from('daily_challenge_leaderboard')
    .select('rank')
    .eq('challenge_id', challenge.id)
    .eq('user_id', userId)
    .maybeSingle();

  if (!playerRow?.rank) {
    return jsonResponse({ entries: [] });
  }

  const minRank = Math.max(1, playerRow.rank - boundedWindow);
  const maxRank = playerRow.rank + boundedWindow;

  const { data: rows } = await admin
    .from('daily_challenge_leaderboard')
    .select('*')
    .eq('challenge_id', challenge.id)
    .gte('rank', minRank)
    .lte('rank', maxRank)
    .order('rank', { ascending: true });

  const entries = (rows ?? []).map((row: Record<string, unknown>) => ({
    rank: row.rank,
    playerName: row.player_name,
    score: row.score,
    challengePoints: row.challenge_points,
    isCurrentPlayer: row.user_id === userId,
  }));

  return jsonResponse({ entries });
}

async function handleGetWeeklyLeaderboard(
  admin: ReturnType<typeof import('../_shared/supabaseAdmin.ts').createServiceClient>,
  userId: string,
  weekStart?: string,
  afterRank = 0,
  limit = 100,
) {
  const start =
    weekStart ?? utcWeekStartForDate(getUtcChallengeDate(Date.now()));
  const startMs = Date.parse(`${start}T00:00:00.000Z`);
  const endMs = startMs + 7 * 24 * 60 * 60 * 1000;
  const boundedLimit = Math.min(Math.max(limit, 1), 100);
  const boundedAfter = Math.max(afterRank, 0);

  const { data: dailyRows, error } = await admin
    .from('daily_challenge_leaderboard')
    .select('*')
    .gte('challenge_date', start);

  if (error) {
    return errorResponse('Unable to load weekly leaderboard.', 500);
  }

  const inWeek = (dailyRows ?? []).filter((row: { challenge_date: string }) => {
    const dateMs = Date.parse(`${row.challenge_date}T00:00:00.000Z`);
    return dateMs >= startMs && dateMs < endMs;
  });

  type WeeklyAgg = {
    user_id: string;
    player_name: string;
    profile_frame_id: string;
    player_title_id: string | null;
    challenge_points: number;
    verified_days_completed: number;
    best_daily_rank: number;
    total_verified_score: number;
    total_exact_21_count: number;
    total_five_card_clears: number;
    total_bust_count: number;
    last_contributed_at: string;
  };

  const aggregates = new Map<string, WeeklyAgg>();
  for (const row of inWeek as Array<Record<string, unknown>>) {
    const userKey = String(row.user_id);
    const existing = aggregates.get(userKey);
    if (!existing) {
      aggregates.set(userKey, {
        user_id: userKey,
        player_name: String(row.player_name),
        profile_frame_id: String(row.profile_frame_id ?? 'default_profile_frame'),
        player_title_id: row.player_title_id ? String(row.player_title_id) : null,
        challenge_points: Number(row.challenge_points ?? 0),
        verified_days_completed: 1,
        best_daily_rank: Number(row.rank),
        total_verified_score: Number(row.score ?? 0),
        total_exact_21_count: Number(row.exact_21_count ?? 0),
        total_five_card_clears: Number(row.five_card_clears ?? 0),
        total_bust_count: Number(row.bust_count ?? 0),
        last_contributed_at: String(row.completed_at),
      });
      continue;
    }
    existing.challenge_points += Number(row.challenge_points ?? 0);
    existing.verified_days_completed += 1;
    existing.best_daily_rank = Math.min(existing.best_daily_rank, Number(row.rank));
    existing.total_verified_score += Number(row.score ?? 0);
    existing.total_exact_21_count += Number(row.exact_21_count ?? 0);
    existing.total_five_card_clears += Number(row.five_card_clears ?? 0);
    existing.total_bust_count += Number(row.bust_count ?? 0);
    const completedAt = String(row.completed_at);
    if (Date.parse(completedAt) > Date.parse(existing.last_contributed_at)) {
      existing.last_contributed_at = completedAt;
    }
  }

  const sorted = [...aggregates.values()].sort((a, b) => {
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
  });

  const ranked = sorted.map((row, index) => ({ ...row, rank: index + 1 }));
  const totalParticipants = ranked.length;
  const entries = ranked
    .filter((row) => row.rank > boundedAfter)
    .slice(0, boundedLimit)
    .map((row) => ({
      rank: row.rank,
      playerName: row.player_name,
      challengePoints: row.challenge_points,
      verifiedDaysCompleted: row.verified_days_completed,
      bestDailyRank: row.best_daily_rank,
      totalVerifiedScore: row.total_verified_score,
      totalExact21Count: row.total_exact_21_count,
      totalFiveCardClears: row.total_five_card_clears,
      totalBustCount: row.total_bust_count,
      profileFrameId: row.profile_frame_id,
      playerTitleId: row.player_title_id,
      isCurrentPlayer: row.user_id === userId,
    }));

  const player = ranked.find((row) => row.user_id === userId);
  const weekEndDate = new Date(endMs - 1).toISOString().slice(0, 10);

  return jsonResponse({
    weekStart: start,
    weekEnd: weekEndDate,
    totalParticipants,
    entries,
    playerRank: player
      ? {
          rank: player.rank,
          challengePoints: player.challenge_points,
          verifiedDaysCompleted: player.verified_days_completed,
        }
      : null,
    serverTime: new Date().toISOString(),
  });
}

async function handleGetNearbyWeeklyRanks(
  admin: ReturnType<typeof import('../_shared/supabaseAdmin.ts').createServiceClient>,
  userId: string,
  weekStart?: string,
  window = 2,
) {
  const start =
    weekStart ?? utcWeekStartForDate(getUtcChallengeDate(Date.now()));
  const startMs = Date.parse(`${start}T00:00:00.000Z`);
  const endMs = startMs + 7 * 24 * 60 * 60 * 1000;
  const boundedWindow = Math.min(Math.max(window, 1), 10);

  const { data: dailyRows } = await admin
    .from('daily_challenge_leaderboard')
    .select('user_id, player_name, rank, challenge_points, challenge_date')
    .gte('challenge_date', start);

  const inWeek = (dailyRows ?? []).filter((row: { challenge_date: string }) => {
    const dateMs = Date.parse(`${row.challenge_date}T00:00:00.000Z`);
    return dateMs >= startMs && dateMs < endMs;
  });

  const aggregates = new Map<
    string,
    { user_id: string; player_name: string; challenge_points: number; best_daily_rank: number }
  >();

  for (const row of inWeek as Array<Record<string, unknown>>) {
    const userKey = String(row.user_id);
    const existing = aggregates.get(userKey);
    if (!existing) {
      aggregates.set(userKey, {
        user_id: userKey,
        player_name: String(row.player_name),
        challenge_points: Number(row.challenge_points ?? 0),
        best_daily_rank: Number(row.rank),
      });
      continue;
    }
    existing.challenge_points += Number(row.challenge_points ?? 0);
    existing.best_daily_rank = Math.min(existing.best_daily_rank, Number(row.rank));
  }

  const sorted = [...aggregates.values()].sort((a, b) => {
    if (a.challenge_points !== b.challenge_points) {
      return b.challenge_points - a.challenge_points;
    }
    return a.best_daily_rank - b.best_daily_rank;
  });

  const ranked = sorted.map((row, index) => ({ ...row, rank: index + 1 }));
  const playerRank = ranked.find((row) => row.user_id === userId)?.rank;
  if (!playerRank) {
    return jsonResponse({ entries: [] });
  }

  const entries = ranked
    .filter(
      (row) =>
        row.rank >= playerRank - boundedWindow && row.rank <= playerRank + boundedWindow,
    )
    .map((row) => ({
      rank: row.rank,
      playerName: row.player_name,
      challengePoints: row.challenge_points,
      isCurrentPlayer: row.user_id === userId,
    }));

  return jsonResponse({ entries });
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return errorResponse('Method not allowed.', 405);
  }

  try {
    const auth = await requireAuthedUser(request);
    if (auth instanceof Response) {
      return auth;
    }

    const body = (await parseJsonBody(request)) ?? {};
    const action = body.action;

    if (!isAction(action)) {
      return errorResponse('Invalid action.', 400);
    }

    switch (action) {
      case 'get_status':
        return await handleGetStatus(auth.admin, auth.userId);

      case 'start_attempt': {
        const attemptType = body.attemptType;
        if (!isAttemptType(attemptType)) {
          return errorResponse('attemptType must be ranked or practice.', 400);
        }
        return await handleStartAttempt(auth.admin, auth.userId, attemptType);
      }

      case 'record_first_move': {
        const attemptId = body.attemptId;
        if (typeof attemptId !== 'string' || attemptId.length < 8) {
          return errorResponse('attemptId is required.', 400);
        }
        return await handleRecordFirstMove(auth.admin, auth.userId, attemptId);
      }

      case 'complete_attempt': {
        const attemptId = body.attemptId;
        if (typeof attemptId !== 'string' || attemptId.length < 8) {
          return errorResponse('attemptId is required.', 400);
        }
        const moveValidation = validateMoveLog(body.moves);
        if (!moveValidation.ok) {
          return jsonResponse(
            { verified: false, rejectionReason: moveValidation.reason },
            400,
          );
        }
        return await handleCompleteAttempt(
          auth.admin,
          auth.userId,
          attemptId,
          moveValidation.moves,
        );
      }

      case 'abandon_attempt': {
        const attemptId = body.attemptId;
        if (typeof attemptId !== 'string' || attemptId.length < 8) {
          return errorResponse('attemptId is required.', 400);
        }
        return await handleAbandonAttempt(auth.admin, auth.userId, attemptId);
      }

      case 'get_leaderboard': {
        const challengeDate =
          typeof body.challengeDate === 'string' ? body.challengeDate : undefined;
        return await handleGetLeaderboard(auth.admin, auth.userId, challengeDate);
      }

      case 'get_daily_leaderboard': {
        const challengeDate =
          typeof body.challengeDate === 'string' ? body.challengeDate : undefined;
        const afterRank =
          typeof body.afterRank === 'number' ? body.afterRank : 0;
        const limit = typeof body.limit === 'number' ? body.limit : 100;
        return await handleGetDailyLeaderboard(
          auth.admin,
          auth.userId,
          challengeDate,
          afterRank,
          limit,
        );
      }

      case 'get_weekly_leaderboard': {
        const weekStart =
          typeof body.weekStart === 'string' ? body.weekStart : undefined;
        const afterRank =
          typeof body.afterRank === 'number' ? body.afterRank : 0;
        const limit = typeof body.limit === 'number' ? body.limit : 100;
        return await handleGetWeeklyLeaderboard(
          auth.admin,
          auth.userId,
          weekStart,
          afterRank,
          limit,
        );
      }

      case 'get_nearby_daily_ranks': {
        const challengeDate =
          typeof body.challengeDate === 'string' ? body.challengeDate : undefined;
        const window = typeof body.window === 'number' ? body.window : 2;
        return await handleGetNearbyDailyRanks(
          auth.admin,
          auth.userId,
          challengeDate,
          window,
        );
      }

      case 'get_nearby_weekly_ranks': {
        const weekStart =
          typeof body.weekStart === 'string' ? body.weekStart : undefined;
        const window = typeof body.window === 'number' ? body.window : 2;
        return await handleGetNearbyWeeklyRanks(
          auth.admin,
          auth.userId,
          weekStart,
          window,
        );
      }

      case 'get_reward_status': {
        const challengeDate =
          typeof body.challengeDate === 'string' ? body.challengeDate : undefined;
        const { data, error } = await auth.admin.rpc('get_challenge_reward_status', {
          p_challenge_date: challengeDate ?? null,
          p_user_id: auth.userId,
        });
        if (error) {
          return errorResponse('Unable to load reward status.', 500);
        }
        return jsonResponse(data);
      }

      case 'claim_weekly_reward': {
        const weekStart =
          typeof body.weekStart === 'string' ? body.weekStart : undefined;
        const { data, error } = await auth.admin.rpc('claim_weekly_challenge_reward', {
          p_week_start: weekStart ?? null,
          p_user_id: auth.userId,
        });
        if (error) {
          return errorResponse(error.message ?? 'Unable to claim weekly reward.', 400);
        }
        return jsonResponse(data);
      }

      default:
        return errorResponse('Unsupported action.', 400);
    }
  } catch {
    return errorResponse('Unexpected server error.', 500);
  }
});
