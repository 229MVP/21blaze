import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

import { parseJsonBody, requireAuthedUser } from '../_shared/auth.ts';
import { corsHeaders, errorResponse, jsonResponse } from '../_shared/cors.ts';

/**
 * Version 1.1A — single secure Solo match reward endpoint.
 *
 * The client sends only `matchId`. All amounts (completion coins,
 * first-of-day bonus, active-time coins, XP) are computed and verified
 * entirely server-side by `claim_v1_1_match_reward`, which is idempotent
 * per match. No client-submitted reward amount or elapsed-time value is
 * ever trusted for payout.
 */
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
    const matchId = typeof body.matchId === 'string' ? body.matchId : '';

    if (!matchId) {
      return errorResponse('matchId is required.', 400);
    }

    const { admin, userId } = auth;

    const { data, error } = await admin.rpc('claim_v1_1_match_reward', {
      p_user_id: userId,
      p_match_id: matchId,
    });

    if (error) {
      const message = error.message || 'Unable to claim match rewards.';
      if (/not found/i.test(message)) {
        return errorResponse('Match not found.', 404);
      }
      if (/does not belong/i.test(message)) {
        return errorResponse('Match ownership mismatch.', 403);
      }
      if (/not completed/i.test(message)) {
        return errorResponse('Match is not completed.', 409);
      }
      if (/verified score not found/i.test(message)) {
        return errorResponse('Match has not been verified yet.', 409);
      }
      return errorResponse(message, 400);
    }

    const result = (data ?? {}) as {
      already_processed?: boolean;
      match_coins?: number;
      first_match_bonus_coins?: number;
      active_time_coins?: number;
      active_time_seconds?: number;
      xp_granted?: number;
      total_coins?: number;
      balance?: number;
    };

    return jsonResponse({
      ok: true,
      alreadyProcessed: Boolean(result.already_processed),
      matchCoins: Number(result.match_coins ?? 0),
      firstMatchBonusCoins: Number(result.first_match_bonus_coins ?? 0),
      activeTimeCoins: Number(result.active_time_coins ?? 0),
      activeTimeSeconds: Number(result.active_time_seconds ?? 0),
      xpGranted: Number(result.xp_granted ?? 0),
      totalCoins: Number(result.total_coins ?? 0),
      balance: Number(result.balance ?? 0),
    });
  } catch (_error) {
    return errorResponse('Internal server error.', 500);
  }
});
