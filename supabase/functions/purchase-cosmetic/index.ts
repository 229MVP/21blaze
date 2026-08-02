import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

import { parseJsonBody, requireAuthedUser } from '../_shared/auth.ts';
import { corsHeaders, errorResponse, jsonResponse } from '../_shared/cors.ts';

type PurchaseResult = {
  already_owned?: boolean;
  cosmetic_id?: string;
  balance?: unknown;
  owned?: boolean;
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
    const cosmeticId =
      typeof body.cosmeticId === 'string' ? body.cosmeticId.trim() : '';

    if (!cosmeticId) {
      return errorResponse('cosmeticId is required.', 400);
    }

    // Version 1.1B — purchase_cosmetic() reads the real price from
    // cosmetic_catalog inside the database; no price, discount, or
    // ownership state is ever accepted from the client.
    const { admin, userId } = auth;
    const { data, error } = await admin.rpc('purchase_cosmetic', {
      p_user_id: userId,
      p_cosmetic_id: cosmeticId,
    });

    if (error) {
      const message = error.message || 'Unable to purchase cosmetic.';
      if (/insufficient blaze coins/i.test(message)) {
        return errorResponse('Not enough Blaze Coins.', 409);
      }
      if (/not purchasable with blaze coins/i.test(message)) {
        return errorResponse('Cosmetic is not available for coin purchase.', 400);
      }
      if (/not found/i.test(message)) {
        return errorResponse('Cosmetic not found.', 404);
      }
      if (/is not available/i.test(message)) {
        return errorResponse('Cosmetic is not available.', 400);
      }
      return errorResponse(message, 400);
    }

    const result = (data ?? {}) as PurchaseResult;
    const balance =
      typeof result.balance === 'number'
        ? result.balance
        : Number(result.balance ?? 0);

    return jsonResponse({
      ok: true,
      balance,
      cosmeticId: result.cosmetic_id ?? cosmeticId,
      alreadyOwned: Boolean(result.already_owned),
      owned: Boolean(result.owned ?? true),
    });
  } catch (_error) {
    return errorResponse('Internal server error.', 500);
  }
});
