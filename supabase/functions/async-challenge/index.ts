import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

import { parseJsonBody, requireAuthedUser } from '../_shared/auth.ts';
import { corsHeaders, errorResponse, jsonResponse } from '../_shared/cors.ts';
import {
  ASYNC_CHALLENGE_MAX_CREATES_PER_UTC_DAY,
  ASYNC_CHALLENGE_MAX_OPEN_OUTGOING,
  ASYNC_CHALLENGE_RULES_VERSION,
  ASYNC_CHALLENGE_SCORING_VERSION,
  ASYNC_INVITE_LOOKUP_MAX_PER_HOUR,
  attemptExpiresAtIso,
  challengeExpiresAtIso,
  compareAsyncVerifiedAttempts,
  finalizeExpiredAsyncChallenges,
  generateAsyncInviteCode,
  getUtcDayKey,
  hashAsyncInviteCode,
  isPastChallengeExpiration,
  isPastCompletionGrace,
  loadPublicProfile,
  mapPublicAttemptStatus,
  normalizeAsyncInviteCode,
  randomAsyncSeed,
  type AsyncChallengeAttemptRow,
  type AsyncChallengeRow,
  type AsyncChallengeResultType,
} from '../_shared/asyncChallenge.ts';
import { GAME_DURATION_SECONDS } from '../_shared/game/constants.ts';
import { replayMatch, validateMoveLog } from '../_shared/game/replayMatch.ts';
import type { MoveLogEntry } from '../_shared/game/types.ts';
import { buildMatchSummaryFromReplay } from '../_shared/progression.ts';

type AsyncChallengeAction =
  | 'list_challenges'
  | 'get_challenge'
  | 'resolve_invite'
  | 'create_challenge'
  | 'accept_challenge'
  | 'start_attempt'
  | 'record_first_move'
  | 'complete_attempt'
  | 'abandon_attempt';

function isAction(value: unknown): value is AsyncChallengeAction {
  return (
    value === 'list_challenges' ||
    value === 'get_challenge' ||
    value === 'resolve_invite' ||
    value === 'create_challenge' ||
    value === 'accept_challenge' ||
    value === 'start_attempt' ||
    value === 'record_first_move' ||
    value === 'complete_attempt' ||
    value === 'abandon_attempt'
  );
}

type AdminClient = ReturnType<
  typeof import('../_shared/supabaseAdmin.ts').createServiceClient
>;

async function checkRateLimit(
  admin: AdminClient,
  actorKey: string,
  actionType: string,
  windowKey: string,
  maxAttempts: number,
): Promise<boolean> {
  const { data, error } = await admin.rpc('check_async_challenge_rate_limit', {
    p_actor_key: actorKey,
    p_action_type: actionType,
    p_window_key: windowKey,
    p_max_attempts: maxAttempts,
  });
  if (error) {
    return false;
  }
  return Boolean(data);
}

async function loadChallengeById(
  admin: AdminClient,
  challengeId: string,
): Promise<AsyncChallengeRow | null> {
  const { data } = await admin
    .from('async_challenges')
    .select('*')
    .eq('id', challengeId)
    .maybeSingle();
  return data as AsyncChallengeRow | null;
}

async function loadChallengeByHash(
  admin: AdminClient,
  inviteHash: string,
): Promise<AsyncChallengeRow | null> {
  const { data } = await admin
    .from('async_challenges')
    .select('*')
    .eq('invite_code_hash', inviteHash)
    .maybeSingle();
  return data as AsyncChallengeRow | null;
}

async function loadAttempts(
  admin: AdminClient,
  challengeId: string,
): Promise<AsyncChallengeAttemptRow[]> {
  const { data } = await admin
    .from('async_challenge_attempts')
    .select('*')
    .eq('challenge_id', challengeId);
  return (data ?? []) as AsyncChallengeAttemptRow[];
}

function findAttemptForUser(
  attempts: AsyncChallengeAttemptRow[],
  userId: string,
): AsyncChallengeAttemptRow | undefined {
  return attempts.find((row) => row.user_id === userId);
}

type SafeVerifiedStats = {
  score: number;
  exact21Count: number;
  fiveCardClears: number;
  bustCount: number;
  bestMultiplier: number;
  elapsedTimeMs: number;
  lanesCleared: number;
  gameOverReason: string | null;
};

