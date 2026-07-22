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
    const rewardType =
      typeof body.rewardType === 'string' ? body.rewardType : '';
    const clientRewardId =
      typeof body.clientRewardId === 'string' ? body.clientRewardId.trim() : '';
    const matchId = typeof body.matchId === 'string' ? body.matchId : '';

    if (!rewardType || !clientRewardId) {
      return errorResponse('rewardType and clientRewardId are required.', 400);
    }

    if (rewardType !== 'double_solo_match_coins') {
      return errorResponse('Unsupported rewardType.', 400);
    }

    if (!matchId) {
      return errorResponse('matchId is required for double_solo_match_coins.', 400);
    }

    const { admin, userId } = auth;

    const { data: match, error: matchError } = await admin
      .from('online_matches')
      .select('id, user_id, status')
      .eq('id', matchId)
      .maybeSingle();

    if (matchError || !match) {
      return errorResponse('Match not found.', 404);
    }

    if (match.user_id !== userId) {
      return errorResponse('Match ownership mismatch.', 403);
    }

    if (match.status !== 'completed') {
      return errorResponse('Match is not completed.', 409);
    }

    const { data: verifiedScore } = await admin
      .from('verified_scores')
      .select('score, game_over_reason')
      .eq('match_id', matchId)
      .maybeSingle();

    if (!verifiedScore) {
      return errorResponse('Verified score not found.', 404);
    }

    if (verifiedScore.game_over_reason === 'quit') {
      return errorResponse('Quit matches cannot be doubled.', 409);
    }

    const soloIdempotencyKey = `solo_coins:${matchId}`;
    const doubleIdempotencyKey = `ad_double:${clientRewardId}`;

    const { data: existingDoubleClaim } = await admin
      .from('ad_reward_claims')
      .select('id, reward_amount, status')
      .eq('user_id', userId)
      .eq('reward_type', 'double_solo_match_coins')
      .eq('match_id', matchId)
      .maybeSingle();

    if (existingDoubleClaim) {
      const { data: wallet } = await admin
        .from('player_wallets')
        .select('blaze_coins')
        .eq('user_id', userId)
        .maybeSingle();
      return jsonResponse({
        ok: true,
        balance: walletBalance(wallet),
        granted: Number(existingDoubleClaim.reward_amount ?? 0),
        duplicate: true,
      });
    }

    const { data: existingClientClaim } = await admin
      .from('ad_reward_claims')
      .select('id, reward_amount')
      .eq('user_id', userId)
      .eq('client_reward_id', clientRewardId)
      .maybeSingle();

    if (existingClientClaim) {
      const { data: wallet } = await admin
        .from('player_wallets')
        .select('blaze_coins')
        .eq('user_id', userId)
        .maybeSingle();
      return jsonResponse({
        ok: true,
        balance: walletBalance(wallet),
        granted: Number(existingClientClaim.reward_amount ?? 0),
        duplicate: true,
      });
    }

    const { data: existingDoubleTx } = await admin
      .from('wallet_transactions')
      .select('id, amount')
      .eq('user_id', userId)
      .eq('idempotency_key', doubleIdempotencyKey)
      .maybeSingle();

    if (existingDoubleTx) {
      const { data: wallet } = await admin
        .from('player_wallets')
        .select('blaze_coins')
        .eq('user_id', userId)
        .maybeSingle();
      return jsonResponse({
        ok: true,
        balance: walletBalance(wallet),
        granted: Number(existingDoubleTx.amount ?? 0),
        duplicate: true,
      });
    }

    let baseAmount = 0;
    const { data: soloTx } = await admin
      .from('wallet_transactions')
      .select('amount, idempotency_key, source_key')
      .eq('user_id', userId)
      .eq('idempotency_key', soloIdempotencyKey)
      .maybeSingle();

    if (soloTx) {
      baseAmount = Math.max(0, Number(soloTx.amount));
    } else {
      const score = Number(verifiedScore.score ?? 0);
      const { data: calculated, error: calcError } = await admin.rpc(
        'calculate_solo_match_coins',
        {
          p_score: score,
          p_is_first_of_day: false,
        },
      );
      if (calcError || calculated == null) {
        return errorResponse('Unable to calculate reward amount.', 500);
      }
      baseAmount = Math.max(0, Number(calculated));
    }

    if (baseAmount <= 0) {
      return errorResponse('No coins available to double.', 409);
    }

    const nowIso = new Date().toISOString();
    const { error: claimInsertError } = await admin
      .from('ad_reward_claims')
      .insert({
        user_id: userId,
        reward_type: rewardType,
        reward_amount: baseAmount,
        match_id: matchId,
        client_reward_id: clientRewardId,
        status: 'granted',
        verified_at: nowIso,
        claimed_at: nowIso,
      });

    if (claimInsertError) {
      if (claimInsertError.code === '23505') {
        const { data: wallet } = await admin
          .from('player_wallets')
          .select('blaze_coins')
          .eq('user_id', userId)
          .maybeSingle();
        return jsonResponse({
          ok: true,
          balance: walletBalance(wallet),
          granted: baseAmount,
          duplicate: true,
        });
      }
      return errorResponse('Unable to record ad reward claim.', 500);
    }

    const { data: wallet, error: walletError } = await admin.rpc(
      'apply_wallet_delta',
      {
        p_user_id: userId,
        p_amount: baseAmount,
        p_type: 'earn',
        p_source_key: `ad_double:${matchId}`,
        p_idempotency_key: doubleIdempotencyKey,
        p_metadata: {
          match_id: matchId,
          reward_type: rewardType,
          client_reward_id: clientRewardId,
          base_amount: baseAmount,
        },
      },
    );

    if (walletError || !wallet) {
      return errorResponse('Unable to apply wallet credit.', 500);
    }

    return jsonResponse({
      ok: true,
      balance: walletBalance(wallet),
      granted: baseAmount,
    });
  } catch (_error) {
    return errorResponse('Internal server error.', 500);
  }
});
