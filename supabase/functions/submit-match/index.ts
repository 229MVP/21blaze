import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

import { corsHeaders, errorResponse, jsonResponse } from '../_shared/cors.ts';
import { GAME_DURATION_SECONDS } from '../_shared/game/constants.ts';
import { replayMatch, validateMoveLog } from '../_shared/game/replayMatch.ts';
import type { MoveLogEntry, OfficialMatchResult } from '../_shared/game/types.ts';
import {
  applyMissionProgressFromMatch,
  buildMatchSummaryFromReplay,
  buildMatchSummaryFromVerifiedFields,
  grantMatchXp,
  tryBuildMatchSummaryFromMoveLog,
  type MissionProgressResult,
  type XpGrantResult,
} from '../_shared/progression.ts';
import { createServiceClient } from '../_shared/supabaseAdmin.ts';

type ProgressionPayload = {
  xp: XpGrantResult | null;
  missions: MissionProgressResult | null;
};

async function applySoloProgression(input: {
  admin: ReturnType<typeof createServiceClient>;
  userId: string;
  matchId: string;
  gameOverReason: string;
  seed?: number;
  moves?: MoveLogEntry[];
  moveLog?: unknown;
  lanesCleared?: number;
}): Promise<ProgressionPayload | undefined> {
  if (input.gameOverReason === 'quit') {
    return undefined;
  }

  let xp: XpGrantResult | null = null;
  let missions: MissionProgressResult | null = null;

  try {
    xp = await grantMatchXp(input.admin, input.userId, 'solo', input.matchId);
  } catch {
    xp = null;
  }

  try {
    let summary;
    if (typeof input.seed === 'number' && input.moves) {
      summary = buildMatchSummaryFromReplay(input.seed, input.moves, {
        matchMode: 'solo',
        matchCompleted: true,
        validCompletion: true,
      });
    } else if (typeof input.seed === 'number' && input.moveLog !== undefined) {
      summary = tryBuildMatchSummaryFromMoveLog(input.seed, input.moveLog, {
        matchMode: 'solo',
        matchCompleted: true,
        validCompletion: true,
        lanesClearedFallback: input.lanesCleared ?? 0,
      });
    } else {
      summary = buildMatchSummaryFromVerifiedFields({
        lanesCleared: input.lanesCleared ?? 0,
        matchMode: 'solo',
        matchCompleted: true,
        validCompletion: true,
      });
    }

    missions = await applyMissionProgressFromMatch(
      input.admin,
      input.userId,
      input.matchId,
      summary,
    );
  } catch {
    missions = null;
  }

  return { xp, missions };
}

