-- Version 1.5 Phase 2 — Live PvP playable hub, notifications, ops status
-- Forward-only. Does not alter Phase 1 table shapes beyond notification linkage.

-- ---------------------------------------------------------------------------
-- Notifications: allow Live Match types + match_id (duel_id stays Async-only FK)
-- ---------------------------------------------------------------------------
ALTER TABLE public.player_notifications
  DROP CONSTRAINT IF EXISTS player_notifications_notification_type_check;

ALTER TABLE public.player_notifications
  ADD CONSTRAINT player_notifications_notification_type_check
  CHECK (notification_type IN (
    'DUEL_CHALLENGE_RECEIVED',
    'DUEL_COMPLETED',
    'DUEL_DECLINED',
    'DUEL_EXPIRED',
    'LIVE_MATCH_INVITE_RECEIVED',
    'LIVE_MATCH_RESULT_READY',
    'LIVE_MATCH_CANCELLED'
  ));

ALTER TABLE public.player_notifications
  ADD COLUMN IF NOT EXISTS match_id uuid REFERENCES public.live_pvp_matches(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS player_notifications_match_id_idx
  ON public.player_notifications (match_id)
  WHERE match_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Ops status (kill switch surface)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_live_pvp_ops_status()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  RETURN jsonb_build_object(
    'creationEnabled', public.live_pvp_creation_enabled(),
    'configActive', COALESCE((public.live_pvp_config()->>'enabled')::boolean, true),
    'protocolVersion', COALESCE(public.live_pvp_config()->>'protocolVersion', '1')
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_live_pvp_ops_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_live_pvp_ops_status() TO authenticated;

-- ---------------------------------------------------------------------------
-- Hub read model
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_live_pvp_hub(
  p_section text DEFAULT 'incoming',
  p_limit integer DEFAULT 20,
  p_offset integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  safe_limit integer := LEAST(GREATEST(COALESCE(p_limit, 20), 1), 50);
  safe_offset integer := GREATEST(COALESCE(p_offset, 0), 0);
  section text := lower(COALESCE(p_section, 'incoming'));
  items jsonb := '[]'::jsonb;
  attention integer := 0;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  PERFORM public.finalize_live_pvp_deadlines(10);

  SELECT count(*)::integer INTO attention
  FROM public.live_pvp_matches m
  WHERE (
      (m.opponent_id = v_user AND m.status = 'invited' AND m.expires_at > now())
      OR (
        (m.challenger_id = v_user OR m.opponent_id = v_user)
        AND m.status IN ('lobby', 'countdown', 'active', 'settling')
      )
    );

  IF section = 'incoming' THEN
    SELECT COALESCE(jsonb_agg(row_to_json(x)::jsonb ORDER BY x."createdAt" DESC), '[]'::jsonb)
    INTO items
    FROM (
      SELECT
        m.id AS "matchId",
        m.status,
        CASE WHEN m.challenger_id = v_user THEN 'challenger' ELSE 'opponent' END AS "participantRole",
        public.live_pvp_public_participant(
          CASE WHEN m.challenger_id = v_user THEN m.opponent_id ELSE m.challenger_id END
        ) AS opponent,
        m.expires_at AS "expiresAt",
        m.scheduled_start_at AS "scheduledStartAt",
        m.gameplay_deadline_at AS "gameplayDeadlineAt",
        (SELECT ready_at IS NOT NULL FROM public.live_pvp_participants p
          WHERE p.match_id = m.id AND p.user_id = v_user) AS "youReady",
        (SELECT ready_at IS NOT NULL FROM public.live_pvp_participants p
          WHERE p.match_id = m.id AND p.user_id <> v_user) AS "opponentReady",
        m.outcome,
        m.winner_user_id AS "winnerUserId",
        m.completion_reason AS "completionReason",
        m.created_at AS "createdAt",
        m.updated_at AS "updatedAt",
        m.state_version AS "stateVersion"
      FROM public.live_pvp_matches m
      WHERE m.opponent_id = v_user
        AND m.status = 'invited'
        AND m.expires_at > now()
      ORDER BY m.created_at DESC
      LIMIT safe_limit OFFSET safe_offset
    ) x;
  ELSIF section = 'active' THEN
    SELECT COALESCE(jsonb_agg(row_to_json(x)::jsonb ORDER BY x."updatedAt" DESC), '[]'::jsonb)
    INTO items
    FROM (
      SELECT
        m.id AS "matchId",
        m.status,
        CASE WHEN m.challenger_id = v_user THEN 'challenger' ELSE 'opponent' END AS "participantRole",
        public.live_pvp_public_participant(
          CASE WHEN m.challenger_id = v_user THEN m.opponent_id ELSE m.challenger_id END
        ) AS opponent,
        m.expires_at AS "expiresAt",
        m.scheduled_start_at AS "scheduledStartAt",
        m.gameplay_deadline_at AS "gameplayDeadlineAt",
        (SELECT ready_at IS NOT NULL FROM public.live_pvp_participants p
          WHERE p.match_id = m.id AND p.user_id = v_user) AS "youReady",
        (SELECT ready_at IS NOT NULL FROM public.live_pvp_participants p
          WHERE p.match_id = m.id AND p.user_id <> v_user) AS "opponentReady",
        m.outcome,
        m.winner_user_id AS "winnerUserId",
        m.completion_reason AS "completionReason",
        m.created_at AS "createdAt",
        m.updated_at AS "updatedAt",
        m.state_version AS "stateVersion"
      FROM public.live_pvp_matches m
      WHERE (m.challenger_id = v_user OR m.opponent_id = v_user)
        AND m.status IN ('invited', 'lobby', 'countdown', 'active', 'settling')
      ORDER BY m.updated_at DESC
      LIMIT safe_limit OFFSET safe_offset
    ) x;
  ELSE
    -- recent (terminal)
    SELECT COALESCE(jsonb_agg(row_to_json(x)::jsonb ORDER BY x."updatedAt" DESC), '[]'::jsonb)
    INTO items
    FROM (
      SELECT
        m.id AS "matchId",
        m.status,
        CASE WHEN m.challenger_id = v_user THEN 'challenger' ELSE 'opponent' END AS "participantRole",
        public.live_pvp_public_participant(
          CASE WHEN m.challenger_id = v_user THEN m.opponent_id ELSE m.challenger_id END
        ) AS opponent,
        m.expires_at AS "expiresAt",
        m.scheduled_start_at AS "scheduledStartAt",
        m.gameplay_deadline_at AS "gameplayDeadlineAt",
        false AS "youReady",
        false AS "opponentReady",
        m.outcome,
        m.winner_user_id AS "winnerUserId",
        m.completion_reason AS "completionReason",
        m.created_at AS "createdAt",
        m.updated_at AS "updatedAt",
        m.state_version AS "stateVersion"
      FROM public.live_pvp_matches m
      WHERE (m.challenger_id = v_user OR m.opponent_id = v_user)
        AND m.status IN ('completed', 'declined', 'cancelled', 'expired', 'invalid')
      ORDER BY m.updated_at DESC
      LIMIT safe_limit OFFSET safe_offset
    ) x;
  END IF;

  RETURN jsonb_build_object(
    'section', section,
    'items', items,
    'attentionCount', attention,
    'limit', safe_limit,
    'offset', safe_offset,
    'serverNow', now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_live_pvp_hub(text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_live_pvp_hub(text, integer, integer) TO authenticated;

-- ---------------------------------------------------------------------------
-- Extend enqueue to support match_id + live notification types
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enqueue_player_notification(
  p_user_id uuid,
  p_type text,
  p_duel_id uuid,
  p_dedupe_key text,
  p_title_key text,
  p_body_data jsonb,
  p_deep_link_data jsonb,
  p_push_eligible boolean DEFAULT true,
  p_match_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  prefs public.notification_preferences%ROWTYPE;
  notif_id uuid;
  allow_in_app boolean := true;
  allow_push boolean := true;
  push_ok boolean;
BEGIN
  prefs := public.ensure_notification_preferences(p_user_id);

  IF p_type IN ('DUEL_CHALLENGE_RECEIVED', 'LIVE_MATCH_INVITE_RECEIVED') THEN
    allow_in_app := prefs.duel_challenges_in_app;
    allow_push := prefs.duel_challenges_push;
  ELSIF p_type IN ('DUEL_COMPLETED', 'LIVE_MATCH_RESULT_READY') THEN
    allow_in_app := prefs.duel_results_in_app;
    allow_push := prefs.duel_results_push;
  ELSE
    allow_in_app := prefs.duel_status_in_app;
    allow_push := prefs.duel_status_push;
  END IF;

  IF NOT allow_in_app THEN
    RETURN NULL;
  END IF;

  push_ok :=
    p_push_eligible
    AND allow_push
    AND p_type NOT IN ('DUEL_EXPIRED')
    AND public.async_duel_push_enabled();

  INSERT INTO public.player_notifications (
    user_id, notification_type, duel_id, match_id, dedupe_key, title_key, body_data,
    deep_link_data, push_eligible, push_status
  )
  VALUES (
    p_user_id, p_type, p_duel_id, p_match_id, p_dedupe_key, p_title_key,
    COALESCE(p_body_data, '{}'::jsonb), p_deep_link_data, push_ok,
    CASE WHEN push_ok THEN 'pending' ELSE 'suppressed' END
  )
  ON CONFLICT (user_id, dedupe_key) DO NOTHING
  RETURNING id INTO notif_id;

  IF notif_id IS NULL THEN
    SELECT id INTO notif_id
    FROM public.player_notifications
    WHERE user_id = p_user_id AND dedupe_key = p_dedupe_key;
    RETURN notif_id;
  END IF;

  IF push_ok THEN
    INSERT INTO public.notification_push_outbox (notification_id, user_id, status)
    VALUES (notif_id, p_user_id, 'pending')
    ON CONFLICT (notification_id) DO NOTHING;
  END IF;

  RETURN notif_id;
END;
$$;

-- Include matchId in notification list payload
CREATE OR REPLACE FUNCTION public.get_player_notifications(
  p_limit integer DEFAULT 20,
  p_offset integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  safe_limit integer := LEAST(GREATEST(COALESCE(p_limit, 20), 1), 50);
  safe_offset integer := GREATEST(COALESCE(p_offset, 0), 0);
  items jsonb;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', n.id,
    'notificationType', n.notification_type,
    'duelId', n.duel_id,
    'matchId', n.match_id,
    'titleKey', n.title_key,
    'bodyData', n.body_data,
    'deepLinkData', n.deep_link_data,
    'readAt', n.read_at,
    'createdAt', n.created_at
  ) ORDER BY n.created_at DESC), '[]'::jsonb)
  INTO items
  FROM (
    SELECT *
    FROM public.player_notifications
    WHERE user_id = v_user
    ORDER BY created_at DESC
    LIMIT safe_limit
    OFFSET safe_offset
  ) n;

  RETURN jsonb_build_object('items', items, 'limit', safe_limit, 'offset', safe_offset);
END;
$$;

-- ---------------------------------------------------------------------------
-- Patch create invite to notify opponent
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_live_pvp_invite(p_opponent_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  cfg jsonb;
  invite_seconds integer;
  pending_count integer;
  pair_count integer;
  match public.live_pvp_matches%ROWTYPE;
  topic text;
  new_id uuid;
  challenger_name text;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF NOT public.live_pvp_creation_enabled() THEN
    RAISE EXCEPTION 'LIVE_PVP_DISABLED' USING ERRCODE = 'P0001';
  END IF;
  IF p_opponent_id IS NULL OR p_opponent_id = v_user THEN
    RAISE EXCEPTION 'SELF_INVITE' USING ERRCODE = 'P0001';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_opponent_id) THEN
    RAISE EXCEPTION 'PLAYER_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_opponent_id) THEN
    RAISE EXCEPTION 'PLAYER_NOT_ELIGIBLE' USING ERRCODE = 'P0001';
  END IF;

  PERFORM public.finalize_live_pvp_deadlines(20);

  cfg := public.live_pvp_config();
  invite_seconds := COALESCE((cfg->>'invitationLifetimeSeconds')::integer, 300);

  IF EXISTS (
    SELECT 1 FROM public.live_pvp_participants WHERE user_id = v_user AND active_slot = true
  ) THEN
    RAISE EXCEPTION 'ACTIVE_MATCH_LIMIT' USING ERRCODE = 'P0001';
  END IF;

  SELECT count(*) INTO pending_count
  FROM public.live_pvp_matches
  WHERE challenger_id = v_user AND status = 'invited';
  IF pending_count >= COALESCE((cfg->>'maximumPendingInvitesPerPlayer')::integer, 3) THEN
    RAISE EXCEPTION 'INVITE_LIMIT' USING ERRCODE = 'P0001';
  END IF;

  SELECT count(*) INTO pair_count
  FROM public.live_pvp_matches
  WHERE status IN ('invited', 'lobby', 'countdown', 'active', 'settling')
    AND (
      (challenger_id = v_user AND opponent_id = p_opponent_id)
      OR (challenger_id = p_opponent_id AND opponent_id = v_user)
    );
  IF pair_count >= COALESCE((cfg->>'maximumPendingInvitesBetweenPlayers')::integer, 1) THEN
    RAISE EXCEPTION 'DUPLICATE_INVITE' USING ERRCODE = 'P0001';
  END IF;

  new_id := gen_random_uuid();
  topic := 'live-pvp:' || new_id::text;

  INSERT INTO public.live_pvp_matches (
    id, challenger_id, opponent_id, realtime_topic, status, protocol_version, expires_at, state_version
  )
  VALUES (
    new_id, v_user, p_opponent_id, topic,
    'invited', COALESCE(cfg->>'protocolVersion', '1'),
    now() + make_interval(secs => invite_seconds), 1
  )
  RETURNING * INTO match;

  INSERT INTO public.live_pvp_participants (match_id, user_id, participant_role, active_slot)
  VALUES
    (match.id, v_user, 'challenger', true),
    (match.id, p_opponent_id, 'opponent', false);

  SELECT COALESCE(display_name::text, 'Blaze Player') INTO challenger_name
  FROM public.profiles WHERE id = v_user;

  PERFORM public.live_pvp_record_and_broadcast(
    match, 'invite_created', jsonb_build_object('challengerId', v_user)
  );

  PERFORM public.enqueue_player_notification(
    p_opponent_id,
    'LIVE_MATCH_INVITE_RECEIVED',
    NULL,
    'live_match_invite:' || match.id::text || ':' || p_opponent_id::text,
    'LIVE_CHALLENGE',
    jsonb_build_object(
      'opponentDisplayName', challenger_name,
      'matchId', match.id
    ),
    jsonb_build_object('screen', 'LivePvpInviteDetails', 'matchId', match.id),
    true,
    match.id
  );

  RETURN jsonb_build_object(
    'matchId', match.id,
    'status', match.status,
    'realtimeTopic', match.realtime_topic,
    'protocolVersion', match.protocol_version,
    'stateVersion', match.state_version,
    'expiresAt', match.expires_at,
    'participantRole', 'challenger',
    'opponent', public.live_pvp_public_participant(p_opponent_id),
    'serverNow', now()
  );
END;
$$;

-- Notify both participants on settlement
CREATE OR REPLACE FUNCTION public.live_pvp_settle_match(p_match_id uuid)
RETURNS public.live_pvp_matches
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  match public.live_pvp_matches%ROWTYPE;
  ca public.live_pvp_attempts%ROWTYPE;
  oa public.live_pvp_attempts%ROWTYPE;
  comparison jsonb;
  outcome_text text;
  deciding text;
  winner uuid;
  reason text := 'normal';
  challenger_name text;
  opponent_name text;
BEGIN
  SELECT * INTO match FROM public.live_pvp_matches WHERE id = p_match_id FOR UPDATE;
  IF NOT FOUND THEN RETURN match; END IF;
  IF match.status = 'completed' AND match.settled_at IS NOT NULL THEN
    RETURN match;
  END IF;

  SELECT * INTO ca FROM public.live_pvp_attempts
  WHERE match_id = match.id AND participant_role = 'challenger' FOR UPDATE;
  SELECT * INTO oa FROM public.live_pvp_attempts
  WHERE match_id = match.id AND participant_role = 'opponent' FOR UPDATE;

  IF ca.status = 'completed' AND oa.status = 'completed' THEN
    comparison := public.compare_async_duel_results(
      ca.score, ca.exact_21_count, ca.five_card_clear_count, ca.bust_count, ca.completion_ms,
      oa.score, oa.exact_21_count, oa.five_card_clear_count, oa.bust_count, oa.completion_ms
    );
    outcome_text := comparison->>'outcome';
    deciding := comparison->>'decidingField';
    winner := CASE outcome_text
      WHEN 'challenger_win' THEN match.challenger_id
      WHEN 'opponent_win' THEN match.opponent_id
      ELSE NULL
    END;
    reason := 'normal';
  ELSIF ca.status = 'completed' AND oa.status IN ('forfeited', 'timed_out') THEN
    outcome_text := 'challenger_win'; winner := match.challenger_id; deciding := 'forfeit';
    reason := CASE WHEN oa.status = 'forfeited' THEN 'forfeit' ELSE 'timeout' END;
  ELSIF oa.status = 'completed' AND ca.status IN ('forfeited', 'timed_out') THEN
    outcome_text := 'opponent_win'; winner := match.opponent_id; deciding := 'forfeit';
    reason := CASE WHEN ca.status = 'forfeited' THEN 'forfeit' ELSE 'timeout' END;
  ELSIF ca.status IN ('forfeited', 'timed_out') AND oa.status IN ('forfeited', 'timed_out') THEN
    outcome_text := 'no_contest'; winner := NULL; deciding := NULL; reason := 'timeout';
  ELSE
    RETURN match;
  END IF;

  IF match.status NOT IN ('settling', 'completed') THEN
    IF match.status IN ('countdown', 'active') THEN
      PERFORM public.assert_live_pvp_transition(match.status, 'settling');
      UPDATE public.live_pvp_matches
      SET status = 'settling', state_version = state_version + 1, updated_at = now()
      WHERE id = match.id RETURNING * INTO match;
    END IF;
  END IF;

  PERFORM public.assert_live_pvp_transition(match.status, 'completed');

  UPDATE public.live_pvp_matches
  SET status = 'completed',
      outcome = outcome_text,
      winner_user_id = winner,
      deciding_field = deciding,
      completion_reason = reason,
      completed_at = COALESCE(completed_at, now()),
      settled_at = now(),
      state_version = state_version + 1,
      updated_at = now()
  WHERE id = match.id
  RETURNING * INTO match;

  UPDATE public.live_pvp_participants
  SET active_slot = false, updated_at = now()
  WHERE match_id = match.id;

  PERFORM public.live_pvp_record_and_broadcast(
    match,
    'match_settled',
    jsonb_build_object(
      'outcome', match.outcome,
      'winnerUserId', match.winner_user_id,
      'decidingField', match.deciding_field,
      'completionReason', match.completion_reason
    )
  );

  SELECT COALESCE(display_name::text, 'Blaze Player') INTO challenger_name
  FROM public.profiles WHERE id = match.challenger_id;
  SELECT COALESCE(display_name::text, 'Blaze Player') INTO opponent_name
  FROM public.profiles WHERE id = match.opponent_id;

  PERFORM public.enqueue_player_notification(
    match.challenger_id,
    'LIVE_MATCH_RESULT_READY',
    NULL,
    'live_match_result:' || match.id::text || ':' || match.challenger_id::text,
    'LIVE_RESULT',
    jsonb_build_object('opponentDisplayName', opponent_name, 'outcome', match.outcome, 'matchId', match.id),
    jsonb_build_object('screen', 'LivePvpResult', 'matchId', match.id),
    true,
    match.id
  );
  PERFORM public.enqueue_player_notification(
    match.opponent_id,
    'LIVE_MATCH_RESULT_READY',
    NULL,
    'live_match_result:' || match.id::text || ':' || match.opponent_id::text,
    'LIVE_RESULT',
    jsonb_build_object('opponentDisplayName', challenger_name, 'outcome', match.outcome, 'matchId', match.id),
    jsonb_build_object('screen', 'LivePvpResult', 'matchId', match.id),
    true,
    match.id
  );

  -- No XP / Blaze Coins / public Live PvP records in Phase 2.
  RETURN match;
END;
$$;

COMMENT ON FUNCTION public.get_live_pvp_hub IS
  'v1.5 Phase 2 participant-safe hub sections: incoming | active | recent.';
