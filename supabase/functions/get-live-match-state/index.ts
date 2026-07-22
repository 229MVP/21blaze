import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

import { parseJsonBody, requireAuthedUser } from '../_shared/auth.ts';
import { corsHeaders, errorResponse, jsonResponse } from '../_shared/cors.ts';
import {
  applyDisconnectForfeits,
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

    const { admin, userId } = auth;
    const loaded = await loadMatchWithPlayers(admin, matchId);
    if (!loaded) {
      return errorResponse('Match not found.', 404);
    }

    const self = loaded.players.find((player) => player.user_id === userId);
    if (!self) {
      return errorResponse('Not a match participant.', 403);
    }

    const wasDisconnected = Boolean(self.disconnected_at);
    await touchLastSeen(admin, matchId, userId);

    if (wasDisconnected) {
      await broadcastLiveEvent(matchId, 'player_reconnected', { userId });
    }

    // Advance countdown → running once starts_at has passed.
    if (
      loaded.match.status === 'countdown' &&
      loaded.match.starts_at &&
      Date.parse(loaded.match.starts_at) <= Date.now()
    ) {
      await admin
        .from('live_matches')
        .update({ status: 'running' })
        .eq('id', matchId)
        .eq('status', 'countdown');
    }

    await applyDisconnectForfeits(admin, matchId);
    await finalizeIfBothSubmitted(admin, matchId);

    const state = await buildPublicMatchState(admin, matchId, userId);
    if (!state) {
      return errorResponse('Unable to load match state.', 500);
    }

    return jsonResponse({ state });
  } catch {
    return errorResponse('Unexpected server error.', 500);
  }
});
