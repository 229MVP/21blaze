import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

import { parseJsonBody, requireAuthedUser } from '../_shared/auth.ts';
import { corsHeaders, errorResponse, jsonResponse } from '../_shared/cors.ts';
import {
  attemptExpiresAt,
  computeRankForAttempt,
  ensureDailyChallenge,
  getUtcChallengeDate,
  mapChallengeConfig,
  updateChallengeStreak,
} from '../_shared/dailyChallenge.ts';
import { replayMatch, validateMoveLog } from '../_shared/game/replayMatch.ts';
import type { MoveLogEntry } from '../_shared/game/types.ts';

type DailyChallengeAction =
  | 'get_status'
  | 'start_attempt'
  | 'record_first_move'
  | 'complete_attempt'
  | 'abandon_attempt'
  | 'get_leaderboard';

function isAction(value: unknown): value is DailyChallengeAction {
  return (
    value === 'get_status' ||
    value === 'start_attempt' ||
    value === 'record_first_move' ||
    value === 'complete_attempt' ||
    value === 'abandon_attempt' ||
    value === 'get_leaderboard'
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
  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const challengeDate = getUtcChallengeDate(nowMs);
  const challenge = await ensureDailyChallenge(admin, challengeDate);

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
    .select('*, daily_challenges!inner(challenge_date, seed, scoring_version, duration_seconds)')
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
      attempt.verified_score ?? 0,
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
  };

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
          raced.verified_score ?? 0,
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
            percentile: rankInfo.percentile,
            totalPlayers: rankInfo.totalPlayers,
          },
        });
      }
    }
    return errorResponse('Unable to store verified result.', 500);
  }

  const streak = await updateChallengeStreak(
    admin,
    userId,
    challenge.challenge_date,
  );

  const rankInfo = await computeRankForAttempt(
    admin,
    updated.challenge_id,
    attemptId,
    replay.result.score,
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
      percentile: rankInfo.percentile,
      totalPlayers: rankInfo.totalPlayers,
    },
    streak,
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
  const date = challengeDate ?? getUtcChallengeDate(Date.now());
  const challenge = await ensureDailyChallenge(admin, date);

  const { data: rows, error } = await admin
    .from('daily_challenge_leaderboard')
    .select('*')
    .eq('challenge_id', challenge.id)
    .order('rank', { ascending: true })
    .limit(100);

  if (error) {
    return errorResponse('Unable to load leaderboard.', 500);
  }

  const entries = (rows ?? []).map((row: Record<string, unknown>) => ({
    rank: row.rank,
    playerName: row.player_name,
    score: row.score,
    lanesCleared: row.lanes_cleared,
    exact21Count: row.exact_21_count,
    fiveCardClears: row.five_card_clears,
    bustCount: row.bust_count,
    bestMultiplier: row.best_multiplier,
    elapsedTimeMs: row.elapsed_time_ms,
    isCurrentPlayer: row.user_id === userId,
  }));

  return jsonResponse({
    challengeDate: date,
    challengeId: challenge.id,
    entries,
  });
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

      default:
        return errorResponse('Unsupported action.', 400);
    }
  } catch {
    return errorResponse('Unexpected server error.', 500);
  }
});
