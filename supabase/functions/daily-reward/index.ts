import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

import { parseJsonBody, requireAuthedUser } from '../_shared/auth.ts';
import { corsHeaders, errorResponse, jsonResponse } from '../_shared/cors.ts';
import {
  computeDailyRewardAvailability,
  ensureProgressionRow,
} from '../_shared/progression.ts';

type DailyRewardAction = 'status' | 'claim' | 'history';

function isAction(value: unknown): value is DailyRewardAction {
  return value === 'status' || value === 'claim' || value === 'history';
}

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
    const action = body.action;
    if (!isAction(action)) {
      return errorResponse('action must be status, claim, or history.', 400);
    }

    const { admin, userId } = auth;

    if (action === 'status') {
      const progression = await ensureProgressionRow(admin, userId);
      const availability = computeDailyRewardAvailability(progression);

      return jsonResponse({
        ok: true,
        action: 'status',
        isAvailable: availability.isAvailable,
        reason: availability.reason,
        currentStreak: availability.currentStreak,
        longestStreak: availability.longestStreak,
        nextStreakDay: availability.nextStreakDay,
        nextClaimAt: availability.nextClaimAt,
        continuesStreak: availability.continuesStreak,
        resetsStreak: availability.resetsStreak,
        currentReward: availability.currentReward,
        calendar: availability.calendar,
        progression: availability.progression,
      });
    }

    if (action === 'claim') {
      const idempotencyKey =
        typeof body.idempotencyKey === 'string' && body.idempotencyKey.trim().length > 0
          ? body.idempotencyKey.trim()
          : null;

      const { data, error } = await admin.rpc('claim_daily_reward_secure', {
        p_user_id: userId,
        p_idempotency_key: idempotencyKey,
      });

      if (error) {
        const message = error.message || 'Unable to claim daily reward.';
        if (/not available yet/i.test(message) || /too soon/i.test(message)) {
          return errorResponse('Daily reward is not available yet.', 409);
        }
        return errorResponse(message, 400);
      }

      return jsonResponse({
        ok: true,
        action: 'claim',
        result: data,
      });
    }

    // history
    const limitRaw = typeof body.limit === 'number' ? body.limit : 20;
    const limit = Math.min(50, Math.max(1, Math.trunc(limitRaw)));

    const { data: claims, error: historyError } = await admin
      .from('daily_reward_claims')
      .select(
        'id, streak_day, blaze_coin_reward, xp_reward, cosmetic_id, claimed_at, idempotency_key',
      )
      .eq('user_id', userId)
      .order('claimed_at', { ascending: false })
      .limit(limit);

    if (historyError) {
      return errorResponse('Unable to load daily reward history.', 500);
    }

    return jsonResponse({
      ok: true,
      action: 'history',
      claims: claims ?? [],
    });
  } catch (_error) {
    return errorResponse('Internal server error.', 500);
  }
});
