-- Version 1.5 Phase 3 — Live PvP resilience, rematches, private records, privilege hardening
-- Forward-only. Safe after Phase 1 and Phase 2 Live PvP migrations.

-- ---------------------------------------------------------------------------
-- Rematch lineage
-- ---------------------------------------------------------------------------
ALTER TABLE public.live_pvp_matches
  ADD COLUMN IF NOT EXISTS rematch_of_match_id uuid REFERENCES public.live_pvp_matches (id);

CREATE UNIQUE INDEX IF NOT EXISTS live_pvp_matches_rematch_of_uidx
  ON public.live_pvp_matches (rematch_of_match_id)
  WHERE rematch_of_match_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Notifications: rematch invite type
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
    'LIVE_MATCH_CANCELLED',
    'LIVE_MATCH_REMATCH_INVITE_RECEIVED'
  ));

-- ---------------------------------------------------------------------------
-- Snapshot: caller-owned progress sequence for recovery
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_live_pvp_snapshot(p_match_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user uuid := auth.uid();
  match public.live_pvp_matches%ROWTYPE;
  role text;
  include_seed boolean;
  my_attempt public.live_pvp_attempts%ROWTYPE;
  ch_ready boolean;
  op_ready boolean;
  progress jsonb;
  my_latest_seq integer := 0;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT * INTO match FROM public.live_pvp_matches WHERE id = p_match_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'MATCH_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;
  IF match.challenger_id IS DISTINCT FROM v_user AND match.opponent_id IS DISTINCT FROM v_user THEN
    RAISE EXCEPTION 'NOT_PARTICIPANT' USING ERRCODE = 'P0001';
  END IF;

  role := CASE WHEN match.challenger_id = v_user THEN 'challenger' ELSE 'opponent' END;
  include_seed := match.status IN ('countdown', 'active', 'settling', 'completed')
    AND match.seed IS NOT NULL;

  SELECT ready_at IS NOT NULL INTO ch_ready
  FROM public.live_pvp_participants
  WHERE match_id = match.id AND participant_role = 'challenger';
  SELECT ready_at IS NOT NULL INTO op_ready
  FROM public.live_pvp_participants
  WHERE match_id = match.id AND participant_role = 'opponent';

  SELECT * INTO my_attempt FROM public.live_pvp_attempts
  WHERE match_id = match.id AND user_id = v_user;

  SELECT COALESCE(sequence, 0) INTO my_latest_seq
  FROM public.live_pvp_progress
  WHERE match_id = match.id AND user_id = v_user;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'userId', pr.user_id,
    'sequence', pr.sequence,
    'score', pr.score,
    'exact21Count', pr.exact_21_count,
    'fiveCardClearCount', pr.five_card_clear_count,
    'bustCount', pr.bust_count,
    'cardsPlayed', pr.cards_played,
    'lanesCleared', pr.lanes_cleared,
    'clientElapsedMs', pr.client_elapsed_ms,
    'serverReceivedAt', pr.server_received_at
  )), '[]'::jsonb)
  INTO progress
  FROM public.live_pvp_progress pr
  WHERE pr.match_id = match.id;

  RETURN jsonb_build_object(
    'matchId', match.id,
    'status', match.status,
    'stateVersion', match.state_version,
    'protocolVersion', match.protocol_version,
    'realtimeTopic', match.realtime_topic,
    'participantRole', role,
    'challenger', public.live_pvp_public_participant(match.challenger_id),
    'opponent', public.live_pvp_public_participant(match.opponent_id),
    'challengerReady', COALESCE(ch_ready, false),
    'opponentReady', COALESCE(op_ready, false),
    'scheduledStartAt', match.scheduled_start_at,
    'gameplayDeadlineAt', match.gameplay_deadline_at,
    'submissionGraceUntil', match.submission_grace_until,
    'expiresAt', match.expires_at,
    'rulesVersion', match.rules_version,
    'deckVersion', match.deck_version,
    'durationSeconds', match.duration_seconds,
    'bustLimit', match.bust_limit,
    'seed', CASE WHEN include_seed THEN match.seed ELSE NULL END,
    'seedAvailable', include_seed,
    'outcome', match.outcome,
    'winnerUserId', match.winner_user_id,
    'decidingField', match.deciding_field,
    'completionReason', match.completion_reason,
    'settledAt', match.settled_at,
    'myAttempt', CASE WHEN my_attempt.id IS NULL THEN NULL ELSE jsonb_build_object(
      'attemptId', my_attempt.id,
      'status', my_attempt.status,
      'score', my_attempt.score,
      'completedAt', my_attempt.completed_at
    ) END,
    'myLatestProgressSequence', my_latest_seq,
    'progress', progress,
    'serverNow', pg_catalog.now(),
    'gameplayEligible', (
      match.scheduled_start_at IS NOT NULL
      AND pg_catalog.now() >= match.scheduled_start_at
      AND match.status IN ('countdown', 'active', 'settling')
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_live_pvp_snapshot(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_live_pvp_snapshot(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- Rematch RPC (server-authoritative opponent, idempotent)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_live_pvp_rematch(p_source_match_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user uuid := auth.uid();
  source public.live_pvp_matches%ROWTYPE;
  existing public.live_pvp_matches%ROWTYPE;
  other_id uuid;
  cfg jsonb;
  match public.live_pvp_matches%ROWTYPE;
  topic text;
  new_id uuid;
  invite_seconds integer;
  pending_count integer;
  pair_count integer;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF NOT public.live_pvp_creation_enabled() THEN
    RAISE EXCEPTION 'LIVE_PVP_DISABLED' USING ERRCODE = 'P0001';
  END IF;

  PERFORM public.finalize_live_pvp_deadlines(10);

  SELECT * INTO source FROM public.live_pvp_matches WHERE id = p_source_match_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'MATCH_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;

  IF source.challenger_id IS DISTINCT FROM v_user AND source.opponent_id IS DISTINCT FROM v_user THEN
    RAISE EXCEPTION 'NOT_PARTICIPANT' USING ERRCODE = 'P0001';
  END IF;

  IF source.status <> 'completed' THEN
    RAISE EXCEPTION 'REMATCH_NOT_ELIGIBLE' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO existing FROM public.live_pvp_matches WHERE rematch_of_match_id = source.id;
  IF FOUND THEN
  RETURN jsonb_build_object(
    'matchId', existing.id,
    'status', existing.status,
    'realtimeTopic', existing.realtime_topic,
    'protocolVersion', existing.protocol_version,
    'stateVersion', existing.state_version,
    'expiresAt', existing.expires_at,
    'participantRole', CASE
      WHEN existing.challenger_id = v_user THEN 'challenger'
      WHEN existing.opponent_id = v_user THEN 'opponent'
      ELSE 'challenger'
    END,
    'opponent', public.live_pvp_public_participant(
      CASE WHEN existing.challenger_id = v_user THEN existing.opponent_id ELSE existing.challenger_id END
    ),
    'rematchOfMatchId', source.id,
    'alreadyExisted', true,
    'serverNow', pg_catalog.now()
  );
  END IF;

  other_id := CASE WHEN source.challenger_id = v_user THEN source.opponent_id ELSE source.challenger_id END;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = other_id) THEN
    RAISE EXCEPTION 'PLAYER_NOT_ELIGIBLE' USING ERRCODE = 'P0001';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = other_id) THEN
    RAISE EXCEPTION 'PLAYER_NOT_ELIGIBLE' USING ERRCODE = 'P0001';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.live_pvp_participants WHERE user_id = v_user AND active_slot = true
  ) THEN
    RAISE EXCEPTION 'ACTIVE_MATCH_LIMIT' USING ERRCODE = 'P0001';
  END IF;

  cfg := public.live_pvp_config();
  invite_seconds := COALESCE((cfg->>'invitationLifetimeSeconds')::integer, 300);

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
      (challenger_id = v_user AND opponent_id = other_id)
      OR (challenger_id = other_id AND opponent_id = v_user)
    );
  IF pair_count >= COALESCE((cfg->>'maximumPendingInvitesBetweenPlayers')::integer, 1) THEN
    RAISE EXCEPTION 'DUPLICATE_INVITE' USING ERRCODE = 'P0001';
  END IF;

  new_id := (SELECT extensions.gen_random_uuid());
  topic := 'live-pvp:' || new_id::text;

  BEGIN
    INSERT INTO public.live_pvp_matches (
      id, challenger_id, opponent_id, realtime_topic, status, protocol_version,
      expires_at, state_version, rematch_of_match_id
    )
    VALUES (
      new_id, v_user, other_id, topic,
      'invited', COALESCE(cfg->>'protocolVersion', '1'),
      pg_catalog.now() + pg_catalog.make_interval(secs => invite_seconds), 1, source.id
    )
    RETURNING * INTO match;

    INSERT INTO public.live_pvp_participants (match_id, user_id, participant_role, active_slot)
    VALUES
      (match.id, v_user, 'challenger', true),
      (match.id, other_id, 'opponent', false);

    PERFORM public.live_pvp_record_and_broadcast(
      match, 'rematch_invite_created', jsonb_build_object('sourceMatchId', source.id)
    );

    PERFORM public.enqueue_player_notification(
      other_id,
      'LIVE_MATCH_REMATCH_INVITE_RECEIVED',
      NULL,
      'live_rematch:' || match.id::text,
      'live_match_rematch_invite_title',
      jsonb_build_object('opponentName', (public.live_pvp_public_participant(v_user)->>'displayName')),
      jsonb_build_object('route', 'LivePvpInviteDetails', 'matchId', match.id),
      true,
      match.id
    );
  EXCEPTION
    WHEN unique_violation THEN
      SELECT * INTO existing FROM public.live_pvp_matches WHERE rematch_of_match_id = source.id;
      IF NOT FOUND THEN
        RAISE;
      END IF;
      RETURN jsonb_build_object(
        'matchId', existing.id,
        'status', existing.status,
        'realtimeTopic', existing.realtime_topic,
        'protocolVersion', existing.protocol_version,
        'stateVersion', existing.state_version,
        'expiresAt', existing.expires_at,
        'participantRole', CASE
          WHEN existing.challenger_id = v_user THEN 'challenger'
          ELSE 'opponent'
        END,
        'opponent', public.live_pvp_public_participant(other_id),
        'rematchOfMatchId', source.id,
        'alreadyExisted', true,
        'serverNow', pg_catalog.now()
      );
  END;

  RETURN jsonb_build_object(
    'matchId', match.id,
    'status', match.status,
    'realtimeTopic', match.realtime_topic,
    'protocolVersion', match.protocol_version,
    'stateVersion', match.state_version,
    'expiresAt', match.expires_at,
    'participantRole', 'challenger',
    'opponent', public.live_pvp_public_participant(other_id),
    'rematchOfMatchId', source.id,
    'alreadyExisted', false,
    'serverNow', pg_catalog.now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_live_pvp_rematch(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_live_pvp_rematch(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- Private participant records (no public leaderboard)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_live_pvp_player_record()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user uuid := auth.uid();
  completed integer;
  wins integer;
  losses integer;
  ties integer;
  no_contests integer;
  forfeits integer;
  timeouts integer;
  recent jsonb;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT
    count(*)::integer,
    count(*) FILTER (WHERE m.winner_user_id = v_user)::integer,
    count(*) FILTER (
      WHERE m.winner_user_id IS NOT NULL AND m.winner_user_id IS DISTINCT FROM v_user
    )::integer,
    count(*) FILTER (WHERE m.outcome = 'tie')::integer,
    count(*) FILTER (WHERE m.outcome = 'no_contest')::integer,
    count(*) FILTER (
      WHERE m.completion_reason = 'forfeit'
        AND m.winner_user_id IS NOT NULL
        AND m.winner_user_id IS DISTINCT FROM v_user
    )::integer,
    count(*) FILTER (WHERE m.completion_reason = 'timeout')::integer
  INTO completed, wins, losses, ties, no_contests, forfeits, timeouts
  FROM public.live_pvp_matches m
  WHERE m.status = 'completed'
    AND (m.challenger_id = v_user OR m.opponent_id = v_user);

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'matchId', m.id,
    'outcome', m.outcome,
    'winnerUserId', m.winner_user_id,
    'completionReason', m.completion_reason,
    'settledAt', m.settled_at,
    'perspective', CASE
      WHEN m.winner_user_id = v_user THEN 'win'
      WHEN m.outcome = 'tie' THEN 'tie'
      WHEN m.outcome = 'no_contest' THEN 'no_contest'
      WHEN m.winner_user_id IS NOT NULL THEN 'loss'
      ELSE 'unknown'
    END
  ) ORDER BY m.settled_at DESC NULLS LAST), '[]'::jsonb)
  INTO recent
  FROM (
    SELECT * FROM public.live_pvp_matches m
    WHERE m.status = 'completed'
      AND (m.challenger_id = v_user OR m.opponent_id = v_user)
    ORDER BY m.settled_at DESC NULLS LAST
    LIMIT 10
  ) m;

  RETURN jsonb_build_object(
    'completedMatches', completed,
    'wins', wins,
    'losses', losses,
    'ties', ties,
    'noContests', no_contests,
    'forfeitsAgainst', forfeits,
    'timeouts', timeouts,
    'winRate', CASE WHEN completed > 0 THEN round(wins::numeric / completed::numeric, 4) ELSE 0 END,
    'recentForm', recent,
    'serverNow', pg_catalog.now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_live_pvp_player_record() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_live_pvp_player_record() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_live_pvp_head_to_head_record(p_opponent_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user uuid := auth.uid();
  completed integer;
  wins integer;
  losses integer;
  ties integer;
  no_contests integer;
  recent jsonb;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF p_opponent_id IS NULL OR p_opponent_id = v_user THEN
    RAISE EXCEPTION 'PLAYER_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;

  SELECT
    count(*)::integer,
    count(*) FILTER (WHERE m.winner_user_id = v_user)::integer,
    count(*) FILTER (
      WHERE m.winner_user_id IS NOT NULL AND m.winner_user_id IS DISTINCT FROM v_user
    )::integer,
    count(*) FILTER (WHERE m.outcome = 'tie')::integer,
    count(*) FILTER (WHERE m.outcome = 'no_contest')::integer
  INTO completed, wins, losses, ties, no_contests
  FROM public.live_pvp_matches m
  WHERE m.status = 'completed'
    AND (
      (m.challenger_id = v_user AND m.opponent_id = p_opponent_id)
      OR (m.challenger_id = p_opponent_id AND m.opponent_id = v_user)
    );

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'matchId', m.id,
    'outcome', m.outcome,
    'winnerUserId', m.winner_user_id,
    'completionReason', m.completion_reason,
    'settledAt', m.settled_at,
    'perspective', CASE
      WHEN m.winner_user_id = v_user THEN 'win'
      WHEN m.outcome = 'tie' THEN 'tie'
      WHEN m.outcome = 'no_contest' THEN 'no_contest'
      WHEN m.winner_user_id IS NOT NULL THEN 'loss'
      ELSE 'unknown'
    END
  ) ORDER BY m.settled_at DESC NULLS LAST), '[]'::jsonb)
  INTO recent
  FROM (
    SELECT * FROM public.live_pvp_matches m
    WHERE m.status = 'completed'
      AND (
        (m.challenger_id = v_user AND m.opponent_id = p_opponent_id)
        OR (m.challenger_id = p_opponent_id AND m.opponent_id = v_user)
      )
    ORDER BY m.settled_at DESC NULLS LAST
    LIMIT 10
  ) m;

  RETURN jsonb_build_object(
    'opponentId', p_opponent_id,
    'opponent', public.live_pvp_public_participant(p_opponent_id),
    'completedMatches', completed,
    'wins', wins,
    'losses', losses,
    'ties', ties,
    'noContests', no_contests,
    'winRate', CASE WHEN completed > 0 THEN round(wins::numeric / completed::numeric, 4) ELSE 0 END,
    'recentForm', recent,
    'serverNow', pg_catalog.now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_live_pvp_head_to_head_record(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_live_pvp_head_to_head_record(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- Privilege hardening: worker-only finalizer
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.finalize_live_pvp_deadlines(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finalize_live_pvp_deadlines(integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_live_pvp_deadlines(integer) TO service_role;

REVOKE ALL ON FUNCTION public.reconcile_live_pvp_active_slots(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reconcile_live_pvp_active_slots(integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.reconcile_live_pvp_active_slots(integer) TO service_role;

COMMENT ON FUNCTION public.create_live_pvp_rematch(uuid) IS
  'Participant-only rematch from completed match. Idempotent via rematch_of_match_id uniqueness.';
COMMENT ON FUNCTION public.get_live_pvp_player_record() IS
  'Private Live PvP stats for auth.uid(). No XP/coins/ranked credit.';
COMMENT ON FUNCTION public.get_live_pvp_head_to_head_record(uuid) IS
  'Private head-to-head Live PvP record vs one opponent for auth.uid().';