function mapVerifiedStats(row: AsyncChallengeAttemptRow): SafeVerifiedStats {
  return {
    score: row.verified_score ?? 0,
    exact21Count: row.verified_exact_21_count ?? 0,
    fiveCardClears: row.verified_five_card_clears ?? 0,
    bustCount: row.verified_bust_count ?? 0,
    bestMultiplier: row.verified_multiplier ?? 1,
    elapsedTimeMs: row.verified_elapsed_time ?? 0,
    lanesCleared: row.verified_clears ?? 0,
    gameOverReason: row.game_over_reason,
  };
}

async function mapSafeChallenge(
  admin: AdminClient,
  challenge: AsyncChallengeRow,
  viewerUserId: string | null,
  attempts: AsyncChallengeAttemptRow[],
  inviteCode?: string,
) {
  const creatorProfile = await loadPublicProfile(admin, challenge.creator_user_id);
  const opponentProfile = challenge.opponent_user_id
    ? await loadPublicProfile(admin, challenge.opponent_user_id)
    : null;

  const creatorAttempt = findAttemptForUser(attempts, challenge.creator_user_id);
  const opponentAttempt = challenge.opponent_user_id
    ? findAttemptForUser(attempts, challenge.opponent_user_id)
    : undefined;

  const viewerAttempt =
    viewerUserId ? findAttemptForUser(attempts, viewerUserId) : undefined;
  const viewerCompleted =
    viewerAttempt?.verification_status === 'verified' &&
    viewerAttempt.status === 'completed';

  const opponentUserId =
    viewerUserId === challenge.creator_user_id
      ? challenge.opponent_user_id
      : challenge.creator_user_id;
  const opponentAttemptRow =
    opponentUserId ? findAttemptForUser(attempts, opponentUserId) : undefined;

  const safeOpponentStats =
    viewerCompleted && opponentAttemptRow?.verification_status === 'verified'
      ? mapVerifiedStats(opponentAttemptRow)
      : null;

  const viewerStats =
    viewerAttempt?.verification_status === 'verified'
      ? mapVerifiedStats(viewerAttempt)
      : null;

  return {
    challengeId: challenge.id,
    status: challenge.status,
    resultType: challenge.result_type,
    winnerUserId: challenge.finalized_at ? challenge.winner_user_id : null,
    rulesVersion: challenge.rules_version,
    scoringVersion: challenge.scoring_version,
    durationSeconds: challenge.duration_seconds,
    createdAt: challenge.created_at,
    acceptedAt: challenge.accepted_at,
    expiresAt: challenge.expires_at,
    completedAt: challenge.completed_at,
    finalizedAt: challenge.finalized_at,
    inviteCode,
    creator: {
      userId: challenge.creator_user_id,
      displayName: creatorProfile.displayName,
      profileFrameId: creatorProfile.profileFrameId,
      playerTitleId: creatorProfile.playerTitleId,
      level: creatorProfile.level,
      attemptStatus: mapPublicAttemptStatus(creatorAttempt),
    },
    opponent: challenge.opponent_user_id
      ? {
          userId: challenge.opponent_user_id,
          displayName: opponentProfile?.displayName ?? 'Opponent',
          profileFrameId: opponentProfile?.profileFrameId ?? 'default_profile_frame',
          playerTitleId: opponentProfile?.playerTitleId ?? null,
          level: opponentProfile?.level ?? null,
          attemptStatus: mapPublicAttemptStatus(opponentAttempt),
        }
      : null,
    yourAttemptStatus: viewerAttempt
      ? mapPublicAttemptStatus(viewerAttempt)
      : viewerUserId
        ? 'WAITING'
        : null,
    yourVerifiedResult: viewerStats,
    opponentVerifiedResult: safeOpponentStats,
    isYourTurn:
      viewerUserId !== null &&
      challenge.status !== 'completed' &&
      challenge.status !== 'expired' &&
      challenge.status !== 'cancelled' &&
      viewerAttempt !== undefined &&
      (viewerAttempt.status === 'created' ||
        viewerAttempt.status === 'started') &&
      (viewerAttempt.first_move_at === null ||
        viewerAttempt.status === 'started'),
  };
}

