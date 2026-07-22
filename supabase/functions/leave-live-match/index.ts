import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

import { parseJsonBody, requireAuthedUser } from '../_shared/auth.ts';
import { corsHeaders, errorResponse, jsonResponse } from '../_shared/cors.ts';
import {
  broadcastLiveEvent,
  buildPublicMatchState,
  loadMatchWithPlayers,
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

    const { admin, userId } = auth;
    const loaded = await loadMatchWithPlayers(admin, matchId);
    if (!loaded) {
      return errorResponse('Match not found.', 404);
    }

    const self = loaded.players.find((player) => player.user_id === userId);
    if (!self) {
      return errorResponse('Not a match participant.', 403);
    }

    const nowIso = new Date().toISOString();

    if (
      loaded.match.status === 'waiting' ||
      loaded.match.status === 'ready'
    ) {
      await admin
        .from('live_matches')
        .update({
          status: 'cancelled',
          finish_reason: 'left_lobby',
          completed_at: nowIso,
        })
        .eq('id', matchId);

      await broadcastLiveEvent(matchId, 'match_cancelled', {
        userId,
        reason: 'left_lobby',
      });

      return jsonResponse({ cancelled: true });
    }

    if (
      loaded.match.status === 'countdown' ||
      loaded.match.status === 'running' ||
      loaded.match.status === 'awaiting_results'
    ) {
      if (self.result !== 'pending') {
        const state = await buildPublicMatchState(admin, matchId, userId);
        return jsonResponse({ forfeited: true, state });
      }

      const opponent = loaded.players.find((player) => player.user_id !== userId);
      if (!opponent) {
        await admin
          .from('live_matches')
          .update({
            status: 'cancelled',
            finish_reason: 'left_solo',
            completed_at: nowIso,
          })
          .eq('id', matchId);
        return jsonResponse({ cancelled: true });
      }

      await admin
        .from('live_match_players')
        .update({ result: 'forfeit_loss', disconnected_at: nowIso })
        .eq('match_id', matchId)
        .eq('user_id', userId);

      await admin
        .from('live_match_players')
        .update({ result: 'forfeit_win' })
        .eq('match_id', matchId)
        .eq('user_id', opponent.user_id);

      await admin
        .from('live_matches')
        .update({
          status: 'forfeited',
          winner_user_id: opponent.user_id,
          finish_reason: 'voluntary_forfeit',
          completed_at: nowIso,
        })
        .eq('id', matchId);

      await broadcastLiveEvent(matchId, 'player_forfeited', {
        userId,
        winnerUserId: opponent.user_id,
        reason: 'voluntary',
      });
      await broadcastLiveEvent(matchId, 'match_completed', {
        winnerUserId: opponent.user_id,
        finishReason: 'voluntary_forfeit',
      });

      const state = await buildPublicMatchState(admin, matchId, userId);
      return jsonResponse({ forfeited: true, state });
    }

    return jsonResponse({ ok: true });
  } catch {
    return errorResponse('Unexpected server error.', 500);
  }
});
