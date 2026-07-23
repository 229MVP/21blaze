import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

import { parseJsonBody, requireAuthedUser } from '../_shared/auth.ts';
import { corsHeaders, errorResponse, jsonResponse } from '../_shared/cors.ts';
import {
  broadcastLiveEvent,
  LIVE_COUNTDOWN_SECONDS,
  LIVE_MATCH_DURATION_SECONDS,
  loadMatchWithPlayers,
} from '../_shared/liveMatch.ts';
import {
  elapsedSeconds,
  expireStaleQueues,
  loadAcceptanceState,
  loadActiveQueue,
  normalizeRegion,
  publicOpponentProfile,
  QUEUE_TTL_MS,
  SUPPORTED_GAME_RULES_VERSIONS,
  type AcceptanceRow,
  type QueueRow,
  userHasBlockingLiveMatch,
} from '../_shared/quickMatchHelpers.ts';
import type { createServiceClient } from '../_shared/supabaseAdmin.ts';

type AdminClient = ReturnType<typeof createServiceClient>;

async function cancelPendingMatch(
  admin: AdminClient,
  matchId: string,
  reason: string,
): Promise<void> {
  const nowIso = new Date().toISOString();
  await admin
    .from('live_matches')
    .update({
      status: 'cancelled',
      finish_reason: reason,
      completed_at: nowIso,
    })
    .eq('id', matchId)
    .in('status', ['waiting', 'ready']);

  await broadcastLiveEvent(matchId, 'match_cancelled', { reason });
}

async function requeueAcceptedPlayer(
  admin: AdminClient,
  userId: string,
  region: string | null,
  rulesVersion: string,
): Promise<QueueRow | null> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + QUEUE_TTL_MS).toISOString();

  await admin
    .from('matchmaking_queue')
    .update({
      status: 'cancelled',
      cancelled_at: now.toISOString(),
    })
    .eq('user_id', userId)
    .in('status', ['matched', 'accepted', 'queued']);

  const { data, error } = await admin
    .from('matchmaking_queue')
    .insert({
      user_id: userId,
      mode: 'casual',
      status: 'queued',
      region: region ?? 'unknown',
      game_rules_version: rulesVersion,
      expires_at: expiresAt,
      last_check_at: now.toISOString(),
    })
    .select('*')
    .single();

  if (error || !data) {
    return null;
  }
  return data as QueueRow;
}

async function handleAcceptanceTimeouts(
  admin: AdminClient,
  userId: string,
): Promise<QueueRow | null> {
  const matched = await loadActiveQueue(admin, userId);
  if (!matched || matched.status !== 'matched' || !matched.match_id) {
    return null;
  }

  const accepts = await loadAcceptanceState(admin, matched.match_id, userId);
  if (!accepts.acceptanceExpiresAt) {
    return null;
  }
  if (Date.parse(accepts.acceptanceExpiresAt) > Date.now()) {
    return null;
  }

  await cancelPendingMatch(admin, matched.match_id, 'acceptance_timeout');

  const { data: rows } = await admin
    .from('quick_match_acceptances')
    .select('*')
    .eq('match_id', matched.match_id);

  const acceptanceRows = (rows as AcceptanceRow[] | null) ?? [];
  const accepted = acceptanceRows.filter((row) => row.accepted_at && !row.declined_at);
  const timedOut = acceptanceRows.filter((row) => !row.accepted_at);

  for (const row of timedOut) {
    await admin
      .from('matchmaking_queue')
      .update({
        status: 'expired',
        cancelled_at: new Date().toISOString(),
      })
      .eq('user_id', row.user_id)
      .eq('match_id', matched.match_id)
      .in('status', ['matched', 'accepted']);
  }

  let requeued: QueueRow | null = null;
  for (const row of accepted) {
    const { data: prior } = await admin
      .from('matchmaking_queue')
      .select('region, game_rules_version')
      .eq('user_id', row.user_id)
      .eq('match_id', matched.match_id)
      .order('queued_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const restored = await requeueAcceptedPlayer(
      admin,
      row.user_id,
      (prior?.region as string | null) ?? 'unknown',
      (prior?.game_rules_version as string | undefined) ?? '1.0.0',
    );
    if (row.user_id === userId) {
      requeued = restored;
    }
  }

  return requeued;
}

