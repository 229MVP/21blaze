-- v1.4 Phase 1.5 — Async Duel security hardening (forward migration).
-- Safe to apply after 0015 on databases that already granted expire to authenticated.

-- ---------------------------------------------------------------------------
-- H1: Clients must not supply arbitrary expiration timestamps.
-- Internal SECURITY DEFINER RPCs still call expire_async_duels(now()) as owner.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.expire_async_duels(p_now timestamptz DEFAULT now())
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_count integer := 0;
  effective_now timestamptz := LEAST(COALESCE(p_now, now()), now());
BEGIN
  UPDATE public.async_duels
  SET status = 'expired', updated_at = effective_now
  WHERE status IN ('challenger_playing', 'awaiting_opponent', 'opponent_playing')
    AND expires_at <= effective_now;

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;

REVOKE ALL ON FUNCTION public.expire_async_duels(timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.expire_async_duels(timestamptz) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expire_async_duels(timestamptz) TO service_role;

-- ---------------------------------------------------------------------------
-- Create-time recovery: return existing active duel for same opponent (lost response / retry).
-- Does not return unrelated completed duels or different opponents.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_async_duel(p_opponent_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_challenger uuid := auth.uid();
  cfg jsonb;
  duel public.async_duels%ROWTYPE;
  attempt public.async_duel_attempts%ROWTYPE;
  pending_count integer;
  pair_count integer;
  cooldown_seconds integer;
  last_created timestamptz;
  seed_text text;
  invite_hours integer;
BEGIN
  IF v_challenger IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  PERFORM public.expire_async_duels(now());

  IF NOT public.async_duel_creation_enabled() THEN
    RAISE EXCEPTION 'ASYNC_DUEL_DISABLED' USING ERRCODE = 'P0001';
  END IF;

  IF p_opponent_id IS NULL THEN
    RAISE EXCEPTION 'PLAYER_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;

  IF p_opponent_id = v_challenger THEN
    RAISE EXCEPTION 'SELF_CHALLENGE' USING ERRCODE = 'P0001';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_opponent_id) THEN
    RAISE EXCEPTION 'PLAYER_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_opponent_id) THEN
    RAISE EXCEPTION 'PLAYER_NOT_ELIGIBLE' USING ERRCODE = 'P0001';
  END IF;

  -- Resume existing active duel with this opponent (network timeout / double tap).
  SELECT * INTO duel
  FROM public.async_duels
  WHERE challenger_id = v_challenger
    AND opponent_id = p_opponent_id
    AND status IN ('challenger_playing', 'awaiting_opponent', 'opponent_playing')
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    SELECT * INTO attempt
    FROM public.async_duel_attempts
    WHERE duel_id = duel.id
      AND user_id = v_challenger
      AND participant_role = 'challenger'
    LIMIT 1;

    IF attempt.id IS NOT NULL THEN
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
        'opponentId', duel.opponent_id,
        'participantRole', 'challenger',
        'alreadyStarted', attempt.status <> 'started',
        'resumedExisting', true
      );
    END IF;
  END IF;

  cfg := public.async_duel_config();
  invite_hours := COALESCE((cfg->>'invitationLifetimeHours')::integer, 72);
  cooldown_seconds := COALESCE((cfg->>'creationCooldownSeconds')::integer, 30);

  SELECT count(*) INTO pending_count
  FROM public.async_duels
  WHERE challenger_id = v_challenger
    AND status IN ('challenger_playing', 'awaiting_opponent', 'opponent_playing');

  IF pending_count >= COALESCE((cfg->>'maxPendingOutgoing')::integer, 5) THEN
    RAISE EXCEPTION 'ACTIVE_DUEL_LIMIT' USING ERRCODE = 'P0001';
  END IF;

  SELECT count(*) INTO pair_count
  FROM public.async_duels
  WHERE (
      (challenger_id = v_challenger AND opponent_id = p_opponent_id)
      OR (challenger_id = p_opponent_id AND opponent_id = v_challenger)
    )
    AND status IN ('challenger_playing', 'awaiting_opponent', 'opponent_playing');

  IF pair_count >= COALESCE((cfg->>'maxActiveBetweenPair')::integer, 1) THEN
    RAISE EXCEPTION 'DUPLICATE_ACTIVE_DUEL' USING ERRCODE = 'P0001';
  END IF;

  SELECT max(created_at) INTO last_created
  FROM public.async_duels
  WHERE challenger_id = v_challenger;

  IF last_created IS NOT NULL
     AND last_created > now() - make_interval(secs => cooldown_seconds) THEN
    RAISE EXCEPTION 'ACTIVE_DUEL_LIMIT' USING ERRCODE = 'P0001', DETAIL = 'cooldown';
  END IF;

  seed_text := '21blaze-async-v1:' || gen_random_uuid()::text || ':' || encode(gen_random_bytes(16), 'hex');

  INSERT INTO public.async_duels (
    challenger_id,
    opponent_id,
    seed,
    rules_version,
    deck_version,
    duration_seconds,
    bust_limit,
    status,
    expires_at,
    target_score_visibility
  )
  VALUES (
    v_challenger,
    p_opponent_id,
    seed_text,
    COALESCE(cfg->>'rulesVersion', '1'),
    COALESCE(cfg->>'deckVersion', '1'),
    COALESCE((cfg->>'durationSeconds')::integer, 120),
    COALESCE((cfg->>'bustLimit')::integer, 3),
    'challenger_playing',
    now() + make_interval(hours => invite_hours),
    COALESCE((cfg->>'targetScoreVisibility')::boolean, true)
  )
  RETURNING * INTO duel;

  INSERT INTO public.async_duel_attempts (
    duel_id,
    user_id,
    participant_role,
    status,
    rules_version,
    deck_version
  )
  VALUES (
    duel.id,
    v_challenger,
    'challenger',
    'started',
    duel.rules_version,
    duel.deck_version
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
    'opponentId', duel.opponent_id,
    'participantRole', 'challenger',
    'resumedExisting', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_async_duel(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_async_duel(uuid) TO authenticated;

-- Participant role for client-safe details typing.
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
    OR duel.status IN ('completed', 'opponent_playing')
    OR v_user = duel.challenger_id;

  RETURN jsonb_build_object(
    'duelId', duel.id,
    'status', duel.status,
    'outcome', duel.outcome,
    'winnerUserId', duel.winner_user_id,
    'decidingField', duel.deciding_field,
    'participantRole', CASE WHEN v_user = duel.challenger_id THEN 'challenger' ELSE 'opponent' END,
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
    END
  );
END;
$$;

-- Belt-and-suspenders: no direct table access for mobile roles.
REVOKE ALL ON TABLE public.async_duels FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.async_duel_attempts FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.expire_async_duels(timestamptz) IS
  'Server-only expiration. p_now clamped to <= now(). Not callable by authenticated clients.';
