import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

import { createServiceClient } from '../_shared/supabaseAdmin.ts';
import { corsHeaders, errorResponse, jsonResponse } from '../_shared/cors.ts';

/**
 * Async Duel push dispatcher (service-role / cron).
 *
 * Settlement never waits on this function.
 * Requires secrets:
 * - SUPABASE_SERVICE_ROLE_KEY (standard)
 * - EXPO_ACCESS_TOKEN (Expo push API) — optional; without it jobs are marked suppressed
 * - PUSH_DISPATCH_SECRET — required request header x-push-dispatch-secret
 *
 * Manual config still required for real-device delivery. Do not claim E2E pass
 * until physical devices are tested.
 */

type ClaimedItem = {
  outboxId: string;
  notificationId: string;
  userId: string;
  attemptCount: number;
  notification: {
    type: string;
    titleKey: string;
    bodyData: Record<string, unknown>;
    deepLinkData: Record<string, unknown> | null;
    duelId: string | null;
  } | null;
  tokens: Array<{
    id: string;
    token: string;
    platform: string;
    appEnvironment: string;
  }>;
};

function titleFor(type: string): string {
  switch (type) {
    case 'DUEL_CHALLENGE_RECEIVED':
      return 'NEW DUEL';
    case 'DUEL_COMPLETED':
      return 'DUEL COMPLETE';
    case 'DUEL_DECLINED':
      return 'CHALLENGE DECLINED';
    default:
      return '21 BLAZE';
  }
}

function bodyFor(type: string, bodyData: Record<string, unknown>): string {
  const name =
    typeof bodyData.opponentDisplayName === 'string' && bodyData.opponentDisplayName.trim()
      ? bodyData.opponentDisplayName.trim()
      : 'A player';
  switch (type) {
    case 'DUEL_CHALLENGE_RECEIVED':
      return `${name} challenged you.`;
    case 'DUEL_COMPLETED':
      return `Your duel with ${name} is ready.`;
    case 'DUEL_DECLINED':
      return `${name} declined your challenge.`;
    default:
      return 'You have a duel update.';
  }
}

function sanitizePayload(notification: NonNullable<ClaimedItem['notification']>) {
  const bodyData = notification.bodyData ?? {};
  return {
    type: notification.type,
    title: titleFor(notification.type),
    body: bodyFor(notification.type, bodyData),
    data: {
      screen: notification.deepLinkData?.screen ?? null,
      duelId: notification.duelId,
      // Intentionally omit seed and private fields.
    },
  };
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (request.method !== 'POST') {
    return errorResponse('Method not allowed.', 405);
  }

  const expected = Deno.env.get('PUSH_DISPATCH_SECRET');
  const provided = request.headers.get('x-push-dispatch-secret');
  if (!expected || !provided || provided !== expected) {
    return errorResponse('Unauthorized.', 401);
  }

  try {
    const admin = createServiceClient();
    const { data: claimed, error: claimError } = await admin.rpc(
      'claim_notification_push_outbox',
      { p_limit: 20 },
    );
    if (claimError) {
      return errorResponse(claimError.message || 'Claim failed.', 500);
    }

    const items = (claimed?.items ?? []) as ClaimedItem[];
    const expoToken = Deno.env.get('EXPO_ACCESS_TOKEN');
    const results: Array<Record<string, unknown>> = [];

    for (const item of items) {
      if (!item.notification) {
        await admin.rpc('complete_notification_push_outbox', {
          p_outbox_id: item.outboxId,
          p_status: 'suppressed',
          p_error_code: 'missing_notification',
        });
        results.push({ outboxId: item.outboxId, status: 'suppressed' });
        continue;
      }

      if (item.notification.type === 'DUEL_EXPIRED') {
        await admin.rpc('complete_notification_push_outbox', {
          p_outbox_id: item.outboxId,
          p_status: 'suppressed',
          p_error_code: 'in_app_only',
        });
        results.push({ outboxId: item.outboxId, status: 'suppressed' });
        continue;
      }

      if (!item.tokens.length) {
        await admin.rpc('complete_notification_push_outbox', {
          p_outbox_id: item.outboxId,
          p_status: 'suppressed',
          p_error_code: 'no_active_tokens',
        });
        results.push({ outboxId: item.outboxId, status: 'suppressed' });
        continue;
      }

      if (!expoToken) {
        await admin.rpc('complete_notification_push_outbox', {
          p_outbox_id: item.outboxId,
          p_status: 'suppressed',
          p_error_code: 'expo_token_missing',
        });
        results.push({
          outboxId: item.outboxId,
          status: 'suppressed',
          note: 'EXPO_ACCESS_TOKEN not configured',
        });
        continue;
      }

      const payload = sanitizePayload(item.notification);
      const messages = item.tokens.map((t) => ({
        to: t.token,
        title: payload.title,
        body: payload.body,
        data: payload.data,
        sound: 'default',
      }));

      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${expoToken}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(messages),
      });

      if (!response.ok) {
        await admin.rpc('complete_notification_push_outbox', {
          p_outbox_id: item.outboxId,
          p_status: 'failed',
          p_error_code: `http_${response.status}`,
        });
        results.push({ outboxId: item.outboxId, status: 'failed' });
        continue;
      }

      const json = await response.json();
      const tickets = Array.isArray(json?.data) ? json.data : [json?.data];
      const invalidIds: string[] = [];
      let providerId: string | null = null;

      tickets.forEach((ticket: { status?: string; id?: string; details?: { error?: string } }, index: number) => {
        if (ticket?.id) {
          providerId = ticket.id;
        }
        if (ticket?.status === 'error') {
          const err = ticket.details?.error ?? '';
          if (/DeviceNotRegistered|InvalidCredentials/i.test(err)) {
            const token = item.tokens[index];
            if (token) {
              invalidIds.push(token.id);
            }
          }
        }
      });

      await admin.rpc('complete_notification_push_outbox', {
        p_outbox_id: item.outboxId,
        p_status: 'submitted',
        p_provider_message_id: providerId,
        p_invalid_token_ids: invalidIds.length ? invalidIds : null,
      });
      results.push({
        outboxId: item.outboxId,
        status: 'submitted',
        invalidTokens: invalidIds.length,
      });
    }

    return jsonResponse({
      ok: true,
      processed: results.length,
      results,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Dispatcher failed.';
    return errorResponse(message, 500);
  }
});