async function matchFoundPayload(
  admin: AdminClient,
  matchId: string,
  userId: string,
) {
  const opponent = await publicOpponentProfile(admin, matchId, userId);
  const accepts = await loadAcceptanceState(admin, matchId, userId);
  const loaded = await loadMatchWithPlayers(admin, matchId);

  if (
    loaded &&
    (loaded.match.status === 'countdown' || loaded.match.status === 'running')
  ) {
    return {
      status: 'both_accepted' as const,
      matchId,
      opponent,
      acceptanceExpiresAt: accepts.acceptanceExpiresAt,
      localAccepted: true,
      opponentAccepted: true,
      startsAt: loaded.match.starts_at,
      endsAt: loaded.match.ends_at,
      seed: loaded.match.seed,
      matchStatus: loaded.match.status,
      roomType: 'quick_match' as const,
    };
  }

  return {
    status: accepts.localAccepted && accepts.opponentAccepted
      ? ('both_accepted' as const)
      : accepts.localAccepted
        ? ('awaiting_acceptance' as const)
        : ('match_found' as const),
    matchId,
    opponent,
    acceptanceExpiresAt: accepts.acceptanceExpiresAt,
    localAccepted: accepts.localAccepted,
    opponentAccepted: accepts.opponentAccepted,
    roomType: 'quick_match' as const,
  };
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

    const { admin, userId } = auth;
    const body = (await parseJsonBody(request)) ?? {};
    const action = typeof body.action === 'string' ? body.action : '';

    await expireStaleQueues(admin);

    if (action === 'join') {
      const rulesVersion =
        typeof body.gameRulesVersion === 'string' ? body.gameRulesVersion : '';
      if (!SUPPORTED_GAME_RULES_VERSIONS.has(rulesVersion)) {
        return jsonResponse({
          status: 'failed',
          error: 'Unsupported game rules version.',
        }, 400);
      }

      const region = normalizeRegion(body.region);
      const blocking = await userHasBlockingLiveMatch(admin, userId);
      if (blocking.blocking) {
        return jsonResponse({
          status: 'already_in_match',
          matchId: blocking.matchId,
          matchStatus: blocking.status,
          error: 'Already in a Live Duel.',
        }, 409);
      }

      let queue = await loadActiveQueue(admin, userId);
      if (queue && queue.mode === 'ranked') {
        return jsonResponse({
          status: 'failed',
          error: 'Leave Ranked matchmaking before joining Casual Quick Match.',
        }, 409);
      }

      if (queue?.status === 'matched' && queue.match_id) {
        const timedOut = await handleAcceptanceTimeouts(admin, userId);
        if (timedOut) {
          queue = timedOut;
        } else {
          return jsonResponse(await matchFoundPayload(admin, queue.match_id, userId));
        }
      }

      if (queue?.status === 'accepted' && queue.match_id) {
        return jsonResponse(await matchFoundPayload(admin, queue.match_id, userId));
      }

      if (queue?.status === 'queued' && Date.parse(queue.expires_at) <= Date.now()) {
        await admin
          .from('matchmaking_queue')
          .update({
            status: 'expired',
            cancelled_at: new Date().toISOString(),
          })
          .eq('id', queue.id);
        queue = null;
      }

      if (!queue || queue.status !== 'queued') {
        const now = new Date();
        const { data: created, error } = await admin
          .from('matchmaking_queue')
          .insert({
            user_id: userId,
            mode: 'casual',
            status: 'queued',
            region,
            game_rules_version: rulesVersion,
            expires_at: new Date(now.getTime() + QUEUE_TTL_MS).toISOString(),
            last_check_at: now.toISOString(),
          })
          .select('*')
          .single();

        if (error || !created) {
          queue = await loadActiveQueue(admin, userId);
          if (!queue || queue.status !== 'queued') {
            return jsonResponse({
              status: 'failed',
              error: 'Unable to join queue.',
            }, 500);
          }
        } else {
          queue = created as QueueRow;
        }
      }

      const { data: matchedId } = await admin.rpc('try_create_quick_match', {
        requesting_user_id: userId,
        requesting_region: region,
        requesting_game_rules_version: rulesVersion,
      });

      if (typeof matchedId === 'string' && matchedId.length > 0) {
        return jsonResponse(await matchFoundPayload(admin, matchedId, userId));
      }

      const fresh = await loadActiveQueue(admin, userId);
      if (fresh?.status === 'matched' && fresh.match_id) {
        return jsonResponse(await matchFoundPayload(admin, fresh.match_id, userId));
      }

      const active = fresh && fresh.status === 'queued' ? fresh : queue;
      return jsonResponse({
        status: 'queued',
        queueId: active.id,
        queuedAt: active.queued_at,
        expiresAt: active.expires_at,
        elapsedSeconds: elapsedSeconds(active.queued_at),
        region: active.region,
      });
    }

    if (action === 'poll') {
      let queue = await loadActiveQueue(admin, userId);
      if (!queue) {
        return jsonResponse({ status: 'expired' });
      }

      await admin
        .from('matchmaking_queue')
        .update({ last_check_at: new Date().toISOString() })
        .eq('id', queue.id);

      if (queue.status === 'matched' && queue.match_id) {
        const requeued = await handleAcceptanceTimeouts(admin, userId);
        if (requeued) {
          queue = requeued;
        } else {
          return jsonResponse(await matchFoundPayload(admin, queue.match_id, userId));
        }
      }

      if (queue.status === 'accepted' && queue.match_id) {
        return jsonResponse(await matchFoundPayload(admin, queue.match_id, userId));
      }

      if (queue.status === 'queued') {
        if (Date.parse(queue.expires_at) <= Date.now()) {
          await admin
            .from('matchmaking_queue')
            .update({
              status: 'expired',
              cancelled_at: new Date().toISOString(),
            })
            .eq('id', queue.id);
          return jsonResponse({ status: 'expired' });
        }

        const { data: matchedId } = await admin.rpc('try_create_quick_match', {
          requesting_user_id: userId,
          requesting_region: queue.region ?? 'unknown',
          requesting_game_rules_version: queue.game_rules_version,
        });

        if (typeof matchedId === 'string' && matchedId.length > 0) {
          return jsonResponse(await matchFoundPayload(admin, matchedId, userId));
        }

        const refreshed = await loadActiveQueue(admin, userId);
        if (refreshed?.status === 'matched' && refreshed.match_id) {
          return jsonResponse(
            await matchFoundPayload(admin, refreshed.match_id, userId),
          );
        }

        return jsonResponse({
          status: 'queued',
          queueId: queue.id,
          queuedAt: queue.queued_at,
          expiresAt: queue.expires_at,
          elapsedSeconds: elapsedSeconds(queue.queued_at),
          region: queue.region,
        });
      }

      return jsonResponse({ status: queue.status });
    }

    if (action === 'accept') {
      const matchId = typeof body.matchId === 'string' ? body.matchId : '';
      if (!matchId) {
        return errorResponse('matchId is required.', 400);
      }

      const loaded = await loadMatchWithPlayers(admin, matchId);
      if (!loaded) {
        return errorResponse('Match not found.', 404);
      }
      if (!loaded.players.some((player) => player.user_id === userId)) {
        return errorResponse('Not a match participant.', 403);
      }

      const { data: acceptance } = await admin
        .from('quick_match_acceptances')
        .select('*')
        .eq('match_id', matchId)
        .eq('user_id', userId)
        .maybeSingle();

      if (!acceptance) {
        return errorResponse('Acceptance record not found.', 404);
      }

      if (Date.parse(acceptance.expires_at) <= Date.now() && !acceptance.accepted_at) {
        await handleAcceptanceTimeouts(admin, userId);
        return jsonResponse({
          status: 'expired',
          error: 'Acceptance window expired.',
        }, 409);
      }

      if (loaded.match.status === 'cancelled') {
        return jsonResponse({ status: 'cancelled' }, 409);
      }

      const nowIso = new Date().toISOString();
      if (!acceptance.accepted_at) {
        await admin
          .from('quick_match_acceptances')
          .update({ accepted_at: nowIso })
          .eq('match_id', matchId)
          .eq('user_id', userId)
          .is('accepted_at', null);
      }

      const accepts = await loadAcceptanceState(admin, matchId, userId);

      if (accepts.localAccepted && accepts.opponentAccepted) {
        const startsAt = new Date(Date.now() + LIVE_COUNTDOWN_SECONDS * 1000);
        const endsAt = new Date(
          startsAt.getTime() + LIVE_MATCH_DURATION_SECONDS * 1000,
        );

        await admin
          .from('live_matches')
          .update({
            status: 'countdown',
            starts_at: startsAt.toISOString(),
            ends_at: endsAt.toISOString(),
          })
          .eq('id', matchId)
          .in('status', ['ready', 'waiting']);

        await admin
          .from('matchmaking_queue')
          .update({ status: 'accepted' })
          .eq('match_id', matchId)
          .in('status', ['matched', 'accepted']);

        await broadcastLiveEvent(matchId, 'both_ready', {
          startsAt: startsAt.toISOString(),
          endsAt: endsAt.toISOString(),
        });
        await broadcastLiveEvent(matchId, 'match_start', {
          matchId,
          seed: loaded.match.seed,
          startsAt: startsAt.toISOString(),
          endsAt: endsAt.toISOString(),
          durationSeconds: LIVE_MATCH_DURATION_SECONDS,
        });

        return jsonResponse({
          status: 'both_accepted',
          matchId,
          startsAt: startsAt.toISOString(),
          endsAt: endsAt.toISOString(),
          seed: loaded.match.seed,
          localAccepted: true,
          opponentAccepted: true,
          acceptanceExpiresAt: accepts.acceptanceExpiresAt,
          opponent: await publicOpponentProfile(admin, matchId, userId),
          roomType: 'quick_match',
        });
      }

      return jsonResponse({
        status: 'awaiting_acceptance',
        matchId,
        localAccepted: true,
        opponentAccepted: accepts.opponentAccepted,
        acceptanceExpiresAt: accepts.acceptanceExpiresAt,
        opponent: await publicOpponentProfile(admin, matchId, userId),
        roomType: 'quick_match',
      });
    }

    if (action === 'decline') {
      const matchId = typeof body.matchId === 'string' ? body.matchId : '';
      if (!matchId) {
        return errorResponse('matchId is required.', 400);
      }

      const loaded = await loadMatchWithPlayers(admin, matchId);
      if (!loaded) {
        return errorResponse('Match not found.', 404);
      }
      if (!loaded.players.some((player) => player.user_id === userId)) {
        return errorResponse('Not a match participant.', 403);
      }

      const nowIso = new Date().toISOString();
      await admin
        .from('quick_match_acceptances')
        .update({ declined_at: nowIso })
        .eq('match_id', matchId)
        .eq('user_id', userId);

      await cancelPendingMatch(admin, matchId, 'declined');

      const { data: rows } = await admin
        .from('quick_match_acceptances')
        .select('*')
        .eq('match_id', matchId);

      const acceptanceRows = (rows as AcceptanceRow[] | null) ?? [];
      for (const row of acceptanceRows) {
        if (row.user_id === userId) {
          await admin
            .from('matchmaking_queue')
            .update({
              status: 'cancelled',
              cancelled_at: nowIso,
            })
            .eq('user_id', userId)
            .eq('match_id', matchId);
          continue;
        }

        if (row.accepted_at) {
          const { data: prior } = await admin
            .from('matchmaking_queue')
            .select('region, game_rules_version')
            .eq('user_id', row.user_id)
            .eq('match_id', matchId)
            .order('queued_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          await requeueAcceptedPlayer(
            admin,
            row.user_id,
            (prior?.region as string | null) ?? 'unknown',
            (prior?.game_rules_version as string | undefined) ?? '1.0.0',
          );
        } else {
          await admin
            .from('matchmaking_queue')
            .update({
              status: 'cancelled',
              cancelled_at: nowIso,
            })
            .eq('user_id', row.user_id)
            .eq('match_id', matchId);
        }
      }

      return jsonResponse({ status: 'cancelled' });
    }

    if (action === 'cancel') {
      const queue = await loadActiveQueue(admin, userId);
      if (!queue) {
        return jsonResponse({ status: 'cancelled', cancelled: true });
      }

      if (queue.status === 'queued') {
        await admin
          .from('matchmaking_queue')
          .update({
            status: 'cancelled',
            cancelled_at: new Date().toISOString(),
          })
          .eq('id', queue.id)
          .eq('user_id', userId)
          .eq('status', 'queued');
        return jsonResponse({ status: 'cancelled', cancelled: true });
      }

      if (queue.status === 'matched' && queue.match_id) {
        return jsonResponse({
          status: 'match_found',
          error: 'Decline the match instead of cancelling the queue.',
          matchId: queue.match_id,
        }, 409);
      }

      return jsonResponse({ status: 'cancelled', cancelled: true });
    }

    if (action === 'reconnect') {
      const queue = await loadActiveQueue(admin, userId);

      if (queue?.status === 'matched' && queue.match_id) {
        const requeued = await handleAcceptanceTimeouts(admin, userId);
        if (requeued) {
          return jsonResponse({
            status: 'queued',
            queueId: requeued.id,
            queuedAt: requeued.queued_at,
            expiresAt: requeued.expires_at,
            elapsedSeconds: elapsedSeconds(requeued.queued_at),
            region: requeued.region,
          });
        }
        return jsonResponse(await matchFoundPayload(admin, queue.match_id, userId));
      }

      if (queue?.status === 'accepted' && queue.match_id) {
        return jsonResponse(await matchFoundPayload(admin, queue.match_id, userId));
      }

      if (queue?.status === 'queued') {
        if (Date.parse(queue.expires_at) <= Date.now()) {
          await admin
            .from('matchmaking_queue')
            .update({
              status: 'expired',
              cancelled_at: new Date().toISOString(),
            })
            .eq('id', queue.id);
          return jsonResponse({ status: 'expired' });
        }
        return jsonResponse({
          status: 'queued',
          queueId: queue.id,
          queuedAt: queue.queued_at,
          expiresAt: queue.expires_at,
          elapsedSeconds: elapsedSeconds(queue.queued_at),
          region: queue.region,
        });
      }

      const blocking = await userHasBlockingLiveMatch(admin, userId);
      if (blocking.blocking && blocking.matchId) {
        const loaded = await loadMatchWithPlayers(admin, blocking.matchId);
        return jsonResponse({
          status: 'already_in_match',
          matchId: blocking.matchId,
          matchStatus: blocking.status,
          startsAt: loaded?.match.starts_at ?? null,
          endsAt: loaded?.match.ends_at ?? null,
          seed: loaded?.match.seed,
          opponent: await publicOpponentProfile(admin, blocking.matchId, userId),
          roomType: loaded?.match.mode ?? 'quick_match',
        });
      }

      return jsonResponse({ status: 'cancelled', idle: true });
    }

    return errorResponse('Unknown action.', 400);
  } catch {
    return errorResponse('Unexpected server error.', 500);
  }
});
