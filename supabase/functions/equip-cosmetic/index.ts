import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

import { parseJsonBody, requireAuthedUser } from '../_shared/auth.ts';
import { corsHeaders, errorResponse, jsonResponse } from '../_shared/cors.ts';

const VALID_CATEGORIES = new Set([
  'card_theme',
  'arena',
  'profile_frame',
  'title',
  'emote',
  'victory_effect',
]);

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
    const category =
      typeof body.category === 'string' ? body.category.trim() : '';

    if (!cosmeticKey || !category) {
      return errorResponse('cosmeticKey and category are required.', 400);
    }

    if (!VALID_CATEGORIES.has(category)) {
      return errorResponse('Invalid cosmetic category.', 400);
    }

    const { admin, userId } = auth;
    const { data, error } = await admin.rpc('equip_cosmetic_secure', {
      p_user_id: userId,
      p_cosmetic_key: cosmeticKey,
      p_category: category,
    });

    if (error) {
      const message = error.message || 'Unable to equip cosmetic.';
      if (/not owned/i.test(message)) {
        return errorResponse('Cosmetic is not owned.', 403);
      }
      return errorResponse(message, 400);
    }

    if (!data || typeof data !== 'object') {
      return errorResponse('Equip failed.', 500);
    }

    const equipped = data as Record<string, unknown>;
    return jsonResponse({
      ok: true,
      equipped: {
        card_theme: String(equipped.card_theme ?? ''),
        arena: String(equipped.arena ?? ''),
        profile_frame: String(equipped.profile_frame ?? ''),
        player_title:
          equipped.player_title == null ? null : String(equipped.player_title),
        victory_effect:
          equipped.victory_effect == null
            ? null
            : String(equipped.victory_effect),
        user_id: equipped.user_id == null ? userId : String(equipped.user_id),
        updated_at:
          equipped.updated_at == null ? null : String(equipped.updated_at),
      },
    });
  } catch (_error) {
    return errorResponse('Internal server error.', 500);
  }
});
