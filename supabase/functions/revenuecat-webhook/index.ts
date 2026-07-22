import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

import { corsHeaders, errorResponse, jsonResponse } from '../_shared/cors.ts';
import {
  grantEntitlementKeys,
  includesFoundersBenefits,
  isUuid,
  resolveEntitlementKeys,
  revokeEntitlementKeys,
  unlockCosmeticsForEntitlements,
} from '../_shared/monetization.ts';
import { createServiceClient } from '../_shared/supabaseAdmin.ts';

const GRANT_EVENT_TYPES = new Set([
  'INITIAL_PURCHASE',
  'NON_RENEWING_PURCHASE',
  'PRODUCT_CHANGE',
  'UNCANCELLATION',
  'TRANSFER',
]);

const REVOKE_EVENT_TYPES = new Set([
  'CANCELLATION',
  'EXPIRATION',
  'REFUND',
]);

type RevenueCatEvent = {
  id?: unknown;
  type?: unknown;
  app_user_id?: unknown;
  product_id?: unknown;
  entitlement_ids?: unknown;
  store?: unknown;
  environment?: unknown;
  event_timestamp_ms?: unknown;
};

function authorizationMatches(headerValue: string, expected: string): boolean {
  if (headerValue === expected) {
    return true;
  }
  const bearer = headerValue.replace(/^Bearer\s+/i, '').trim();
  const expectedRaw = expected.replace(/^Bearer\s+/i, '').trim();
  return bearer === expectedRaw || bearer === expected || headerValue === expectedRaw;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === 'string');
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return errorResponse('Method not allowed.', 405);
  }

  try {
    const expectedSecret = Deno.env.get('REVENUECAT_WEBHOOK_AUTHORIZATION');
    if (!expectedSecret) {
      return errorResponse('Webhook not configured.', 500);
    }

    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authorizationMatches(authHeader, expectedSecret)) {
      return errorResponse('Unauthorized.', 401);
    }

    let body: { event?: RevenueCatEvent } & Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return errorResponse('Invalid JSON body.', 400);
    }

    const event = body.event;
    if (!event || typeof event !== 'object') {
      return errorResponse('Missing event payload.', 400);
    }

    const eventId = typeof event.id === 'string' ? event.id : '';
    const eventType = typeof event.type === 'string' ? event.type : '';
    if (!eventId || !eventType) {
      return errorResponse('event.id and event.type are required.', 400);
    }

    const appUserId =
      typeof event.app_user_id === 'string' ? event.app_user_id.trim() : '';
    const productId =
      typeof event.product_id === 'string' ? event.product_id : null;
    const entitlementIds = asStringArray(event.entitlement_ids);
    const store = typeof event.store === 'string' ? event.store : null;
    const environment =
      typeof event.environment === 'string' ? event.environment : null;
    const eventTimestampMs =
      typeof event.event_timestamp_ms === 'number'
        ? event.event_timestamp_ms
        : null;
    const eventTimestamp = eventTimestampMs
      ? new Date(eventTimestampMs).toISOString()
      : null;

    const admin = createServiceClient();

    const { error: insertError } = await admin.from('purchase_events').insert({
      user_id: isUuid(appUserId) ? appUserId : null,
      revenuecat_event_id: eventId,
      event_type: eventType,
      product_id: productId,
      entitlement_ids: entitlementIds,
      store,
      environment,
      event_timestamp: eventTimestamp,
      raw_event: body,
      processed_at: null,
    });

    if (insertError) {
      if (insertError.code === '23505') {
        return jsonResponse({ ok: true, duplicate: true });
      }
      return errorResponse('Unable to record purchase event.', 500);
    }

    if (!isUuid(appUserId)) {
      await admin
        .from('purchase_events')
        .update({ processed_at: new Date().toISOString() })
        .eq('revenuecat_event_id', eventId);
      return jsonResponse({ ok: true, skipped: 'invalid_app_user_id' });
    }

    const userId = appUserId;
    const entitlementKeys = resolveEntitlementKeys(productId, entitlementIds);

    if (GRANT_EVENT_TYPES.has(eventType) && entitlementKeys.length > 0) {
      if (includesFoundersBenefits(entitlementKeys)) {
        await admin.rpc('grant_founders_bundle_benefits', {
          p_user_id: userId,
        });
      }
      await grantEntitlementKeys(admin, userId, entitlementKeys, productId);
      await unlockCosmeticsForEntitlements(admin, userId, entitlementKeys);
    } else if (REVOKE_EVENT_TYPES.has(eventType) && entitlementKeys.length > 0) {
      // Revoke entitlements only — never claw back wallet balance.
      await revokeEntitlementKeys(admin, userId, entitlementKeys, eventType);
    }

    await admin
      .from('purchase_events')
      .update({ processed_at: new Date().toISOString() })
      .eq('revenuecat_event_id', eventId);

    return jsonResponse({ ok: true });
  } catch (_error) {
    return errorResponse('Internal server error.', 500);
  }
});
