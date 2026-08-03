import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

import { requireAuthedUser } from '../_shared/auth.ts';
import { corsHeaders, errorResponse, jsonResponse } from '../_shared/cors.ts';

/**
 * Version 1.1C — pre-registers a rewarded-ad reward attempt BEFORE the
 * client loads the ad, so the daily cap is enforced server-side without
 * ever wasting an ad impression the player couldn't be paid for. The
 * returned `requestId` must be passed as `serverSideVerificationOptions.customData`
 * when the client creates the rewarded ad request.
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
    const { admin, userId } = auth;

    const { data, error } = await admin.rpc('request_rewarded_ad', {
      p_user_id: userId,
    });

    if (error) {
      return errorResponse(error.message || 'Unable to request rewarded ad.', 400);
    }

    const result = (data ?? {}) as {
      allowed?: boolean;
      reason?: string;
      requestId?: string;
      rewardAmount?: number;
      dailyRemaining?: number;
    };

    if (!result.allowed) {
      // Not an error — a normal, expected decision (e.g. daily cap
      // reached) — so the client can distinguish it from a network/edge
      // function failure without parsing a non-2xx response body.
      return jsonResponse({
        ok: false,
        reason: result.reason ?? 'unavailable',
        dailyRemaining: result.dailyRemaining ?? 0,
      });
    }

    return jsonResponse({
      ok: true,
      requestId: result.requestId,
      rewardAmount: result.rewardAmount,
      dailyRemaining: result.dailyRemaining,
    });
  } catch (_error) {
    return errorResponse('Internal server error.', 500);
  }
});
