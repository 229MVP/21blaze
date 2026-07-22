import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

import { corsHeaders, errorResponse, jsonResponse } from '../_shared/cors.ts';
import { createServiceClient } from '../_shared/supabaseAdmin.ts';

const MATCH_DURATION_SECONDS = 120;
const SUBMISSION_GRACE_SECONDS = 30;

function randomSeed(): number {
  const bytes = new Uint32Array(1);
  crypto.getRandomValues(bytes);
  // Signed 32-bit integer range.
  return (bytes[0] % 0x80000000) | 0;
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

    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('id, display_name')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError || !profile) {
      return errorResponse('Profile unavailable.', 403);
    }

    const now = new Date();
    const nowIso = now.toISOString();

    // Abandon expired active matches for this user.
    await admin
      .from('online_matches')
      .update({ status: 'abandoned', completed_at: nowIso })
      .eq('user_id', user.id)
      .eq('status', 'active')
      .lt('expires_at', nowIso);

    const { data: activeMatches, error: activeError } = await admin
      .from('online_matches')
      .select('id')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .limit(1);

    if (activeError) {
      return errorResponse('Unable to start match.', 500);
    }

    if (activeMatches && activeMatches.length > 0) {
      return errorResponse('An active match already exists.', 409);
    }

    // Soft rate limit: no more than 20 matches created in the last 10 minutes.
    const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000).toISOString();
    const { count: recentCount, error: countError } = await admin
      .from('online_matches')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', tenMinutesAgo);

    if (countError) {
      return errorResponse('Unable to start match.', 500);
    }

    if ((recentCount ?? 0) >= 20) {
      return errorResponse('Too many match attempts. Try again shortly.', 429);
    }

    const seed = randomSeed();
    const expiresAt = new Date(
      now.getTime() + (MATCH_DURATION_SECONDS + SUBMISSION_GRACE_SECONDS) * 1000,
    ).toISOString();

    let clientVersion: string | null = null;
    try {
      const body = await request.json();
      if (body && typeof body.clientVersion === 'string') {
        clientVersion = body.clientVersion.slice(0, 32);
      }
    } catch {
      // Body is optional.
    }

    const { data: match, error: insertError } = await admin
      .from('online_matches')
      .insert({
        user_id: user.id,
        seed,
        status: 'active',
        started_at: nowIso,
        expires_at: expiresAt,
        client_version: clientVersion,
      })
      .select('id, seed, started_at, expires_at')
      .single();

    if (insertError || !match) {
      return errorResponse('Unable to create match.', 500);
    }

    return jsonResponse({
      matchId: match.id,
      seed: match.seed,
      startedAt: match.started_at,
      expiresAt: match.expires_at,
      durationSeconds: MATCH_DURATION_SECONDS,
    });
  } catch {
    return errorResponse('Unexpected server error.', 500);
  }
});
