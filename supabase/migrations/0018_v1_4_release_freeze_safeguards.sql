-- Version 1.4 Release Freeze — production safeguards
-- Forward-only: privilege hardening, kill switches, integrity diagnostics, rematch fields on details.

-- ---------------------------------------------------------------------------
-- Kill switches
-- ---------------------------------------------------------------------------
INSERT INTO public.app_configuration (key, value)
VALUES
  ('async_duel_push_enabled', 'true'::jsonb),
  ('async_duel_rematch_enabled', 'true'::jsonb)
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.async_duel_push_enabled()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT (value = 'true'::jsonb OR value = to_jsonb(true))
      FROM public.app_configuration
      WHERE key = 'async_duel_push_enabled'
    ),
    true
  );
$$;

CREATE OR REPLACE FUNCTION public.async_duel_rematch_enabled()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT (value = 'true'::jsonb OR value = to_jsonb(true))
      FROM public.app_configuration
      WHERE key = 'async_duel_rematch_enabled'
    ),
    true
  )
  AND public.async_duel_creation_enabled();
$$;

REVOKE ALL ON FUNCTION public.async_duel_push_enabled() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.async_duel_rematch_enabled() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.async_duel_push_enabled() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.async_duel_rematch_enabled() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_async_duel_ops_status()
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
    'creationEnabled', public.async_duel_creation_enabled(),
    'rematchEnabled', public.async_duel_rematch_enabled(),
    'pushEnabled', public.async_duel_push_enabled(),
    'configActive', COALESCE((public.async_duel_config()->>'active')::boolean, true)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_async_duel_ops_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_async_duel_ops_status() TO authenticated;

-- ---------------------------------------------------------------------------
-- Privilege hardening: no direct client mutation of notifications / tokens / prefs
-- Mutations remain available only through SECURITY DEFINER RPCs.
-- ---------------------------------------------------------------------------
REVOKE INSERT, UPDATE, DELETE ON public.player_notifications FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.notification_preferences FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.device_push_tokens FROM authenticated;
-- SELECT retained on notifications/prefs/tokens for RLS-scoped reads if used;
-- primary reads still go through SECURITY DEFINER RPCs.

-- ---------------------------------------------------------------------------
-- Push kill switch in enqueue + claim
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enqueue_player_notification(
  p_user_id uuid,
  p_type text,
  p_duel_id uuid,
  p_dedupe_key text,
  p_title_key text,
  p_body_data jsonb,
  p_deep_link_data jsonb,
  p_push_eligible boolean DEFAULT true
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

  IF p_type = 'DUEL_CHALLENGE_RECEIVED' THEN
    allow_in_app := prefs.duel_challenges_in_app;
    allow_push := prefs.duel_challenges_push;
  ELSIF p_type = 'DUEL_COMPLETED' THEN
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
    AND p_type <> 'DUEL_EXPIRED'
    AND public.async_duel_push_enabled();

  INSERT INTO public.player_notifications (
    user_id, notification_type, duel_id, dedupe_key, title_key, body_data,
    deep_link_data, push_eligible, push_status
  )
  VALUES (
    p_user_id, p_type, p_duel_id, p_dedupe_key, p_title_key,
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

CREATE OR REPLACE FUNCTION public.claim_notification_push_outbox(p_limit integer DEFAULT 20)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  safe_limit integer := LEAST(GREATEST(COALESCE(p_limit, 20), 1), 50);
  items jsonb;
BEGIN
  IF NOT public.async_duel_push_enabled() THEN
    UPDATE public.notification_push_outbox
    SET status = 'suppressed', last_error_code = 'push_disabled', updated_at = now()
    WHERE status IN ('pending', 'failed')
      AND next_attempt_at <= now();
    RETURN jsonb_build_object('items', '[]'::jsonb, 'suppressed', true);
  END IF;

  WITH claimed AS (
    UPDATE public.notification_push_outbox o
    SET status = 'processing', updated_at = now(), attempt_count = attempt_count + 1
    WHERE o.id IN (
      SELECT id FROM public.notification_push_outbox
      WHERE status IN ('pending', 'failed')
        AND next_attempt_at <= now()
        AND attempt_count < 8
      ORDER BY next_attempt_at
      LIMIT safe_limit
      FOR UPDATE SKIP LOCKED
    )
    RETURNING *
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'outboxId', c.id,
    'notificationId', c.notification_id,
    'userId', c.user_id,
    'attemptCount', c.attempt_count,
    'notification', (
      SELECT jsonb_build_object(
        'type', n.notification_type,
        'titleKey', n.title_key,
        'bodyData', n.body_data,
        'deepLinkData', n.deep_link_data,
        'duelId', n.duel_id
      )
      FROM public.player_notifications n WHERE n.id = c.notification_id
    ),
    'tokens', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id', t.id,
        'token', t.push_token,
        'platform', t.platform,
        'appEnvironment', t.app_environment
      )), '[]'::jsonb)
      FROM public.device_push_tokens t
      WHERE t.user_id = c.user_id AND t.active = true AND t.revoked_at IS NULL
    )
  )), '[]'::jsonb)
  INTO items
  FROM claimed c;

  RETURN jsonb_build_object('items', items);
