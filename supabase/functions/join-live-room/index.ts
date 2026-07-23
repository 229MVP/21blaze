import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

import { parseJsonBody, requireAuthedUser } from '../_shared/auth.ts';
import { corsHeaders, errorResponse, jsonResponse } from '../_shared/cors.ts';
import {
  broadcastLiveEvent,
  buildPublicMatchState,
  expireStaleWaitingRooms,
  normalizeRoomCode,
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
    const rawCode = typeof body?.roomCode === 'string' ? body.roomCode : '';
    const roomCode = normalizeRoomCode(rawCode);

    if (roomCode.length !== 6) {
      return errorResponse('Enter a valid 6-character room code.', 400);
    }

    const { admin, userId, displayName } = auth;
    await expireStaleWaitingRooms(admin);

    const { data: match, error: matchError } = await admin
      .from('live_matches')
      .select('*')
      .eq('room_code', roomCode)
      .maybeSingle();

    if (matchError || !match) {
      return errorResponse('Room not found.', 404);
    }

    if (match.status === 'expired' || match.status === 'cancelled') {
      return errorResponse('This room is no longer available.', 409);
    }

    if (match.status !== 'waiting') {
      return errorResponse('This match has already started.', 409);
    }

    if (Date.parse(match.expires_at) <= Date.now()) {
      await admin
        .from('live_matches')
        .update({
          status: 'expired',
          finish_reason: 'expired',
          completed_at: new Date().toISOString(),
        })
        .eq('id', match.id);
      return errorResponse('This room has expired.', 409);
    }

    const { data: existingPlayers } = await admin
      .from('live_match_players')
      .select('user_id, seat')
      .eq('match_id', match.id);

    const players = existingPlayers ?? [];
    if (players.some((player) => player.user_id === userId)) {
      if (match.host_user_id === userId) {
        return errorResponse('Host is already in this room.', 409);
      }
      const state = await buildPublicMatchState(admin, match.id, userId);
      return jsonResponse({ matchId: match.id, roomCode, seed: match.seed, state });
    }

    if (players.length >= 2) {
      return errorResponse('This room is full.', 409);
    }

    const { error: insertError } = await admin.from('live_match_players').insert({
      match_id: match.id,
      user_id: userId,
      seat: 2,
      last_seen_at: new Date().toISOString(),
    });

    if (insertError) {
      if (insertError.code === '23505') {
        return errorResponse('This room is full.', 409);
      }
      return errorResponse('Unable to join room.', 500);
    }

    await admin
      .from('live_matches')
      .update({ status: 'ready' })
      .eq('id', match.id)
      .eq('status', 'waiting');

    await broadcastLiveEvent(match.id, 'opponent_joined', {
      userId,
      displayName,
      seat: 2,
    });

    const state = await buildPublicMatchState(admin, match.id, userId);
    return jsonResponse({
      matchId: match.id,
      roomCode,
      seed: match.seed,
      state,
    });
  } catch {
    return errorResponse('Unexpected server error.', 500);
  }
});
