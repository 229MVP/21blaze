import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

import { parseJsonBody, requireAuthedUser } from '../_shared/auth.ts';
import { corsHeaders, errorResponse, jsonResponse } from '../_shared/cors.ts';
import { walletBalance } from '../_shared/monetization.ts';

type PurchaseResult = {
  already_owned?: boolean;
  cosmetic?: {
    cosmetic_key?: string;
    category?: string;
    source?: string;
  } | null;
  wallet?: { blaze_coins?: unknown } | null;
};

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
    const cosmeticKey =
      typeof body.cosmeticKey === 'string' ? body.cosmeticKey.trim() : '';

    if (!cosmeticKey) {
      return errorResponse('cosmeticKey is required.', 400);
    }

    const { admin, userId } = auth;
    const { data, error } = await admin.rpc('purchase_cosmetic_with_coins', {
      p_user_id: userId,
      p_cosmetic_key: cosmeticKey,
    });

    if (error) {
      const message = error.message || 'Unable to purchase cosmetic.';
      if (/insufficient blaze coins/i.test(message)) {
        return errorResponse('Not enough Blaze Coins.', 409);
      }
      if (/not available for coin purchase/i.test(message)) {
        return errorResponse('Cosmetic is not available for coin purchase.', 400);
      }
      return errorResponse(message, 400);
    }

    const result = (data ?? {}) as PurchaseResult;
    const balance = walletBalance(result.wallet ?? null);
    const resolvedKey =
      typeof result.cosmetic?.cosmetic_key === 'string'
        ? result.cosmetic.cosmetic_key
        : cosmeticKey;

    return jsonResponse({
      ok: true,
      balance,
      cosmeticKey: resolvedKey,
      cosmetic: result.cosmetic ?? null,
      alreadyOwned: Boolean(result.already_owned),
    });
  } catch (_error) {
    return errorResponse('Internal server error.', 500);
  }
});