END;
$$;

-- Rematch kill switch (in addition to creation_enabled)
CREATE OR REPLACE FUNCTION public.create_async_duel_rematch(p_source_duel_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  source public.async_duels%ROWTYPE;
  existing public.async_duels%ROWTYPE;
  other_id uuid;
  cfg jsonb;
  duel public.async_duels%ROWTYPE;
  attempt public.async_duel_attempts%ROWTYPE;
  pending_count integer;
  pair_count integer;
  invite_hours integer;
  seed_text text;
  root_id uuid;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  PERFORM public.expire_async_duels(now());

  IF NOT public.async_duel_rematch_enabled() THEN
    RAISE EXCEPTION 'ASYNC_DUEL_DISABLED' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO source FROM public.async_duels WHERE id = p_source_duel_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'DUEL_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;

  IF source.challenger_id IS DISTINCT FROM v_user AND source.opponent_id IS DISTINCT FROM v_user THEN
    RAISE EXCEPTION 'NOT_PARTICIPANT' USING ERRCODE = 'P0001';
  END IF;

  IF source.status <> 'completed' THEN
    RAISE EXCEPTION 'INVALID_DUEL_STATE' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO existing FROM public.async_duels WHERE rematch_of_duel_id = source.id;
  IF FOUND THEN
    SELECT * INTO attempt
    FROM public.async_duel_attempts
    WHERE duel_id = existing.id AND participant_role = 'challenger';

    IF attempt.user_id IS DISTINCT FROM v_user THEN
      RAISE EXCEPTION 'DUPLICATE_ACTIVE_DUEL' USING ERRCODE = 'P0001', DETAIL = 'rematch_exists';
    END IF;

    RETURN jsonb_build_object(
      'duelId', existing.id,
      'attemptId', attempt.id,
      'seed', existing.seed,
      'rulesVersion', existing.rules_version,
      'deckVersion', existing.deck_version,
      'durationSeconds', existing.duration_seconds,
      'bustLimit', existing.bust_limit,
      'status', existing.status,
      'expiresAt', existing.expires_at,
      'participantRole', 'challenger',
      'alreadyStarted', attempt.status <> 'started' OR existing.status <> 'challenger_playing',
      'rematchOfDuelId', source.id,
      'seriesRootDuelId', existing.series_root_duel_id,
      'alreadyExisted', true
    );
  END IF;

  other_id := CASE WHEN source.challenger_id = v_user THEN source.opponent_id ELSE source.challenger_id END;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = other_id) THEN
    RAISE EXCEPTION 'PLAYER_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = other_id) THEN
    RAISE EXCEPTION 'PLAYER_NOT_ELIGIBLE' USING ERRCODE = 'P0001';
  END IF;

  cfg := public.async_duel_config();
  invite_hours := COALESCE((cfg->>'invitationLifetimeHours')::integer, 72);

  SELECT count(*) INTO pending_count
  FROM public.async_duels
  WHERE challenger_id = v_user
    AND status IN ('challenger_playing', 'awaiting_opponent', 'opponent_playing');

  IF pending_count >= COALESCE((cfg->>'maxPendingOutgoing')::integer, 5) THEN
    RAISE EXCEPTION 'ACTIVE_DUEL_LIMIT' USING ERRCODE = 'P0001';
  END IF;

  SELECT count(*) INTO pair_count
  FROM public.async_duels
  WHERE (
      (challenger_id = v_user AND opponent_id = other_id)
      OR (challenger_id = other_id AND opponent_id = v_user)
    )
    AND status IN ('challenger_playing', 'awaiting_opponent', 'opponent_playing');

  IF pair_count >= COALESCE((cfg->>'maxActiveBetweenPair')::integer, 1) THEN
    RAISE EXCEPTION 'DUPLICATE_ACTIVE_DUEL' USING ERRCODE = 'P0001';
  END IF;

  root_id := COALESCE(source.series_root_duel_id, source.id);
  seed_text := '21blaze-async-v1:' || gen_random_uuid()::text || ':' || encode(gen_random_bytes(16), 'hex');

  BEGIN
    INSERT INTO public.async_duels (
      challenger_id, opponent_id, seed, rules_version, deck_version,
      duration_seconds, bust_limit, status, expires_at, target_score_visibility,
      rematch_of_duel_id, series_root_duel_id
    )
    VALUES (
      v_user, other_id, seed_text,
      COALESCE(cfg->>'rulesVersion', '1'),
      COALESCE(cfg->>'deckVersion', '1'),
      COALESCE((cfg->>'durationSeconds')::integer, 120),
      COALESCE((cfg->>'bustLimit')::integer, 3),
      'challenger_playing',
      now() + make_interval(hours => invite_hours),
      COALESCE((cfg->>'targetScoreVisibility')::boolean, true),
      source.id, root_id
    )
    RETURNING * INTO duel;
  EXCEPTION
    WHEN unique_violation THEN
      SELECT * INTO existing FROM public.async_duels WHERE rematch_of_duel_id = source.id;
      IF existing.challenger_id = v_user THEN
        SELECT * INTO attempt FROM public.async_duel_attempts
        WHERE duel_id = existing.id AND participant_role = 'challenger';
        RETURN jsonb_build_object(
          'duelId', existing.id,
          'attemptId', attempt.id,
          'seed', existing.seed,
          'rulesVersion', existing.rules_version,
          'deckVersion', existing.deck_version,
          'durationSeconds', existing.duration_seconds,
          'bustLimit', existing.bust_limit,
          'status', existing.status,
          'expiresAt', existing.expires_at,
          'participantRole', 'challenger',
          'alreadyStarted', attempt.status <> 'started' OR existing.status <> 'challenger_playing',
          'rematchOfDuelId', source.id,
          'seriesRootDuelId', existing.series_root_duel_id,
          'alreadyExisted', true
        );
      END IF;
      RAISE EXCEPTION 'DUPLICATE_ACTIVE_DUEL' USING ERRCODE = 'P0001', DETAIL = 'rematch_race';
  END;

  INSERT INTO public.async_duel_attempts (
    duel_id, user_id, participant_role, status, rules_version, deck_version
  )
  VALUES (
    duel.id, v_user, 'challenger', 'started', duel.rules_version, duel.deck_version
  )
  RETURNING * INTO attempt;

  RETURN jsonb_build_object(
    'duelId', duel.id,
    'attemptId', attempt.id,
    'seed', duel.seed,
    'rulesVersion', duel.rules_version,
    'deckVersion', duel.deck_version,
    'durationSeconds', duel.duration_seconds,
    'bustLimit', duel.bust_limit,
    'status', duel.status,
    'expiresAt', duel.expires_at,
    'participantRole', 'challenger',
    'alreadyStarted', false,
    'rematchOfDuelId', source.id,
    'seriesRootDuelId', root_id,
    'alreadyExisted', false
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- Details: include rematch lineage (still no seed)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_async_duel_details(p_duel_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  duel public.async_duels%ROWTYPE;
  ca public.async_duel_attempts%ROWTYPE;
  oa public.async_duel_attempts%ROWTYPE;
  include_score boolean;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT * INTO duel FROM public.async_duels WHERE id = p_duel_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'DUEL_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;
  IF duel.challenger_id IS DISTINCT FROM v_user AND duel.opponent_id IS DISTINCT FROM v_user THEN
    RAISE EXCEPTION 'NOT_PARTICIPANT' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO ca FROM public.async_duel_attempts
  WHERE duel_id = duel.id AND participant_role = 'challenger';
  SELECT * INTO oa FROM public.async_duel_attempts
  WHERE duel_id = duel.id AND participant_role = 'opponent';

  include_score := duel.target_score_visibility
    AND duel.status IN ('awaiting_opponent', 'opponent_playing', 'completed');

  RETURN jsonb_build_object(
    'duelId', duel.id,
    'status', duel.status,
    'outcome', duel.outcome,
    'winnerUserId', duel.winner_user_id,
    'decidingField', duel.deciding_field,
    'challenger', public.async_duel_public_participant(duel.challenger_id),
    'opponent', public.async_duel_public_participant(duel.opponent_id),
    'rulesVersion', duel.rules_version,
    'deckVersion', duel.deck_version,
    'durationSeconds', duel.duration_seconds,
    'bustLimit', duel.bust_limit,
    'createdAt', duel.created_at,
    'expiresAt', duel.expires_at,
    'settledAt', duel.settled_at,
    'challengerAttemptStatus', ca.status,
    'opponentAttemptStatus', oa.status,
    'challengerScore', CASE WHEN include_score THEN ca.score ELSE NULL END,
    'opponentScore', CASE
      WHEN v_user = duel.opponent_id OR duel.status = 'completed' THEN oa.score
      ELSE NULL
    END,
    'rematchOfDuelId', duel.rematch_of_duel_id,
    'seriesRootDuelId', duel.series_root_duel_id
    -- Seed intentionally omitted.
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- Integrity diagnostics (service_role / ops only)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.diagnose_async_duel_integrity(p_limit integer DEFAULT 100)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  findings jsonb := '[]'::jsonb;
  chunk jsonb;
  safe_limit integer := LEAST(GREATEST(COALESCE(p_limit, 100), 1), 500);
BEGIN
  SELECT COALESCE(jsonb_agg(jsonb_build_object('code', 'winner_not_participant', 'duelId', d.id)), '[]'::jsonb)
  INTO chunk
  FROM (
    SELECT id FROM public.async_duels
    WHERE winner_user_id IS NOT NULL
      AND winner_user_id IS DISTINCT FROM challenger_id
      AND winner_user_id IS DISTINCT FROM opponent_id
    LIMIT safe_limit
  ) d;
  findings := findings || chunk;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('code', 'completed_missing_attempts', 'duelId', x.id)), '[]'::jsonb)
  INTO chunk
  FROM (
    SELECT d.id
    FROM public.async_duels d
    LEFT JOIN public.async_duel_attempts ca
      ON ca.duel_id = d.id AND ca.participant_role = 'challenger' AND ca.status = 'completed'
    LEFT JOIN public.async_duel_attempts oa
      ON oa.duel_id = d.id AND oa.participant_role = 'opponent' AND oa.status = 'completed'
    WHERE d.status = 'completed' AND (ca.id IS NULL OR oa.id IS NULL)
    LIMIT safe_limit
  ) x;
  findings := findings || chunk;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'code', 'incomplete_has_outcome', 'duelId', d.id, 'status', d.status
  )), '[]'::jsonb)
  INTO chunk
  FROM (
    SELECT id, status FROM public.async_duels
    WHERE status <> 'completed'
      AND (outcome IS NOT NULL OR winner_user_id IS NOT NULL OR settled_at IS NOT NULL)
    LIMIT safe_limit
  ) d;
  findings := findings || chunk;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'code', 'attempt_identity_mismatch', 'duelId', a.duel_id, 'attemptId', a.id
  )), '[]'::jsonb)
  INTO chunk
  FROM (
    SELECT a.id, a.duel_id
    FROM public.async_duel_attempts a
    JOIN public.async_duels d ON d.id = a.duel_id
    WHERE (a.participant_role = 'challenger' AND a.user_id IS DISTINCT FROM d.challenger_id)
       OR (a.participant_role = 'opponent' AND a.user_id IS DISTINCT FROM d.opponent_id)
    LIMIT safe_limit
  ) a;
  findings := findings || chunk;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'code', 'rematch_of_incomplete', 'duelId', c.id, 'sourceId', c.rematch_of_duel_id
  )), '[]'::jsonb)
  INTO chunk
  FROM (
    SELECT c.id, c.rematch_of_duel_id
    FROM public.async_duels c
    JOIN public.async_duels s ON s.id = c.rematch_of_duel_id
    WHERE s.status <> 'completed'
    LIMIT safe_limit
  ) c;
  findings := findings || chunk;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('code', 'identical_participants', 'duelId', d.id)), '[]'::jsonb)
  INTO chunk
  FROM (
    SELECT id FROM public.async_duels WHERE challenger_id = opponent_id
    LIMIT safe_limit
  ) d;
  findings := findings || chunk;

  RETURN jsonb_build_object(
    'findingCount', jsonb_array_length(findings),
    'findings', findings
  );