async function tryFinalizeChallenge(
  admin: AdminClient,
  challenge: AsyncChallengeRow,
  attempts: AsyncChallengeAttemptRow[],
): Promise<AsyncChallengeRow> {
  const creatorAttempt = findAttemptForUser(attempts, challenge.creator_user_id);
  const opponentAttempt = challenge.opponent_user_id
    ? findAttemptForUser(attempts, challenge.opponent_user_id)
    : undefined;

  if (
    !creatorAttempt ||
    !opponentAttempt ||
    creatorAttempt.verification_status !== 'verified' ||
    opponentAttempt.verification_status !== 'verified'
  ) {
    return challenge;
  }

  const comparison = compareAsyncVerifiedAttempts(
    {
      verified_score: creatorAttempt.verified_score ?? 0,
      verified_exact_21_count: creatorAttempt.verified_exact_21_count ?? 0,
      verified_five_card_clears: creatorAttempt.verified_five_card_clears ?? 0,
      verified_bust_count: creatorAttempt.verified_bust_count ?? 0,
      verified_multiplier: creatorAttempt.verified_multiplier ?? 1,
      verified_elapsed_time: creatorAttempt.verified_elapsed_time,
    },
    {
      verified_score: opponentAttempt.verified_score ?? 0,
      verified_exact_21_count: opponentAttempt.verified_exact_21_count ?? 0,
      verified_five_card_clears: opponentAttempt.verified_five_card_clears ?? 0,
      verified_bust_count: opponentAttempt.verified_bust_count ?? 0,
      verified_multiplier: opponentAttempt.verified_multiplier ?? 1,
      verified_elapsed_time: opponentAttempt.verified_elapsed_time,
    },
  );

  let resultType: AsyncChallengeResultType = 'draw';
  let winnerUserId: string | null = null;
  if (comparison > 0) {
    resultType = 'creator_win';
    winnerUserId = challenge.creator_user_id;
  } else if (comparison < 0) {
    resultType = 'opponent_win';
    winnerUserId = challenge.opponent_user_id;
  }

  const nowIso = new Date().toISOString();
  const { data: updated } = await admin
    .from('async_challenges')
    .update({
      status: 'completed',
      result_type: resultType,
      winner_user_id: winnerUserId,
      completed_at: nowIso,
      finalized_at: nowIso,
    })
    .eq('id', challenge.id)
    .eq('status', challenge.status)
    .select('*')
    .maybeSingle();

  return (updated as AsyncChallengeRow | null) ?? challenge;
}

async function handleListChallenges(admin: AdminClient, userId: string) {
  await finalizeExpiredAsyncChallenges(admin);

  const { data: rows } = await admin
    .from('async_challenges')
    .select('*')
    .or(`creator_user_id.eq.${userId},opponent_user_id.eq.${userId}`)
    .order('created_at', { ascending: false })
    .limit(50);

  const challenges = (rows ?? []) as AsyncChallengeRow[];
  const summaries = [];

  for (const challenge of challenges) {
    const attempts = await loadAttempts(admin, challenge.id);
    summaries.push(await mapSafeChallenge(admin, challenge, userId, attempts));
  }

  return jsonResponse({
    serverTime: new Date().toISOString(),
    challenges: summaries,
  });
}

async function handleGetChallenge(
  admin: AdminClient,
  userId: string,
  challengeId: string,
) {
  await finalizeExpiredAsyncChallenges(admin);
  const challenge = await loadChallengeById(admin, challengeId);
  if (!challenge) {
    return errorResponse('Challenge not found.', 404);
  }
  if (
    challenge.creator_user_id !== userId &&
    challenge.opponent_user_id !== userId
  ) {
    return errorResponse('Challenge not found.', 404);
  }
  const attempts = await loadAttempts(admin, challenge.id);
  return jsonResponse({
    serverTime: new Date().toISOString(),
    challenge: await mapSafeChallenge(admin, challenge, userId, attempts),
  });
}

