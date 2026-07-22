import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

import { requireAuthedUser } from '../_shared/auth.ts';
import { corsHeaders, errorResponse, jsonResponse } from '../_shared/cors.ts';
import {
  buildPublicMatchState,
  expireStaleWaitingRooms,
  generateRoomCode,
  LIVE_ROOM_TTL_MS,
  randomSeed,
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

    const { admin, userId } = auth;
    await expireStaleWaitingRooms(admin);

    const now = new Date();
    const expiresAt = new Date(now.getTime() + LIVE_ROOM_TTL_MS).toISOString();
    const seed = randomSeed();

    let matchId: string | null = null;
    let roomCode = '';

    for (let attempt = 0; attempt < 8; attempt += 1) {
      roomCode = generateRoomCode();
      const { data: match, error } = await admin
        .from('live_matches')
        .insert({
          room_code: roomCode,
          mode: 'friend',
          status: 'waiting',
          seed,
          host_user_id: userId,
          expires_at: expiresAt,
        })
        .select('id, room_code')
        .single();

      if (!error && match) {
        matchId = match.id;
        roomCode = match.room_code;
        break;
      }

      if (error?.code !== '23505') {
        return errorResponse('Unable to create live room.', 500);
      }
    }

    if (!matchId) {
      return errorResponse('Unable to allocate room code.', 500);
    }

    const { error: playerError } = await admin.from('live_match_players').insert({
      match_id: matchId,
      user_id: userId,
      seat: 1,
      last_seen_at: now.toISOString(),
    });

    if (playerError) {
      await admin.from('live_matches').delete().eq('id', matchId);
      return errorResponse('Unable to seat host.', 500);
    }

    const state = await buildPublicMatchState(admin, matchId, userId);
    return jsonResponse({
      matchId,
      roomCode,
      seed,
      expiresAt,
      state,
    });
  } catch {
    return errorResponse('Unexpected server error.', 500);
  }
});