END;
$$;

REVOKE ALL ON FUNCTION public.diagnose_async_duel_integrity(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.diagnose_async_duel_integrity(integer) TO service_role;

COMMENT ON FUNCTION public.get_async_duel_ops_status IS
  'v1.4 freeze: client-readable kill-switch status for unavailable UX.';
COMMENT ON FUNCTION public.diagnose_async_duel_integrity IS
  'v1.4 freeze: ops-only invariant scan. Not exposed in mobile UI.';

-- ---------------------------------------------------------------------------
-- H1: Expire must not be callable by clients with a forged future p_now.
-- Nested SECURITY DEFINER callers still work as owner.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.expire_async_duels(p_now timestamptz DEFAULT now())
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_count integer := 0;
  r record;
  effective_now timestamptz := LEAST(COALESCE(p_now, now()), now());
BEGIN
  FOR r IN
    UPDATE public.async_duels d
    SET status = 'expired', updated_at = effective_now
    WHERE d.status IN ('challenger_playing', 'awaiting_opponent', 'opponent_playing')
      AND d.expires_at <= effective_now
    RETURNING d.id, d.challenger_id, d.opponent_id, d.status
  LOOP
    updated_count := updated_count + 1;
    PERFORM public.enqueue_player_notification(
      r.challenger_id,
      'DUEL_EXPIRED',
      r.id,
      'duel_expired:' || r.id::text || ':' || r.challenger_id::text,
      'CHALLENGE_EXPIRED',
      jsonb_build_object('duelId', r.id),
      jsonb_build_object('screen', 'AsyncDuelChallengeDetails', 'duelId', r.id),
      false
    );
    PERFORM public.enqueue_player_notification(
      r.opponent_id,
      'DUEL_EXPIRED',
      r.id,
      'duel_expired:' || r.id::text || ':' || r.opponent_id::text,
      'CHALLENGE_EXPIRED',
      jsonb_build_object('duelId', r.id),
      jsonb_build_object('screen', 'AsyncDuelChallengeDetails', 'duelId', r.id),
      false
    );
  END LOOP;

  RETURN updated_count;
END;
$$;

REVOKE ALL ON FUNCTION public.expire_async_duels(timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.expire_async_duels(timestamptz) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expire_async_duels(timestamptz) TO service_role;

-- ---------------------------------------------------------------------------
-- M1: Privilege hygiene — no direct table access for clients
-- ---------------------------------------------------------------------------
REVOKE ALL ON TABLE public.async_duels FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.async_duel_attempts FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.player_duel_stats FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.duel_stat_events FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.notification_push_outbox FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- H2: Restore full result-field validation on completion (regression from 0017)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.complete_async_duel_attempt(
  p_attempt_id uuid,
  p_score integer,
  p_exact_21_count integer,
  p_five_card_clear_count integer,
  p_bust_count integer,
  p_cards_played integer,
  p_lanes_cleared integer,
  p_completion_ms integer,
  p_rules_version text,
  p_deck_version text,
  p_submission_version text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  attempt public.async_duel_attempts%ROWTYPE;
  duel public.async_duels%ROWTYPE;
  other public.async_duel_attempts%ROWTYPE;
  comparison jsonb;
  winner uuid;
  outcome_text text;
  deciding text;
  play_hours integer;
  challenger_name text;
  opponent_name text;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT * INTO attempt FROM public.async_duel_attempts WHERE id = p_attempt_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'DUEL_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;

  IF attempt.user_id IS DISTINCT FROM v_user THEN
    RAISE EXCEPTION 'NOT_PARTICIPANT' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO duel FROM public.async_duels WHERE id = attempt.duel_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'DUEL_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;

  IF duel.status IN ('cancelled', 'declined', 'expired', 'invalid') THEN
    RAISE EXCEPTION 'INVALID_DUEL_STATE' USING ERRCODE = 'P0001';
  END IF;

  IF attempt.status = 'completed' THEN
    RETURN public.get_async_duel_result(duel.id);
  END IF;

  IF attempt.status <> 'started' THEN
    RAISE EXCEPTION 'INVALID_DUEL_STATE' USING ERRCODE = 'P0001';
  END IF;

  IF p_rules_version IS DISTINCT FROM duel.rules_version
     OR p_deck_version IS DISTINCT FROM duel.deck_version THEN
    RAISE EXCEPTION 'INVALID_RESULT' USING ERRCODE = 'P0001';
  END IF;

  PERFORM public.validate_async_duel_result_fields(
    p_score,
    p_exact_21_count,
    p_five_card_clear_count,
    p_bust_count,
    p_cards_played,
    p_lanes_cleared,
    p_completion_ms,
    duel.duration_seconds
  );

  SELECT COALESCE(display_name::text, 'Blaze Player') INTO challenger_name
  FROM public.profiles WHERE id = duel.challenger_id;
  SELECT COALESCE(display_name::text, 'Blaze Player') INTO opponent_name
  FROM public.profiles WHERE id = duel.opponent_id;

  IF attempt.participant_role = 'challenger' THEN
    IF duel.status <> 'challenger_playing' THEN
      RAISE EXCEPTION 'INVALID_DUEL_STATE' USING ERRCODE = 'P0001';
    END IF;

    PERFORM public.assert_async_duel_transition(duel.status, 'awaiting_opponent');

    UPDATE public.async_duel_attempts
    SET
      status = 'completed',
      completed_at = now(),
      score = p_score,
      exact_21_count = COALESCE(p_exact_21_count, 0),
      five_card_clear_count = COALESCE(p_five_card_clear_count, 0),
      bust_count = COALESCE(p_bust_count, 0),
      cards_played = COALESCE(p_cards_played, 0),
      lanes_cleared = COALESCE(p_lanes_cleared, 0),
      completion_ms = COALESCE(p_completion_ms, 0),
      submission_version = p_submission_version,
      updated_at = now()
    WHERE id = attempt.id
    RETURNING * INTO attempt;

    play_hours := COALESCE(
      (public.async_duel_config()->>'opponentPlayLifetimeHours')::integer,
      72
    );

    UPDATE public.async_duels
    SET
      status = 'awaiting_opponent',
      challenger_completed_at = now(),
      expires_at = now() + make_interval(hours => play_hours),
      updated_at = now()
    WHERE id = duel.id
    RETURNING * INTO duel;

    PERFORM public.enqueue_player_notification(
      duel.opponent_id,
      'DUEL_CHALLENGE_RECEIVED',
      duel.id,
      'duel_challenge_received:' || duel.id::text || ':' || duel.opponent_id::text,
      'NEW_DUEL',
      jsonb_build_object(
        'opponentDisplayName', challenger_name,
        'challengerScore', attempt.score,
        'duelId', duel.id
      ),
      jsonb_build_object('screen', 'AsyncDuelChallengeDetails', 'duelId', duel.id),
      true
    );

    RETURN jsonb_build_object(
      'duelId', duel.id,
      'attemptId', attempt.id,
      'status', duel.status,
      'alreadyCompleted', false,
      'score', attempt.score,
      'settled', false
    );
  END IF;

  IF attempt.participant_role <> 'opponent' THEN
    RAISE EXCEPTION 'NOT_PARTICIPANT' USING ERRCODE = 'P0001';
  END IF;

  IF duel.status <> 'opponent_playing' THEN
    RAISE EXCEPTION 'INVALID_DUEL_STATE' USING ERRCODE = 'P0001';
  END IF;

  IF duel.expires_at <= now() THEN
    PERFORM public.assert_async_duel_transition(duel.status, 'expired');
    UPDATE public.async_duels SET status = 'expired', updated_at = now() WHERE id = duel.id;
    RAISE EXCEPTION 'EXPIRED' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO other
  FROM public.async_duel_attempts
  WHERE duel_id = duel.id
    AND participant_role = 'challenger'
    AND status = 'completed'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'INVALID_DUEL_STATE' USING ERRCODE = 'P0001', DETAIL = 'missing_challenger_result';
  END IF;

  UPDATE public.async_duel_attempts
  SET
    status = 'completed',
    completed_at = now(),
    score = p_score,
    exact_21_count = COALESCE(p_exact_21_count, 0),
    five_card_clear_count = COALESCE(p_five_card_clear_count, 0),
    bust_count = COALESCE(p_bust_count, 0),
    cards_played = COALESCE(p_cards_played, 0),
    lanes_cleared = COALESCE(p_lanes_cleared, 0),
    completion_ms = COALESCE(p_completion_ms, 0),
    submission_version = p_submission_version,
    updated_at = now()
  WHERE id = attempt.id
  RETURNING * INTO attempt;

  comparison := public.compare_async_duel_results(
    other.score,
    other.exact_21_count,
    other.five_card_clear_count,
    other.bust_count,
    other.completion_ms,
    attempt.score,
    attempt.exact_21_count,
    attempt.five_card_clear_count,
    attempt.bust_count,
    attempt.completion_ms
  );

  outcome_text := comparison->>'outcome';
  deciding := comparison->>'decidingField';
  winner := CASE outcome_text
    WHEN 'challenger_win' THEN duel.challenger_id
    WHEN 'opponent_win' THEN duel.opponent_id
    ELSE NULL
  END;

  PERFORM public.assert_async_duel_transition(duel.status, 'completed');

  UPDATE public.async_duels
  SET
    status = 'completed',
    outcome = outcome_text,
    winner_user_id = winner,
    deciding_field = deciding,
    opponent_completed_at = now(),
    settled_at = now(),
    updated_at = now()
  WHERE id = duel.id
  RETURNING * INTO duel;

  PERFORM public.apply_async_duel_settlement_stats(duel.id);

  PERFORM public.enqueue_player_notification(
    duel.challenger_id,
    'DUEL_COMPLETED',
    duel.id,
    'duel_completed:' || duel.id::text || ':' || duel.challenger_id::text,
    'DUEL_COMPLETE',
    jsonb_build_object(
      'opponentDisplayName', opponent_name,
      'outcome', duel.outcome,
      'duelId', duel.id
    ),
    jsonb_build_object('screen', 'AsyncDuelResult', 'duelId', duel.id),
    true
  );

  -- No XP / Blaze Coins.
  RETURN public.get_async_duel_result(duel.id);
END;
$$;