async function handleResolveInvite(
  admin: AdminClient,
  actorKey: string,
  inviteCodeRaw: string,
  viewerUserId: string | null,
) {
  await finalizeExpiredAsyncChallenges(admin);

  const allowed = await checkRateLimit(
    admin,
    actorKey,
    'invite_lookup',
    `hour:${new Date().toISOString().slice(0, 13)}`,
    ASYNC_INVITE_LOOKUP_MAX_PER_HOUR,
  );
  if (!allowed) {
    return errorResponse('Too many invite lookups. Try again later.', 429);
  }

  const normalized = normalizeAsyncInviteCode(inviteCodeRaw);
  if (!/^BLAZE-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/.test(normalized)) {
    return errorResponse('Invalid invite code.', 404);
  }

  const hash = await hashAsyncInviteCode(normalized);
  const challenge = await loadChallengeByHash(admin, hash);
  if (!challenge) {
    return errorResponse('Invalid invite code.', 404);
  }

  if (isPastChallengeExpiration(challenge.expires_at)) {
    return errorResponse('This challenge has expired.', 409);
  }

  if (viewerUserId && viewerUserId === challenge.creator_user_id) {
    return errorResponse('You cannot accept your own challenge.', 409);
  }

  const creatorProfile = await loadPublicProfile(admin, challenge.creator_user_id);
  const attempts = await loadAttempts(admin, challenge.id);

  return jsonResponse({
    serverTime: new Date().toISOString(),
    inviteCode: normalized,
    preview: {
      challengeId: challenge.id,
      status: challenge.status,
      expiresAt: challenge.expires_at,
      durationSeconds: challenge.duration_seconds,
      rulesVersion: challenge.rules_version,
      scoringVersion: challenge.scoring_version,
      creator: {
        displayName: creatorProfile.displayName,
        profileFrameId: creatorProfile.profileFrameId,
        playerTitleId: creatorProfile.playerTitleId,
        level: creatorProfile.level,
      },
      hasOpponent: challenge.opponent_user_id !== null,
      canAccept:
        challenge.status === 'open' &&
        challenge.opponent_user_id === null &&
        !isPastChallengeExpiration(challenge.expires_at),
    },
    challenge: viewerUserId
      ? await mapSafeChallenge(admin, challenge, viewerUserId, attempts)
      : null,
  });
}

async function handleCreateChallenge(admin: AdminClient, userId: string) {
  await finalizeExpiredAsyncChallenges(admin);
  const nowMs = Date.now();
  const utcKey = getUtcDayKey(nowMs);

  const createAllowed = await checkRateLimit(
    admin,
    userId,
    'create_challenge',
    `utc:${utcKey}`,
    ASYNC_CHALLENGE_MAX_CREATES_PER_UTC_DAY,
  );
  if (!createAllowed) {
    return errorResponse('Daily challenge creation limit reached.', 429);
  }

  const { count: openCount } = await admin
    .from('async_challenges')
    .select('id', { count: 'exact', head: true })
    .eq('creator_user_id', userId)
    .in('status', ['open', 'accepted', 'in_progress', 'awaiting_opponent']);

  if ((openCount ?? 0) >= ASYNC_CHALLENGE_MAX_OPEN_OUTGOING) {
    return errorResponse('Maximum open outgoing challenges reached.', 429);
  }

  let inviteCode = '';
  let inviteHash = '';
  let inserted: AsyncChallengeRow | null = null;

  for (let attempt = 0; attempt < 8; attempt += 1) {
    inviteCode = generateAsyncInviteCode();
    inviteHash = await hashAsyncInviteCode(inviteCode);
    const seed = randomAsyncSeed();
    const expiresAt = challengeExpiresAtIso(nowMs);

    const { data, error } = await admin
      .from('async_challenges')
      .insert({
        invite_code_hash: inviteHash,
        creator_user_id: userId,
        status: 'open',
        seed,
        rules_version: ASYNC_CHALLENGE_RULES_VERSION,
        scoring_version: ASYNC_CHALLENGE_SCORING_VERSION,
        duration_seconds: GAME_DURATION_SECONDS,
        expires_at: expiresAt,
      })
      .select('*')
      .single();

    if (!error && data) {
      inserted = data as AsyncChallengeRow;
      break;
    }
    if (error?.code !== '23505') {
      return errorResponse('Unable to create challenge.', 500);
    }
  }

  if (!inserted) {
    return errorResponse('Unable to allocate invite code.', 500);
  }

  return jsonResponse({
    serverTime: new Date(nowMs).toISOString(),
    inviteCode,
    challenge: await mapSafeChallenge(admin, inserted, userId, [], inviteCode),
  });
}

