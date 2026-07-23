import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

import { parseJsonBody, requireAuthedUser } from '../_shared/auth.ts';
import { corsHeaders, errorResponse, jsonResponse } from '../_shared/cors.ts';
import { walletBalance } from '../_shared/monetization.ts';

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
    // Client score/reason are accepted for backward compatibility only.
    // Migration 0007 makes claim_solo_match_coins ignore them and use verified_scores.
    const score = typeof body.score === 'number' ? body.score : 0;
    const gameOverReason =
      typeof body.gameOverReason === 'string' ? body.gameOverReason : 'unknown';

    if (!matchId) {
      return errorResponse('matchId is required.', 400);
    }

    const { admin, userId } = auth;

    if (gameOverReason === 'quit') {
      const { data: wallet } = await admin
        .from('player_wallets')
        .select('blaze_coins')
        .eq('user_id', userId)
        .maybeSingle();

      return jsonResponse({
        ok: true,
        balance: walletBalance(wallet),
        granted: 0,
      });
    }

    const { data: wallet, error } = await admin.rpc('claim_solo_match_coins', {
      p_user_id: userId,
      p_match_id: matchId,
      p_score: Number.isFinite(score) ? Math.trunc(score) : 0,
      p_game_over_reason: gameOverReason,
    });

    if (error) {
      const message = error.message || 'Unable to claim match coins.';
      if (/not found/i.test(message)) {
        return errorResponse('Match not found.', 404);
      }
      if (/does not belong/i.test(message)) {
        return errorResponse('Match ownership mismatch.', 403);
      }
      if (/not completed/i.test(message)) {
        return errorResponse('Match is not completed.', 409);
      }
      return errorResponse(message, 400);
    }

    const { data: tx } = await admin
      .from('wallet_transactions')
      .select('amount')
      .eq('user_id', userId)
      .eq('idempotency_key', `solo_coins:${matchId}`)
      .maybeSingle();

    const granted = tx ? Math.max(0, Number(tx.amount)) : 0;

    return jsonResponse({
      ok: true,
      balance: walletBalance(wallet),
      granted,
    });
  } catch (_error) {
    return errorResponse('Internal server error.', 500);
  }
});
