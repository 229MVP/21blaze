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
  userHasBlockingLiveMatch,
} from '../_shared/quickMatchHelpers.ts';
import {
  asRankedQueue,
  ensureRanking,
  loadActiveSeason,
  loadVisibleOpponentRanked,
  matchmakingRangeForElapsed,
  PLACEMENT_MATCHES_REQUIRED,
  publicRankedProfile,
  type RankedQueueRow,
} from '../_shared/rankedHelpers.ts';
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
  seasonId: string,
  ratingSnapshot: number,
  placementStatus: string,
): Promise<RankedQueueRow | null> {
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
      mode: 'ranked',
      status: 'queued',
      region: region ?? 'unknown',
      game_rules_version: rulesVersion,
      expires_at: expiresAt,
      last_check_at: now.toISOString(),
      season_id: seasonId,
      rating_snapshot: ratingSnapshot,
      placement_status: placementStatus,
      rating_range_at_join: 100,
    })
    .select('*')
    .single();

  if (error || !data) {
    return null;
  }
  return data as RankedQueueRow;
}

async function handleAcceptanceTimeouts(
  admin: AdminClient,
  userId: string,
): Promise<RankedQueueRow | null> {
  const matched = asRankedQueue(await loadActiveQueue(admin, userId));
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

  let requeued: RankedQueueRow | null = null;
  for (const row of accepted) {
    const { data: prior } = await admin
      .from('matchmaking_queue')
      .select(
        'region, game_rules_version, season_id, rating_snapshot, placement_status',
      )
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
      (prior?.season_id as string | undefined) ?? matched.season_id ?? '',
      typeof prior?.rating_snapshot === 'number' ? prior.rating_snapshot : 1200,
      typeof prior?.placement_status === 'string'
        ? prior.placement_status
        : 'placement',
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
  seasonId: string | null,
) {
  const opponent = await publicOpponentProfile(admin, matchId, userId);
  const accepts = await loadAcceptanceState(admin, matchId, userId);
  const loaded = await loadMatchWithPlayers(admin, matchId);

  let opponentDivision = 'unranked';
  let opponentPlacementComplete = false;
  if (opponent && seasonId) {
    const visible = await loadVisibleOpponentRanked(admin, opponent.user_id, seasonId);
    opponentDivision = visible.division;
    opponentPlacementComplete = visible.placementComplete;
  }

  const opponentPayload = opponent
    ? {
        ...opponent,
        division: opponentDivision,
        placementComplete: opponentPlacementComplete,
      }
    : null;

  if (
    loaded &&
    (loaded.match.status === 'countdown' || loaded.match.status === 'running')
  ) {
    return {
      status: 'both_accepted' as const,
      matchId,
      opponent: opponentPayload,
      acceptanceExpiresAt: accepts.acceptanceExpiresAt,
      localAccepted: true,
      opponentAccepted: true,
      startsAt: loaded.match.starts_at,
      endsAt: loaded.match.ends_at,
      seed: loaded.match.seed,
      matchStatus: loaded.match.status,
      roomType: 'ranked' as const,
    };
  }

  return {
    status: accepts.localAccepted && accepts.opponentAccepted
      ? ('both_accepted' as const)
      : accepts.localAccepted
        ? ('awaiting_acceptance' as const)
        : ('match_found' as const),
    matchId,
    opponent: opponentPayload,
    acceptanceExpiresAt: accepts.acceptanceExpiresAt,
    localAccepted: accepts.localAccepted,
    opponentAccepted: accepts.opponentAccepted,
    roomType: 'ranked' as const,
  };
}

function queuedPayload(
  queue: RankedQueueRow,
  profile: Record<string, unknown> | null,
  season: { id: string; name: string; ends_at: string } | null,
) {
  const elapsed = elapsedSeconds(queue.queued_at);
  const range = matchmakingRangeForElapsed(elapsed);
  return {
    status: 'queued' as const,
    queueId: queue.id,
    queuedAt: queue.queued_at,
    expiresAt: queue.expires_at,
    elapsedSeconds: elapsed,
    region: queue.region,
    ratingRange: range,
    ratingRangeLabel:
      range === null ? 'ANY ELIGIBLE RATING' : `±${range} RATING`,
    season,
    rankedProfile: profile,
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

    if (action === 'get_profile') {
      const season = await loadActiveSeason(admin);
      if (!season) {
        return jsonResponse({
          status: 'failed',
          error: 'No active ranked season.',
        }, 404);
      }
      const ranking = await ensureRanking(admin, userId, season.id);
      if (!ranking) {
        return jsonResponse({
          status: 'failed',
          error: 'Unable to load ranked profile.',
        }, 500);
      }
      return jsonResponse({
        status: 'ok',
        season,
        rankedProfile: publicRankedProfile(season, ranking),
      });
    }

    if (action === 'get_leaderboard') {
      const season = await loadActiveSeason(admin);
      if (!season) {
        return jsonResponse({
          status: 'failed',
          error: 'No active ranked season.',
        }, 404);
      }
      const limit =
        typeof body.limit === 'number' && body.limit > 0
          ? Math.min(100, Math.floor(body.limit))
          : 100;
      const { data, error } = await admin
        .from('ranked_season_leaderboard')
        .select('*')
        .eq('season_id', season.id)
        .order('rank', { ascending: true })
        .limit(limit);
      if (error) {
        return jsonResponse({
          status: 'failed',
          error: 'Unable to load leaderboard.',
        }, 500);
      }
      return jsonResponse({
        status: 'ok',
        season,
        rows: data ?? [],
      });
    }

    if (action === 'get_history') {
      const limit =
        typeof body.limit === 'number' && body.limit > 0
          ? Math.min(50, Math.floor(body.limit))
          : 20;
      const { data, error } = await admin
        .from('ranked_match_results')
        .select('*')
        .or(`player_one_user_id.eq.${userId},player_two_user_id.eq.${userId}`)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) {
        return jsonResponse({
          status: 'failed',
          error: 'Unable to load ranked history.',
        }, 500);
      }

      const rows = data ?? [];
      const opponentIds = new Set<string>();
      for (const row of rows) {
        const p1 = String(row.player_one_user_id);
        const p2 = String(row.player_two_user_id);
        opponentIds.add(p1 === userId ? p2 : p1);
      }

      const { data: profiles } = await admin
        .from('profiles')
        .select('id, display_name')
        .in('id', [...opponentIds]);

      const nameById = new Map<string, string>();
      for (const profile of profiles ?? []) {
        nameById.set(String(profile.id), String(profile.display_name));
      }

      const season = await loadActiveSeason(admin);
      const history = [];
      for (const row of rows) {
        const isP1 = String(row.player_one_user_id) === userId;
        const opponentId = isP1
          ? String(row.player_two_user_id)
          : String(row.player_one_user_id);
        const ratingBefore = isP1
          ? Number(row.player_one_rating_before)
          : Number(row.player_two_rating_before);
        const ratingAfter = isP1
          ? Number(row.player_one_rating_after)
          : Number(row.player_two_rating_after);
        const ratingChange = isP1
          ? Number(row.player_one_rating_change)
          : Number(row.player_two_rating_change);
        const localScore = isP1
          ? Number(row.player_one_verified_score)
          : Number(row.player_two_verified_score);
        const opponentScore = isP1
          ? Number(row.player_two_verified_score)
          : Number(row.player_one_verified_score);

        let result = 'draw';
        const resultType = String(row.result_type);
        if (resultType === 'no_contest') {
          result = 'no_contest';
        } else if (
          (resultType === 'player_one_win' && isP1) ||
          (resultType === 'player_two_win' && !isP1) ||
          (resultType === 'player_one_forfeit' && isP1) ||
          (resultType === 'player_two_forfeit' && !isP1)
        ) {
          result = resultType.includes('forfeit') ? 'forfeit_win' : 'win';
        } else if (
          (resultType === 'player_one_win' && !isP1) ||
          (resultType === 'player_two_win' && isP1) ||
          (resultType === 'player_one_forfeit' && !isP1) ||
          (resultType === 'player_two_forfeit' && isP1)
        ) {
          result = resultType.includes('forfeit') ? 'forfeit_loss' : 'loss';
        }

        let opponentDivision = 'unranked';
        if (season) {
          const visible = await loadVisibleOpponentRanked(
            admin,
            opponentId,
            String(row.season_id),
          );
          opponentDivision = visible.division;
        }

        const viewerRanking = await ensureRanking(
          admin,
          userId,
          String(row.season_id),
        );
        const revealRatings =
          (viewerRanking?.placement_matches_completed ?? 0) >=
          PLACEMENT_MATCHES_REQUIRED;

        history.push({
          matchId: String(row.match_id),
          result,
          resultType,
          ratingBefore: revealRatings ? ratingBefore : null,
          ratingAfter: revealRatings ? ratingAfter : null,
          ratingChange: revealRatings ? ratingChange : null,
          opponentName: nameById.get(opponentId) ?? 'Opponent',
          opponentDivision,
          localScore,
          opponentScore,
          completedAt: String(row.created_at),
          forfeit: resultType.includes('forfeit'),
        });
      }

      return jsonResponse({ status: 'ok', history });
    }

    if (action === 'join') {
      const rulesVersion =
        typeof body.gameRulesVersion === 'string' ? body.gameRulesVersion : '';
      if (!SUPPORTED_GAME_RULES_VERSIONS.has(rulesVersion)) {
        return jsonResponse({
          status: 'failed',
          error: 'Unsupported game rules version.',
        }, 400);
      }

      const season = await loadActiveSeason(admin);
      if (!season) {
        return jsonResponse({
          status: 'failed',
          error: 'No active ranked season.',
        }, 404);
      }

      const { data: profileRow } = await admin
        .from('profiles')
        .select('ranked_suspended_until')
        .eq('id', userId)
        .maybeSingle();
      if (
        profileRow?.ranked_suspended_until &&
        Date.parse(String(profileRow.ranked_suspended_until)) > Date.now()
      ) {
        return jsonResponse({
          status: 'failed',
          error: 'Ranked play is temporarily unavailable for this account.',
        }, 403);
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

      // Active casual queue blocks ranked join (shared unique active queue).
      const existingAny = await loadActiveQueue(admin, userId);
      if (existingAny && existingAny.mode === 'casual') {
        return jsonResponse({
          status: 'failed',
          error: 'Leave Casual Quick Match before joining Ranked.',
        }, 409);
      }

      let queue = asRankedQueue(existingAny);
      const ranking = await ensureRanking(admin, userId, season.id);
      if (!ranking) {
        return jsonResponse({
          status: 'failed',
          error: 'Unable to prepare ranked profile.',
        }, 500);
      }
      const rankedProfile = publicRankedProfile(season, ranking);
      const placementStatus =
        ranking.placement_matches_completed < PLACEMENT_MATCHES_REQUIRED
          ? 'placement'
          : 'ranked';

      if (queue?.status === 'matched' && queue.match_id) {
        const timedOut = await handleAcceptanceTimeouts(admin, userId);
        if (timedOut) {
          queue = timedOut;
        } else {
          return jsonResponse({
            ...(await matchFoundPayload(admin, queue.match_id, userId, season.id)),
            season,
            rankedProfile,
          });
        }
      }

      if (queue?.status === 'accepted' && queue.match_id) {
        return jsonResponse({
          ...(await matchFoundPayload(admin, queue.match_id, userId, season.id)),
          season,
          rankedProfile,
        });
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

      if (!queue || queue.status !== 'queued' || queue.mode !== 'ranked') {
        const now = new Date();
        const { data: created, error } = await admin
          .from('matchmaking_queue')
          .insert({
            user_id: userId,
            mode: 'ranked',
            status: 'queued',
            region,
            game_rules_version: rulesVersion,
            expires_at: new Date(now.getTime() + QUEUE_TTL_MS).toISOString(),
            last_check_at: now.toISOString(),
            season_id: season.id,
            rating_snapshot: ranking.rating,
            placement_status: placementStatus,
            rating_range_at_join: 100,
          })
          .select('*')
          .single();

        if (error || !created) {
          queue = asRankedQueue(await loadActiveQueue(admin, userId));
          if (!queue || queue.status !== 'queued' || queue.mode !== 'ranked') {
            return jsonResponse({
              status: 'failed',
              error: 'Unable to join ranked queue.',
            }, 500);
          }
        } else {
          queue = created as RankedQueueRow;
        }
      }

      const { data: matchedId } = await admin.rpc('try_create_ranked_match', {
        requesting_user_id: userId,
        requesting_region: region,
        requesting_game_rules_version: rulesVersion,
      });

      if (typeof matchedId === 'string' && matchedId.length > 0) {
        return jsonResponse({
          ...(await matchFoundPayload(admin, matchedId, userId, season.id)),
          season,
          rankedProfile,
        });
      }

      const fresh = asRankedQueue(await loadActiveQueue(admin, userId));
      if (fresh?.status === 'matched' && fresh.match_id) {
        return jsonResponse({
          ...(await matchFoundPayload(admin, fresh.match_id, userId, season.id)),
          season,
          rankedProfile,
        });
      }

      const active = fresh && fresh.status === 'queued' ? fresh : queue;
      return jsonResponse(
        queuedPayload(active, rankedProfile, {
          id: season.id,
          name: season.name,
          ends_at: season.ends_at,
        }),
      );
    }

    if (action === 'poll') {
      let queue = asRankedQueue(await loadActiveQueue(admin, userId));
      if (!queue || queue.mode !== 'ranked') {
        return jsonResponse({ status: 'expired' });
      }

      await admin
        .from('matchmaking_queue')
        .update({ last_check_at: new Date().toISOString() })
        .eq('id', queue.id);

      const season = queue.season_id
        ? await loadActiveSeason(admin)
        : await loadActiveSeason(admin);
      const ranking = season
        ? await ensureRanking(admin, userId, season.id)
        : null;
      const rankedProfile =
        season && ranking ? publicRankedProfile(season, ranking) : null;

      if (queue.status === 'matched' && queue.match_id) {
        const requeued = await handleAcceptanceTimeouts(admin, userId);
        if (requeued) {
          queue = requeued;
        } else {
          return jsonResponse({
            ...(await matchFoundPayload(
              admin,
              queue.match_id,
              userId,
              season?.id ?? null,
            )),
            season,
            rankedProfile,
          });
        }
      }

      if (queue.status === 'accepted' && queue.match_id) {
        return jsonResponse({
          ...(await matchFoundPayload(
            admin,
            queue.match_id,
            userId,
            season?.id ?? null,
          )),
          season,
          rankedProfile,
        });
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

        const { data: matchedId } = await admin.rpc('try_create_ranked_match', {
          requesting_user_id: userId,
          requesting_region: queue.region ?? 'unknown',
          requesting_game_rules_version: queue.game_rules_version,
        });

        if (typeof matchedId === 'string' && matchedId.length > 0) {
          return jsonResponse({
            ...(await matchFoundPayload(
              admin,
              matchedId,
              userId,
              season?.id ?? null,
            )),
            season,
            rankedProfile,
          });
        }

        const refreshed = asRankedQueue(await loadActiveQueue(admin, userId));
        if (refreshed?.status === 'matched' && refreshed.match_id) {
          return jsonResponse({
            ...(await matchFoundPayload(
              admin,
              refreshed.match_id,
              userId,
              season?.id ?? null,
            )),
            season,
            rankedProfile,
          });
        }

        return jsonResponse(
          queuedPayload(
            queue,
            rankedProfile,
            season
              ? { id: season.id, name: season.name, ends_at: season.ends_at }
              : null,
          ),
        );
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
      if (loaded.match.mode !== 'ranked') {
        return errorResponse('Not a ranked match.', 400);
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
      const season = await loadActiveSeason(admin);

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

        const payload = await matchFoundPayload(
          admin,
          matchId,
          userId,
          season?.id ?? null,
        );
        return jsonResponse({
          ...payload,
          status: 'both_accepted',
          matchId,
          startsAt: startsAt.toISOString(),
          endsAt: endsAt.toISOString(),
          seed: loaded.match.seed,
          localAccepted: true,
          opponentAccepted: true,
          acceptanceExpiresAt: accepts.acceptanceExpiresAt,
          roomType: 'ranked',
        });
      }

      const awaiting = await matchFoundPayload(
        admin,
        matchId,
        userId,
        season?.id ?? null,
      );
      return jsonResponse({
        ...awaiting,
        status: 'awaiting_acceptance',
        localAccepted: true,
        roomType: 'ranked',
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
            .select(
              'region, game_rules_version, season_id, rating_snapshot, placement_status',
            )
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
            (prior?.season_id as string | undefined) ?? '',
            typeof prior?.rating_snapshot === 'number' ? prior.rating_snapshot : 1200,
            typeof prior?.placement_status === 'string'
              ? prior.placement_status
              : 'placement',
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
      const queue = asRankedQueue(await loadActiveQueue(admin, userId));
      if (!queue || queue.mode !== 'ranked') {
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
      const queue = asRankedQueue(await loadActiveQueue(admin, userId));
      const season = await loadActiveSeason(admin);
      const ranking = season
        ? await ensureRanking(admin, userId, season.id)
        : null;
      const rankedProfile =
        season && ranking ? publicRankedProfile(season, ranking) : null;

      if (queue?.mode === 'ranked' && queue.status === 'matched' && queue.match_id) {
        const requeued = await handleAcceptanceTimeouts(admin, userId);
        if (requeued) {
          return jsonResponse(
            queuedPayload(
              requeued,
              rankedProfile,
              season
                ? { id: season.id, name: season.name, ends_at: season.ends_at }
                : null,
            ),
          );
        }
        return jsonResponse({
          ...(await matchFoundPayload(
            admin,
            queue.match_id,
            userId,
            season?.id ?? null,
          )),
          season,
          rankedProfile,
        });
      }

      if (queue?.mode === 'ranked' && queue.status === 'accepted' && queue.match_id) {
        return jsonResponse({
          ...(await matchFoundPayload(
            admin,
            queue.match_id,
            userId,
            season?.id ?? null,
          )),
          season,
          rankedProfile,
        });
      }

      if (queue?.mode === 'ranked' && queue.status === 'queued') {
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
        return jsonResponse(
          queuedPayload(
            queue,
            rankedProfile,
            season
              ? { id: season.id, name: season.name, ends_at: season.ends_at }
              : null,
          ),
        );
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
          roomType: loaded?.match.mode ?? 'ranked',
          season,
          rankedProfile,
        });
      }

      return jsonResponse({
        status: 'cancelled',
        idle: true,
        season,
        rankedProfile,
      });
    }

    return errorResponse('Unknown action.', 400);
  } catch {
    return errorResponse('Unexpected server error.', 500);
  }
});