async function handleAcceptChallenge(
  admin: AdminClient,
  userId: string,
  inviteCodeRaw: string,
) {
  await finalizeExpiredAsyncChallenges(admin);

  const normalized = normalizeAsyncInviteCode(inviteCodeRaw);
  const hash = await hashAsyncInviteCode(normalized);
  const challenge = await loadChallengeByHash(admin, hash);

  if (!challenge) {
    return errorResponse('Invalid invite code.', 404);
  }

  if (challenge.creator_user_id === userId) {
    return errorResponse('You cannot accept your own challenge.', 409);
  }

  if (isPastChallengeExpiration(challenge.expires_at)) {
    return errorResponse('This challenge has expired.', 409);
  }

  if (challenge.opponent_user_id === userId) {
    const attempts = await loadAttempts(admin, challenge.id);
    return jsonResponse({
      serverTime: new Date().toISOString(),
      challenge: await mapSafeChallenge(
        admin,
        challenge,
        userId,
        attempts,
        normalized,
      ),
    });
  }

  if (challenge.opponent_user_id !== null || challenge.status !== 'open') {
    return errorResponse('This challenge is no longer available.', 409);
  }

  const nowIso = new Date().toISOString();
  const { data: updated, error } = await admin
    .from('async_challenges')
    .update({
      opponent_user_id: userId,
      status: 'accepted',
      accepted_at: nowIso,
    })
    .eq('id', challenge.id)
    .eq('status', 'open')
    .is('opponent_user_id', null)
    .select('*')
    .maybeSingle();

  if (error || !updated) {
    const raced = await loadChallengeByHash(admin, hash);
    if (raced?.opponent_user_id === userId) {
      const attempts = await loadAttempts(admin, raced.id);
      return jsonResponse({
        serverTime: nowIso,
        challenge: await mapSafeChallenge(admin, raced, userId, attempts, normalized),
      });
    }
    return errorResponse('This challenge is no longer available.', 409);
  }

  const attempts = await loadAttempts(admin, updated.id);
  return jsonResponse({
    serverTime: nowIso,
    challenge: await mapSafeChallenge(
      admin,
      updated as AsyncChallengeRow,
      userId,
      attempts,
      normalized,
    ),
  });
}

