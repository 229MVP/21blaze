import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

import { parseJsonBody, requireAuthedUser } from '../_shared/auth.ts';
import { corsHeaders, errorResponse, jsonResponse } from '../_shared/cors.ts';
import { replayMatch, validateMoveLog } from '../_shared/game/replayMatch.ts';
import {
  broadcastLiveEvent,
  buildPublicMatchState,
  finalizeIfBothSubmitted,
  loadMatchWithPlayers,
  touchLastSeen,
} from '../_shared/liveMatch.ts';

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

    const body = await parseJsonBody(request);
    const matchId = typeof body?.matchId === 'string' ? body.matchId : '';
    if (!matchId) {
      return errorResponse('matchId is required.', 400);
    }

    const moveValidation = validateMoveLog(body?.moves);
    if (!moveValidation.ok) {
      return jsonResponse(
        { verified: false, rejectionReason: moveValidation.reason },
        400,
      );
    }

    const { admin, userId } = auth;
    const loaded = await loadMatchWithPlayers(admin, matchId);
    if (!loaded) {
      return errorResponse('Match not found.', 404);
    }

    const self = loaded.players.find((player) => player.user_id === userId);
    if (!self) {
      return errorResponse('Not a match participant.', 403);
    }

    if (
      self.result === 'forfeit_loss' ||
      loaded.match.status === 'forfeited' ||
      loaded.match.status === 'cancelled' ||
      loaded.match.status === 'expired'
    ) {
      return jsonResponse(
        { verified: false, rejectionReason: 'Cannot submit after forfeit or cancel.' },
        409,
      );
    }

    // Idempotent resubmit
    if (self.submitted_at && self.verified_score !== null) {
      await finalizeIfBothSubmitted(admin, matchId);
      const state = await buildPublicMatchState(admin, matchId, userId);
      return jsonResponse({
        verified: true,
        officialResult: {
          score: self.verified_score,
          lanesCleared: self.verified_lanes_cleared,
          cardsPlayed: self.verified_cards_played,
          busts: self.verified_busts,
          timeRemainingSeconds: self.verified_time_remaining_seconds,
        },
        state,
      });
    }

    if (
      loaded.match.status !== 'countdown' &&
      loaded.match.status !== 'running' &&
      loaded.match.status !== 'awaiting_results'
    ) {
      return jsonResponse(
        { verified: false, rejectionReason: 'Match is not accepting results.' },
        409,
      );
    }

    let replay = replayMatch(loaded.match.seed, moveValidation.moves);
    const serverTimeExpired =
      Boolean(loaded.match.ends_at) &&
      Date.now() >= Date.parse(loaded.match.ends_at ?? '');

    // Non-terminal boards after ends_at are finalized as timeExpired using the
    // stored seed. Client scores are never accepted.
    if (!replay.ok && serverTimeExpired) {
      const movesForExpiry =
        moveValidation.moves.length === 0
          ? [{ sequence: 1, laneId: 1 as const, elapsedMilliseconds: 120_000 }]
          : moveValidation.moves.map((move, index, all) =>
            index === all.length - 1
              ? {
                ...move,
                elapsedMilliseconds: Math.max(move.elapsedMilliseconds, 120_000),
              }
              : move
          );
      replay = replayMatch(loaded.match.seed, movesForExpiry);
    }

    if (!replay.ok) {
      return jsonResponse(
        { verified: false, rejectionReason: replay.reason },
        400,
      );
    }

    const nowIso = new Date().toISOString();
    const { error: updateError } = await admin
      .from('live_match_players')
      .update({
        submitted_at: nowIso,
        last_seen_at: nowIso,
        verified_score: replay.result.score,
        verified_lanes_cleared: replay.result.lanesCleared,
        verified_cards_played: replay.result.cardsPlayed,
        verified_busts: replay.result.busts,
        verified_time_remaining_seconds: replay.result.timeRemainingSeconds,
        verified_move_log: moveValidation.moves,
      })
      .eq('match_id', matchId)
      .eq('user_id', userId)
      .is('submitted_at', null);

    if (updateError) {
      return errorResponse('Unable to store verified result.', 500);
    }

    await touchLastSeen(admin, matchId, userId);

    await admin
      .from('live_matches')
      .update({ status: 'awaiting_results' })
      .eq('id', matchId)
      .in('status', ['countdown', 'running']);

    await broadcastLiveEvent(matchId, 'player_finished', { userId });
    await broadcastLiveEvent(matchId, 'opponent_finished', { userId });

    await finalizeIfBothSubmitted(admin, matchId);

    const state = await buildPublicMatchState(admin, matchId, userId);
    return jsonResponse({
      verified: true,
      officialResult: replay.result,
      state,
    });
  } catch {
    return errorResponse('Unexpected server error.', 500);
  }
});
