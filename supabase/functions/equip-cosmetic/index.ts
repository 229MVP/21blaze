import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

import { parseJsonBody, requireAuthedUser } from '../_shared/auth.ts';
import { corsHeaders, errorResponse, jsonResponse } from '../_shared/cors.ts';

const VALID_SLOTS = new Set([
  'cardFaceId',
  'cardBackId',
  'arenaId',
  'profileFrameId',
  'playerTitleId',
  'laneEffectId',
]);

type EquipResult = {
  cardFaceId?: string | null;
  cardBackId?: string | null;
  arenaId?: string | null;
  profileFrameId?: string | null;
  playerTitleId?: string | null;
  laneEffectId?: string | null;
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
    const slot = typeof body.slot === 'string' ? body.slot.trim() : '';

    if (!cosmeticId || !slot) {
      return errorResponse('slot and cosmeticId are required.', 400);
    }

    if (!VALID_SLOTS.has(slot)) {
      return errorResponse('Invalid equipment slot.', 400);
    }

    const { admin, userId } = auth;
    const { data, error } = await admin.rpc('equip_cosmetic', {
      p_user_id: userId,
      p_slot: slot,
      p_cosmetic_id: cosmeticId,
    });

    if (error) {
      const message = error.message || 'Unable to equip cosmetic.';
      if (/not owned/i.test(message)) {
        return errorResponse('Cosmetic is not owned.', 403);
      }
      if (/does not match slot/i.test(message)) {
        return errorResponse('Cosmetic type does not match this equipment slot.', 400);
      }
      if (/not found/i.test(message)) {
        return errorResponse('Cosmetic not found.', 404);
      }
      return errorResponse(message, 400);
    }

    if (!data || typeof data !== 'object') {
      return errorResponse('Equip failed.', 500);
    }

    const equipped = data as EquipResult;
    return jsonResponse({
      ok: true,
      equipped: {
        cardFaceId: equipped.cardFaceId ?? null,
        cardBackId: equipped.cardBackId ?? null,
        arenaId: equipped.arenaId ?? null,
        profileFrameId: equipped.profileFrameId ?? null,
        playerTitleId: equipped.playerTitleId ?? null,
        laneEffectId: equipped.laneEffectId ?? null,
      },
    });
  } catch (_error) {
    return errorResponse('Internal server error.', 500);
  }
});