async function handleStartAttempt(
  admin: AdminClient,
  userId: string,
  challengeId: string,
) {
  await finalizeExpiredAsyncChallenges(admin);
  const challenge = await loadChallengeById(admin, challengeId);
  if (!challenge) {
    return errorResponse('Challenge not found.', 404);
  }

  if (
    challenge.creator_user_id !== userId &&
    challenge.opponent_user_id !== userId
  ) {
    return errorResponse('Challenge not found.', 404);
  }

  if (
    challenge.status === 'expired' ||
    challenge.status === 'cancelled' ||
    challenge.status === 'completed'
  ) {
    return errorResponse('Challenge is no longer active.', 409);
  }

  if (isPastChallengeExpiration(challenge.expires_at)) {
    return errorResponse('Challenge has expired.', 409);
  }

  if (challenge.opponent_user_id === null) {
    return errorResponse('Challenge is waiting for an opponent.', 409);
  }

  const attempts = await loadAttempts(admin, challenge.id);
  const existing = findAttemptForUser(attempts, userId);
  const nowIso = new Date().toISOString();

  if (existing) {
    if (existing.status === 'completed') {
      return errorResponse('Attempt already completed.', 409);
    }
    if (
      existing.status === 'abandoned' ||
      existing.status === 'rejected' ||
      existing.status === 'expired'
    ) {
      return errorResponse('Attempt is no longer available.', 409);
    }

    if (existing.status === 'created' || existing.status === 'started') {
      const expiresAt = existing.started_at
        ? attemptExpiresAtIso(existing.started_at, challenge.duration_seconds)
        : attemptExpiresAtIso(nowIso, challenge.duration_seconds);

      return jsonResponse({
        serverTime: nowIso,
        attemptId: existing.id,
        expiresAt,
        config: {
          challengeId: challenge.id,
          seed: challenge.seed,
          rulesVersion: challenge.rules_version,
          scoringVersion: challenge.scoring_version,
          durationSeconds: challenge.duration_seconds,
        },
      });
    }
  }

  const { data: inserted, error } = await admin
    .from('async_challenge_attempts')
    .insert({
      challenge_id: challenge.id,
      user_id: userId,
      status: 'created',
      started_at: nowIso,
      rules_version: challenge.rules_version,
      scoring_version: challenge.scoring_version,
      verification_status: 'pending',
    })
    .select('*')
    .single();

  if (error) {
    if (error.code === '23505') {
      const raced = findAttemptForUser(await loadAttempts(admin, challenge.id), userId);
      if (raced) {
        return jsonResponse({
          serverTime: nowIso,
          attemptId: raced.id,
          expiresAt: raced.started_at
            ? attemptExpiresAtIso(raced.started_at, challenge.duration_seconds)
            : attemptExpiresAtIso(nowIso, challenge.duration_seconds),
          config: {
            challengeId: challenge.id,
            seed: challenge.seed,
            rulesVersion: challenge.rules_version,
            scoringVersion: challenge.scoring_version,
            durationSeconds: challenge.duration_seconds,
          },
        });
      }
    }
    return errorResponse('Unable to start attempt.', 500);
  }

  const nextStatus =
    challenge.status === 'accepted' ? 'in_progress' : challenge.status;
  if (nextStatus !== challenge.status) {
    await admin
      .from('async_challenges')
      .update({ status: 'in_progress' })
      .eq('id', challenge.id);
  }

  return jsonResponse({
    serverTime: nowIso,
    attemptId: inserted.id,
    expiresAt: attemptExpiresAtIso(nowIso, challenge.duration_seconds),
    config: {
      challengeId: challenge.id,
      seed: challenge.seed,
      rulesVersion: challenge.rules_version,
      scoringVersion: challenge.scoring_version,
      durationSeconds: challenge.duration_seconds,
    },
  });
}

async function handleRecordFirstMove(
  admin: AdminClient,
  userId: string,
  attemptId: string,
) {
  const { data: attempt, error } = await admin
    .from('async_challenge_attempts')
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
    return jsonResponse({ attemptId, status: attempt.status });
  }

  if (
    attempt.status === 'abandoned' ||
    attempt.status === 'rejected' ||
    attempt.status === 'expired'
  ) {
    return errorResponse('Attempt is no longer active.', 409);
  }

  if (attempt.first_move_at) {
    return jsonResponse({ attemptId, status: attempt.status });
  }

  const nowIso = new Date().toISOString();
  const { data: updated } = await admin
    .from('async_challenge_attempts')
    .update({
      status: 'started',
      first_move_at: nowIso,
      updated_at: nowIso,
    })
    .eq('id', attemptId)
    .in('status', ['created', 'started'])
    .select('id, status')
    .maybeSingle();

  return jsonResponse({
    attemptId: updated?.id ?? attemptId,
    status: updated?.status ?? 'started',
  });
}

async function handleAbandonAttempt(
  admin: AdminClient,
  userId: string,
  attemptId: string,
) {
  const { data: attempt, error } = await admin
    .from('async_challenge_attempts')
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
    return jsonResponse({ attemptId, status: attempt.status });
  }

  const nowIso = new Date().toISOString();
  await admin
    .from('async_challenge_attempts')
    .update({
      status: 'abandoned',
      updated_at: nowIso,
      completed_at: nowIso,
    })
    .eq('id', attemptId)
    .in('status', ['created', 'started']);

  const challenge = await loadChallengeById(admin, attempt.challenge_id);
  if (challenge) {
    const attempts = await loadAttempts(admin, challenge.id);
    const creatorDone = attempts.some(
      (row) =>
        row.user_id === challenge.creator_user_id &&
        (row.status === 'completed' || row.status === 'abandoned'),
    );
    const opponentDone = attempts.some(
      (row) =>
        row.user_id === challenge.opponent_user_id &&
        (row.status === 'completed' || row.status === 'abandoned'),
    );
    if (creatorDone && opponentDone) {
      await tryFinalizeChallenge(admin, challenge, attempts);
    } else if (creatorDone || opponentDone) {
      await admin
        .from('async_challenges')
        .update({ status: 'awaiting_opponent' })
        .eq('id', challenge.id)
        .in('status', ['in_progress', 'accepted']);
    }
  }

  return jsonResponse({ attemptId, status: 'abandoned' });
}

