import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

import { parseJsonBody, requireAuthedUser } from '../_shared/auth.ts';
import { corsHeaders, errorResponse, jsonResponse } from '../_shared/cors.ts';
import {
  broadcastLiveEvent,
  buildPublicMatchState,
  LIVE_COUNTDOWN_SECONDS,
  LIVE_MATCH_DURATION_SECONDS,
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
      loaded.match.status !== 'waiting' &&
      loaded.match.status !== 'ready'
    ) {
      return errorResponse('Match cannot accept ready state.', 409);
    }

    if (loaded.players.length < 2) {
      return errorResponse('Waiting for an opponent before ready.', 409);
    }

    const nowIso = new Date().toISOString();
    await admin
      .from('live_match_players')
      .update({ ready_at: nowIso, last_seen_at: nowIso })
      .eq('match_id', matchId)
      .eq('user_id', userId);

    await touchLastSeen(admin, matchId, userId);
    await broadcastLiveEvent(matchId, 'player_ready', { userId });

    const refreshed = await loadMatchWithPlayers(admin, matchId);
    if (!refreshed) {
      return errorResponse('Match not found.', 404);
    }

    const bothReady = refreshed.players.every((player) => Boolean(player.ready_at));

    if (bothReady && refreshed.players.length === 2) {
      const startsAt = new Date(Date.now() + LIVE_COUNTDOWN_SECONDS * 1000);
      const endsAt = new Date(
        startsAt.getTime() + LIVE_MATCH_DURATION_SECONDS * 1000,
      );

      await admin
        .from('live_matches')
        .update({
          status: 'countdown',
          starts_at: startsAt.toISOString(),
          ends_at: endsAt.toISOString(),
        })
        .eq('id', matchId)
        .in('status', ['waiting', 'ready']);

      await broadcastLiveEvent(matchId, 'both_ready', {
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
      });

      await broadcastLiveEvent(matchId, 'match_start', {
        matchId,
        seed: refreshed.match.seed,
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        durationSeconds: LIVE_MATCH_DURATION_SECONDS,
      });
    }

    const state = await buildPublicMatchState(admin, matchId, userId);
    return jsonResponse({ state });
  } catch {
    return errorResponse('Unexpected server error.', 500);
  }
});
