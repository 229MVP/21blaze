import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

import { parseJsonBody, requireAuthedUser } from '../_shared/auth.ts';
import { corsHeaders, errorResponse, jsonResponse } from '../_shared/cors.ts';
import {
  grantEntitlementKeys,
  includesFoundersBenefits,
  unlockCosmeticsForEntitlements,
} from '../_shared/monetization.ts';

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
    const rawKeys = body.activeEntitlementKeys;

    if (!Array.isArray(rawKeys)) {
      return errorResponse('activeEntitlementKeys must be an array.', 400);
    }

    const activeEntitlementKeys = rawKeys.filter(
      (key): key is string => typeof key === 'string' && key.length > 0,
    );

    const { admin, userId } = auth;

    if (activeEntitlementKeys.length === 0) {
      return jsonResponse({ ok: true });
    }

    if (includesFoundersBenefits(activeEntitlementKeys)) {
      await admin.rpc('grant_founders_bundle_benefits', {
        p_user_id: userId,
      });
    }

    await grantEntitlementKeys(admin, userId, activeEntitlementKeys, null);
    await unlockCosmeticsForEntitlements(
      admin,
      userId,
      activeEntitlementKeys,
    );

    return jsonResponse({ ok: true });
  } catch (_error) {
    return errorResponse('Internal server error.', 500);
  }
});
