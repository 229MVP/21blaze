import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

import { parseJsonBody, requireAuthedUser } from '../_shared/auth.ts';
import { corsHeaders, errorResponse, jsonResponse } from '../_shared/cors.ts';
import { nextUtcMidnightIso } from '../_shared/progression.ts';

type DailyMissionsAction = 'list' | 'claim' | 'history';

type MissionTemplateRow = {
  id: string;
  name: string;
  description: string;
  mission_type: string;
  category: string;
  requires_live_duel: boolean;
  requires_ranked: boolean;
};

type PlayerMissionRow = {
  id: string;
  user_id: string;
  mission_template_id: string;
  mission_date: string;
  progress: number;
  target_value: number;
  completed_at: string | null;
  claimed_at: string | null;
  xp_reward: number;
  blaze_coin_reward: number;
  created_at: string;
};

function isAction(value: unknown): value is DailyMissionsAction {
  return value === 'list' || value === 'claim' || value === 'history';
}

function readFlag(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function mapMission(
  mission: PlayerMissionRow,
  template: MissionTemplateRow | undefined,
) {
  return {
    id: mission.id,
    templateId: mission.mission_template_id,
    name: template?.name ?? mission.mission_template_id,
    description: template?.description ?? '',
    category: template?.category ?? null,
    missionType: template?.mission_type ?? null,
    progress: mission.progress,
    targetValue: mission.target_value,
    xpReward: mission.xp_reward,
    blazeCoinReward: mission.blaze_coin_reward,
    completedAt: mission.completed_at,
    claimedAt: mission.claimed_at,
    isComplete: mission.completed_at !== null &&
      mission.progress >= mission.target_value,
    isClaimed: mission.claimed_at !== null,
    missionDate: mission.mission_date,
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

    const body = (await parseJsonBody(request)) ?? {};
    const action = body.action;
    if (!isAction(action)) {
      return errorResponse('action must be list, claim, or history.', 400);
    }

    const { admin, userId } = auth;

    if (action === 'list') {
      const allowLiveDuel = readFlag(
        body.allowLiveDuel ?? body.allow_live_duel,
        true,
      );
      const allowRanked = readFlag(
        body.allowRanked ?? body.allow_ranked,
        true,
      );

      const rpcArgs: {
        p_user_id: string;
        p_allow_live_duel: boolean;
        p_allow_ranked: boolean;
        p_mission_date?: string;
      } = {
        p_user_id: userId,
        p_allow_live_duel: allowLiveDuel,
        p_allow_ranked: allowRanked,
      };

      const { data: missionsRaw, error } = await admin.rpc(
        'assign_daily_missions_secure',
        rpcArgs,
      );

      if (error) {
        return errorResponse(
          error.message || 'Unable to assign daily missions.',
          400,
        );
      }

      const missions = (missionsRaw ?? []) as PlayerMissionRow[];
      const templateIds = Array.from(
        new Set(missions.map((mission) => mission.mission_template_id)),
      );

      let templatesById = new Map<string, MissionTemplateRow>();
      if (templateIds.length > 0) {
        const { data: templates } = await admin
          .from('mission_templates')
          .select(
            'id, name, description, mission_type, category, requires_live_duel, requires_ranked',
          )
          .in('id', templateIds);

        templatesById = new Map(
          ((templates ?? []) as MissionTemplateRow[]).map((row) => [row.id, row]),
        );
      }

      const mapped = missions.map((mission) =>
        mapMission(mission, templatesById.get(mission.mission_template_id))
      );

      return jsonResponse({
        ok: true,
        action: 'list',
        missions: mapped,
        resetAt: nextUtcMidnightIso(),
        claimableCount: mapped.filter((m) => m.isComplete && !m.isClaimed).length,
      });
    }

    if (action === 'claim') {
      const playerMissionId =
        typeof body.playerMissionId === 'string'
          ? body.playerMissionId
          : typeof body.missionId === 'string'
          ? body.missionId
          : '';

      if (!playerMissionId) {
        return errorResponse('playerMissionId is required.', 400);
      }

      const idempotencyKey =
        typeof body.idempotencyKey === 'string' && body.idempotencyKey.trim().length > 0
          ? body.idempotencyKey.trim()
          : null;

      const { data, error } = await admin.rpc('claim_daily_mission_secure', {
        p_user_id: userId,
        p_player_mission_id: playerMissionId,
        p_idempotency_key: idempotencyKey,
      });

      if (error) {
        const message = error.message || 'Unable to claim daily mission.';
        if (/not complete/i.test(message)) {
          return errorResponse('Mission is not complete.', 409);
        }
        if (/not found/i.test(message)) {
          return errorResponse('Mission not found.', 404);
        }
        if (/does not belong/i.test(message)) {
          return errorResponse('Mission ownership mismatch.', 403);
        }
        return errorResponse(message, 400);
      }

      return jsonResponse({
        ok: true,
        action: 'claim',
        result: data,
      });
    }

    // history — recently claimed missions
    const limitRaw = typeof body.limit === 'number' ? body.limit : 20;
    const limit = Math.min(50, Math.max(1, Math.trunc(limitRaw)));

    const { data: claimed, error: historyError } = await admin
      .from('player_daily_missions')
      .select(
        'id, mission_template_id, mission_date, progress, target_value, completed_at, claimed_at, xp_reward, blaze_coin_reward, created_at',
      )
      .eq('user_id', userId)
      .not('claimed_at', 'is', null)
      .order('claimed_at', { ascending: false })
      .limit(limit);

    if (historyError) {
      return errorResponse('Unable to load daily mission history.', 500);
    }

    const rows = (claimed ?? []) as PlayerMissionRow[];
    const templateIds = Array.from(
      new Set(rows.map((mission) => mission.mission_template_id)),
    );

    let templatesById = new Map<string, MissionTemplateRow>();
    if (templateIds.length > 0) {
      const { data: templates } = await admin
        .from('mission_templates')
        .select(
          'id, name, description, mission_type, category, requires_live_duel, requires_ranked',
        )
        .in('id', templateIds);

      templatesById = new Map(
        ((templates ?? []) as MissionTemplateRow[]).map((row) => [row.id, row]),
      );
    }

    return jsonResponse({
      ok: true,
      action: 'history',
      missions: rows.map((mission) =>
        mapMission(mission, templatesById.get(mission.mission_template_id))
      ),
    });
  } catch (_error) {
    return errorResponse('Internal server error.', 500);
  }
});