async function handleCompleteAttempt(
  admin: AdminClient,
  userId: string,
  attemptId: string,
  moves: MoveLogEntry[],
) {
  const { data: attempt, error } = await admin
    .from('async_challenge_attempts')
    .select('*, async_challenges!inner(*)')
    .eq('id', attemptId)
    .maybeSingle();

  if (error || !attempt) {
    return errorResponse('Attempt not found.', 404);
  }

  if (attempt.user_id !== userId) {
    return errorResponse('Attempt ownership mismatch.', 403);
  }

  const challenge = attempt.async_challenges as AsyncChallengeRow;

  if (
    attempt.status === 'completed' &&
    attempt.verification_status === 'verified'
  ) {
    const attempts = await loadAttempts(admin, challenge.id);
    const finalized = await tryFinalizeChallenge(admin, challenge, attempts);
    return jsonResponse({
      verified: true,
      challenge: await mapSafeChallenge(
        admin,
        finalized,
        userId,
        await loadAttempts(admin, finalized.id),
      ),
      result: mapVerifiedStats(attempt as AsyncChallengeAttemptRow),
    });
  }

  if (
    attempt.status === 'abandoned' ||
    attempt.status === 'rejected' ||
    attempt.status === 'expired'
  ) {
    return jsonResponse(
      { verified: false, rejectionReason: `Attempt is ${attempt.status}.` },
      409,
    );
  }

  if (isPastCompletionGrace(challenge.expires_at)) {
    return jsonResponse(
      { verified: false, rejectionReason: 'Challenge grace period has ended.' },
      409,
    );
  }

  const moveValidation = validateMoveLog(moves);
  if (!moveValidation.ok) {
    await admin
      .from('async_challenge_attempts')
      .update({
        status: 'rejected',
        verification_status: 'rejected',
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
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
      .from('async_challenge_attempts')
      .update({
        status: 'rejected',
        verification_status: 'rejected',
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
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

  const progressionSummary = buildMatchSummaryFromReplay(
    challenge.seed,
    moveValidation.moves,
    {
      matchMode: 'solo',
      matchCompleted: true,
      validCompletion: true,
      busts: replay.result.busts,
    },
  );

  const { data: updatedAttempt, error: updateError } = await admin
    .from('async_challenge_attempts')
    .update({
      status: 'completed',
      verification_status: 'verified',
      completed_at: completedAt,
      updated_at: completedAt,
      verified_score: replay.result.score,
      verified_clears: replay.result.lanesCleared,
      verified_exact_21_count: progressionSummary.exactTwentyOneClears,
      verified_five_card_clears: progressionSummary.fiveCardClears,
      verified_bust_count: replay.result.busts,
      verified_multiplier: progressionSummary.maximumMultiplierReached,
      verified_elapsed_time: elapsedTimeMs,
      move_log: moveValidation.moves,
      game_over_reason: replay.result.gameOverReason,
    })
    .eq('id', attemptId)
    .in('status', ['created', 'started'])
    .select('*')
    .maybeSingle();

  if (updateError || !updatedAttempt) {
    const { data: raced } = await admin
      .from('async_challenge_attempts')
      .select('*')
      .eq('id', attemptId)
      .maybeSingle();
    if (raced?.verification_status === 'verified') {
      const attempts = await loadAttempts(admin, challenge.id);
      const finalized = await tryFinalizeChallenge(admin, challenge, attempts);
      return jsonResponse({
        verified: true,
        challenge: await mapSafeChallenge(
          admin,
          finalized,
          userId,
          await loadAttempts(admin, finalized.id),
        ),
        result: mapVerifiedStats(raced as AsyncChallengeAttemptRow),
      });
    }
    return errorResponse('Unable to complete attempt.', 500);
  }

  await admin
    .from('async_challenges')
    .update({ status: 'awaiting_opponent' })
    .eq('id', challenge.id)
    .in('status', ['in_progress', 'accepted']);

  const attempts = await loadAttempts(admin, challenge.id);
  const allVerified = attempts.every(
    (row) =>
      row.status === 'completed' && row.verification_status === 'verified',
  );

  let finalizedChallenge = challenge;
  if (allVerified && attempts.length >= 2) {
    await admin
      .from('async_challenges')
      .update({ status: 'verifying' })
      .eq('id', challenge.id);
    finalizedChallenge = await tryFinalizeChallenge(admin, challenge, attempts);
  }

  const refreshedAttempts = await loadAttempts(admin, challenge.id);
  const viewerCompleted = refreshedAttempts.some(
    (row) => row.user_id === userId && row.verification_status === 'verified',
  );

  return jsonResponse({
    verified: true,
    challenge: await mapSafeChallenge(
      admin,
      finalizedChallenge,
      userId,
      refreshedAttempts,
    ),
    result: mapVerifiedStats(updatedAttempt as AsyncChallengeAttemptRow),
    waitingForOpponent: !allVerified,
    opponentResultVisible: viewerCompleted && allVerified,
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
    const body = await parseJsonBody(request);
    if (!body || !isAction(body.action)) {
      return errorResponse('Invalid action.', 400);
    }

    const auth = await requireAuthedUser(request);
    const actorKey =
      auth instanceof Response
        ? `anon:${request.headers.get('x-forwarded-for') ?? 'unknown'}`
        : auth.userId;

    if (body.action === 'resolve_invite') {
      const inviteCode = typeof body.inviteCode === 'string' ? body.inviteCode : '';
      if (!inviteCode.trim()) {
        return errorResponse('Invite code required.', 400);
      }
      const admin =
        auth instanceof Response
          ? (await import('../_shared/supabaseAdmin.ts')).createServiceClient()
          : auth.admin;
      const viewerId = auth instanceof Response ? null : auth.userId;
      return await handleResolveInvite(admin, actorKey, inviteCode, viewerId);
    }

    if (auth instanceof Response) {
      return auth;
    }

    const { admin, userId } = auth;
    await finalizeExpiredAsyncChallenges(admin);

    switch (body.action) {
      case 'list_challenges':
        return await handleListChallenges(admin, userId);
      case 'get_challenge':
        const challengeId =
          typeof body.challengeId === 'string' ? body.challengeId : '';
        if (!challengeId) {
          return errorResponse('challengeId required.', 400);
        }
        return await handleGetChallenge(admin, userId, challengeId);
      case 'create_challenge':
        return await handleCreateChallenge(admin, userId);
      case 'accept_challenge':
        const acceptCode =
          typeof body.inviteCode === 'string' ? body.inviteCode : '';
        if (!acceptCode.trim()) {
          return errorResponse('Invite code required.', 400);
        }
        return await handleAcceptChallenge(admin, userId, acceptCode);
      case 'start_attempt':
        const startChallengeId =
          typeof body.challengeId === 'string' ? body.challengeId : '';
        if (!startChallengeId) {
          return errorResponse('challengeId required.', 400);
        }
        return await handleStartAttempt(admin, userId, startChallengeId);
      case 'record_first_move':
        const recordAttemptId =
          typeof body.attemptId === 'string' ? body.attemptId : '';
        if (!recordAttemptId) {
          return errorResponse('attemptId required.', 400);
        }
        return await handleRecordFirstMove(admin, userId, recordAttemptId);
      case 'abandon_attempt':
        const abandonAttemptId =
          typeof body.attemptId === 'string' ? body.attemptId : '';
        if (!abandonAttemptId) {
          return errorResponse('attemptId required.', 400);
        }
        return await handleAbandonAttempt(admin, userId, abandonAttemptId);
      case 'complete_attempt':
        const completeAttemptId =
          typeof body.attemptId === 'string' ? body.attemptId : '';
        if (!completeAttemptId) {
          return errorResponse('attemptId required.', 400);
        }
        const moves = Array.isArray(body.moves)
          ? (body.moves as MoveLogEntry[])
          : [];
        return await handleCompleteAttempt(
          admin,
          userId,
          completeAttemptId,
          moves,
        );
      default:
        return errorResponse('Invalid action.', 400);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Request failed.';
    return errorResponse(message, 500);
  }
});