function officialFromExisting(row: {
  score: number;
  lanes_cleared: number;
  cards_played: number;
  busts: number;
  time_remaining_seconds: number;
  game_over_reason: string;
}): OfficialMatchResult {
  return {
    score: row.score,
    lanesCleared: row.lanes_cleared,
    cardsPlayed: row.cards_played,
    busts: row.busts,
    timeRemainingSeconds: row.time_remaining_seconds,
    gameOverReason: row.game_over_reason as OfficialMatchResult['gameOverReason'],
  };
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return errorResponse('Method not allowed.', 405);
  }

  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return errorResponse('Authentication required.', 401);
    }

    const admin = createServiceClient();
    const jwt = authHeader.replace(/^Bearer\s+/i, '');
    const {
      data: { user },
      error: userError,
    } = await admin.auth.getUser(jwt);

    if (userError || !user) {
      return errorResponse('Invalid session.', 401);
    }

    let body: { matchId?: unknown; moves?: unknown };
    try {
      body = await request.json();
    } catch {
      return errorResponse('Invalid JSON body.', 400);
    }

    const matchId = body.matchId;
    if (typeof matchId !== 'string' || matchId.length < 8) {
      return errorResponse('matchId is required.', 400);
    }

    const moveValidation = validateMoveLog(body.moves);
    if (!moveValidation.ok) {
      return jsonResponse(
        { verified: false, rejectionReason: moveValidation.reason },
        400,
      );
    }

    const { data: match, error: matchError } = await admin
      .from('online_matches')
      .select('id, user_id, seed, status, started_at, expires_at, completed_at')
      .eq('id', matchId)
      .maybeSingle();

    if (matchError || !match) {
      return errorResponse('Match not found.', 404);
    }

    if (match.user_id !== user.id) {
      return errorResponse('Match ownership mismatch.', 403);
    }

    // Idempotent: already completed with a score.
    const { data: existingScore } = await admin
      .from('verified_scores')
      .select(
        'id, score, lanes_cleared, cards_played, busts, time_remaining_seconds, game_over_reason, move_log',
      )
      .eq('match_id', matchId)
      .maybeSingle();

    if (existingScore) {
      const progression = await applySoloProgression({
        admin,
        userId: user.id,
        matchId,
        gameOverReason: String(existingScore.game_over_reason),
        seed: typeof match.seed === 'number' ? match.seed : undefined,
        moveLog: existingScore.move_log,
        lanesCleared: existingScore.lanes_cleared,
      });

      return jsonResponse({
        verified: true,
        scoreId: existingScore.id,
        officialResult: officialFromExisting(existingScore),
        ...(progression ? { progression } : {}),
      });
    }

    if (match.status !== 'active') {
      return jsonResponse(
        {
          verified: false,
          rejectionReason: `Match is ${match.status} and cannot be submitted.`,
        },
        409,
      );
    }

    const now = Date.now();
    const expiresAtMs = Date.parse(match.expires_at);
    if (Number.isFinite(expiresAtMs) && now > expiresAtMs) {
      await admin
        .from('online_matches')
        .update({ status: 'abandoned', completed_at: new Date().toISOString() })
        .eq('id', matchId)
        .eq('status', 'active');

      return jsonResponse(
        { verified: false, rejectionReason: 'Match has expired.' },
        409,
      );
    }

    const replay = replayMatch(match.seed, moveValidation.moves);
    if (!replay.ok) {
      await admin
        .from('online_matches')
        .update({ status: 'rejected', completed_at: new Date().toISOString() })
        .eq('id', matchId)
        .eq('status', 'active');

      return jsonResponse(
        { verified: false, rejectionReason: replay.reason },
        400,
      );
    }

    if (replay.result.gameOverReason === 'timeExpired') {
      const startedAtMs = Date.parse(match.started_at);
      const minElapsed = GAME_DURATION_SECONDS * 1000 - 2_000;
      if (Number.isFinite(startedAtMs) && now - startedAtMs < minElapsed) {
        return jsonResponse(
          {
            verified: false,
            rejectionReason: 'Time-expired submission is too early.',
          },
          400,
        );
      }
    }

    const completedAt = new Date().toISOString();
    const { data: scoreRow, error: scoreError } = await admin
      .from('verified_scores')
      .insert({
        match_id: matchId,
        user_id: user.id,
        score: replay.result.score,
        lanes_cleared: replay.result.lanesCleared,
        cards_played: replay.result.cardsPlayed,
        busts: replay.result.busts,
        time_remaining_seconds: replay.result.timeRemainingSeconds,
        game_over_reason: replay.result.gameOverReason,
        move_log: moveValidation.moves,
      })
      .select('id')
      .single();

    if (scoreError) {
      // Unique violation ⇒ another request won the race; return existing.
      if (scoreError.code === '23505') {
        const { data: raced } = await admin
          .from('verified_scores')
          .select(
            'id, score, lanes_cleared, cards_played, busts, time_remaining_seconds, game_over_reason',
          )
          .eq('match_id', matchId)
          .maybeSingle();

        if (raced) {
          const progression = await applySoloProgression({
            admin,
            userId: user.id,
            matchId,
            gameOverReason: String(raced.game_over_reason),
            seed: match.seed,
            moves: moveValidation.moves,
            lanesCleared: raced.lanes_cleared,
          });

          return jsonResponse({
            verified: true,
            scoreId: raced.id,
            officialResult: officialFromExisting(raced),
            ...(progression ? { progression } : {}),
          });
        }
      }

      return errorResponse('Unable to store verified score.', 500);
    }

    await admin
      .from('online_matches')
      .update({ status: 'completed', completed_at: completedAt })
      .eq('id', matchId)
      .eq('status', 'active');

    const progression = await applySoloProgression({
      admin,
      userId: user.id,
      matchId,
      gameOverReason: replay.result.gameOverReason,
      seed: match.seed,
      moves: moveValidation.moves,
      lanesCleared: replay.result.lanesCleared,
    });

    return jsonResponse({
      verified: true,
      scoreId: scoreRow.id,
      officialResult: replay.result,
      ...(progression ? { progression } : {}),
    });
  } catch {
    return errorResponse('Unexpected server error.', 500);
  }
});
