-- Version 1.4 Phase 1 — Async Duel backend foundation
-- Server-authoritative duels, attempts, settlement. No XP/coin rewards.

-- ---------------------------------------------------------------------------
-- Configuration (server registry; mirrored in src/asyncDuel/asyncDuelConfig.ts)
-- ---------------------------------------------------------------------------
INSERT INTO public.app_configuration (key, value)
VALUES
  (
    'async_duel_config',
    jsonb_build_object(
      'rulesVersion', '1',
      'deckVersion', '1',
      'durationSeconds', 120,
      'bustLimit', 3,
      'invitationLifetimeHours', 72,
      'opponentPlayLifetimeHours', 72,
      'targetScoreVisibility', true,
      'maxPendingOutgoing', 5,
      'maxActiveBetweenPair', 1,
      'creationCooldownSeconds', 30,
      'active', true
    )
  ),
  ('async_duel_creation_enabled', 'true'::jsonb)
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value, updated_at = now();

-- ---------------------------------------------------------------------------
-- async_duels
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.async_duels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenger_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  opponent_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  seed text NOT NULL,
  rules_version text NOT NULL,
  deck_version text NOT NULL,
  duration_seconds integer NOT NULL,
  bust_limit integer NOT NULL,
  status text NOT NULL,
  winner_user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  outcome text,
  deciding_field text,
  challenger_completed_at timestamptz,
  opponent_started_at timestamptz,
  opponent_completed_at timestamptz,
  expires_at timestamptz NOT NULL,
  settled_at timestamptz,
  target_score_visibility boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT async_duels_participants_distinct CHECK (challenger_id <> opponent_id),
  CONSTRAINT async_duels_status_check CHECK (
    status IN (
      'challenger_playing',
      'awaiting_opponent',
      'opponent_playing',
      'completed',
      'declined',
      'expired',
      'cancelled',
      'invalid'
    )
  ),
  CONSTRAINT async_duels_outcome_check CHECK (
    outcome IS NULL
    OR outcome IN ('challenger_win', 'opponent_win', 'tie')
  ),
  CONSTRAINT async_duels_duration_check CHECK (duration_seconds > 0 AND duration_seconds <= 600),
  CONSTRAINT async_duels_bust_check CHECK (bust_limit >= 0 AND bust_limit <= 20),
  CONSTRAINT async_duels_winner_participant_check CHECK (
    winner_user_id IS NULL
    OR winner_user_id = challenger_id
    OR winner_user_id = opponent_id
  ),
  CONSTRAINT async_duels_outcome_winner_consistency CHECK (
    (outcome = 'tie' AND winner_user_id IS NULL)
    OR (outcome = 'challenger_win' AND winner_user_id = challenger_id)
    OR (outcome = 'opponent_win' AND winner_user_id = opponent_id)
    OR (outcome IS NULL AND winner_user_id IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS async_duels_challenger_status_idx
  ON public.async_duels (challenger_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS async_duels_opponent_status_idx
  ON public.async_duels (opponent_id, status, expires_at);

CREATE INDEX IF NOT EXISTS async_duels_expires_status_idx
  ON public.async_duels (expires_at)
  WHERE status IN ('challenger_playing', 'awaiting_opponent', 'opponent_playing');

CREATE INDEX IF NOT EXISTS async_duels_pair_active_idx
  ON public.async_duels (challenger_id, opponent_id, status);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'set_updated_at'
  ) THEN
    DROP TRIGGER IF EXISTS async_duels_set_updated_at ON public.async_duels;
    CREATE TRIGGER async_duels_set_updated_at
      BEFORE UPDATE ON public.async_duels
      FOR EACH ROW
      EXECUTE FUNCTION public.set_updated_at();
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- async_duel_attempts
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.async_duel_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  duel_id uuid NOT NULL REFERENCES public.async_duels (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  participant_role text NOT NULL,
  status text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  score integer,
  exact_21_count integer,
  five_card_clear_count integer,
  bust_count integer,
  cards_played integer,
  lanes_cleared integer,
  completion_ms integer,
  rules_version text NOT NULL,
  deck_version text NOT NULL,
  submission_version text,
  result_hash text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT async_duel_attempts_role_check CHECK (
    participant_role IN ('challenger', 'opponent')
  ),
  CONSTRAINT async_duel_attempts_status_check CHECK (
    status IN ('started', 'completed', 'abandoned', 'invalid')
  ),
  CONSTRAINT async_duel_attempts_score_check CHECK (score IS NULL OR score >= 0),
  CONSTRAINT async_duel_attempts_counters_check CHECK (
    (exact_21_count IS NULL OR exact_21_count >= 0)
    AND (five_card_clear_count IS NULL OR five_card_clear_count >= 0)
    AND (bust_count IS NULL OR bust_count >= 0)
    AND (cards_played IS NULL OR cards_played >= 0)
    AND (lanes_cleared IS NULL OR lanes_cleared >= 0)
    AND (completion_ms IS NULL OR completion_ms >= 0)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS async_duel_attempts_duel_role_unique
  ON public.async_duel_attempts (duel_id, participant_role);

CREATE UNIQUE INDEX IF NOT EXISTS async_duel_attempts_duel_user_unique
  ON public.async_duel_attempts (duel_id, user_id);

CREATE INDEX IF NOT EXISTS async_duel_attempts_user_idx
  ON public.async_duel_attempts (user_id, created_at DESC);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'set_updated_at'
  ) THEN
    DROP TRIGGER IF EXISTS async_duel_attempts_set_updated_at ON public.async_duel_attempts;
    CREATE TRIGGER async_duel_attempts_set_updated_at
      BEFORE UPDATE ON public.async_duel_attempts
      FOR EACH ROW
      EXECUTE FUNCTION public.set_updated_at();
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.async_duel_config()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT value FROM public.app_configuration WHERE key = 'async_duel_config'),
    jsonb_build_object(
      'rulesVersion', '1',
      'deckVersion', '1',
      'durationSeconds', 120,
      'bustLimit', 3,
      'invitationLifetimeHours', 72,
      'opponentPlayLifetimeHours', 72,
      'targetScoreVisibility', true,
      'maxPendingOutgoing', 5,
      'maxActiveBetweenPair', 1,
      'creationCooldownSeconds', 30,
      'active', true
    )
  );
$$;

REVOKE ALL ON FUNCTION public.async_duel_config() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.async_duel_config() TO service_role;

CREATE OR REPLACE FUNCTION public.async_duel_creation_enabled()
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
      WHERE key = 'async_duel_creation_enabled'
    ),
    true
  )
  AND COALESCE((public.async_duel_config()->>'active')::boolean, true);
$$;

CREATE OR REPLACE FUNCTION public.assert_async_duel_transition(
  p_from text,
  p_to text
)
RETURNS void
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF p_from = p_to THEN
    RETURN;
  END IF;

  IF (p_from = 'challenger_playing' AND p_to IN ('awaiting_opponent', 'cancelled', 'expired', 'invalid'))
     OR (p_from = 'awaiting_opponent' AND p_to IN ('opponent_playing', 'declined', 'expired', 'invalid'))
     OR (p_from = 'opponent_playing' AND p_to IN ('completed', 'expired', 'invalid'))
     OR (p_from IN ('completed', 'declined', 'expired', 'cancelled', 'invalid') AND FALSE)
  THEN
    RETURN;
  END IF;

  RAISE EXCEPTION 'INVALID_DUEL_STATE'
    USING ERRCODE = 'P0001',
          DETAIL = format('illegal transition %s -> %s', p_from, p_to);
END;
$$;

CREATE OR REPLACE FUNCTION public.compare_async_duel_results(
  p_challenger_score integer,
  p_challenger_exact_21 integer,
  p_challenger_five_card integer,
  p_challenger_busts integer,
  p_challenger_completion_ms integer,
  p_opponent_score integer,
  p_opponent_exact_21 integer,
  p_opponent_five_card integer,
  p_opponent_busts integer,
  p_opponent_completion_ms integer
)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  c_score integer := COALESCE(p_challenger_score, 0);
  o_score integer := COALESCE(p_opponent_score, 0);
  c_e21 integer := COALESCE(p_challenger_exact_21, 0);
  o_e21 integer := COALESCE(p_opponent_exact_21, 0);
  c_fc integer := COALESCE(p_challenger_five_card, 0);
  o_fc integer := COALESCE(p_opponent_five_card, 0);
  c_bust integer := COALESCE(p_challenger_busts, 0);
  o_bust integer := COALESCE(p_opponent_busts, 0);
  c_ms integer := COALESCE(p_challenger_completion_ms, 2147483647);
  o_ms integer := COALESCE(p_opponent_completion_ms, 2147483647);
BEGIN
  IF c_score > o_score THEN
    RETURN jsonb_build_object('outcome', 'challenger_win', 'decidingField', 'score');
  ELSIF o_score > c_score THEN
    RETURN jsonb_build_object('outcome', 'opponent_win', 'decidingField', 'score');
  ELSIF c_e21 > o_e21 THEN
    RETURN jsonb_build_object('outcome', 'challenger_win', 'decidingField', 'exact_21');
  ELSIF o_e21 > c_e21 THEN
    RETURN jsonb_build_object('outcome', 'opponent_win', 'decidingField', 'exact_21');
  ELSIF c_fc > o_fc THEN
    RETURN jsonb_build_object('outcome', 'challenger_win', 'decidingField', 'five_card_clear');
  ELSIF o_fc > c_fc THEN
    RETURN jsonb_build_object('outcome', 'opponent_win', 'decidingField', 'five_card_clear');
  ELSIF c_bust < o_bust THEN
    RETURN jsonb_build_object('outcome', 'challenger_win', 'decidingField', 'bust_count');
  ELSIF o_bust < c_bust THEN
    RETURN jsonb_build_object('outcome', 'opponent_win', 'decidingField', 'bust_count');
  ELSIF c_ms < o_ms THEN
    RETURN jsonb_build_object('outcome', 'challenger_win', 'decidingField', 'completion_ms');
  ELSIF o_ms < c_ms THEN
    RETURN jsonb_build_object('outcome', 'opponent_win', 'decidingField', 'completion_ms');
  ELSE
    RETURN jsonb_build_object('outcome', 'tie', 'decidingField', 'tie');
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.compare_async_duel_results(
  integer, integer, integer, integer, integer, integer, integer, integer, integer, integer
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.compare_async_duel_results(
  integer, integer, integer, integer, integer, integer, integer, integer, integer, integer
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.compare_async_duel_results(
  integer, integer, integer, integer, integer, integer, integer, integer, integer, integer
) TO service_role;

CREATE OR REPLACE FUNCTION public.validate_async_duel_result_fields(
  p_score integer,
  p_exact_21 integer,
  p_five_card integer,
  p_busts integer,
  p_cards_played integer,
  p_lanes_cleared integer,
  p_completion_ms integer,
  p_duration_seconds integer
)
RETURNS void
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  max_ms integer := (COALESCE(p_duration_seconds, 120) + 30) * 1000;
BEGIN
  IF p_score IS NULL OR p_score < 0 THEN
    RAISE EXCEPTION 'INVALID_RESULT' USING ERRCODE = 'P0001', DETAIL = 'score';
  END IF;
  IF COALESCE(p_exact_21, 0) < 0
     OR COALESCE(p_five_card, 0) < 0
     OR COALESCE(p_busts, 0) < 0
     OR COALESCE(p_cards_played, 0) < 0
     OR COALESCE(p_lanes_cleared, 0) < 0
     OR COALESCE(p_completion_ms, 0) < 0 THEN
    RAISE EXCEPTION 'INVALID_RESULT' USING ERRCODE = 'P0001', DETAIL = 'counters';
  END IF;
  IF p_completion_ms IS NOT NULL AND p_completion_ms > max_ms THEN
    RAISE EXCEPTION 'INVALID_RESULT' USING ERRCODE = 'P0001', DETAIL = 'completion_ms';
  END IF;
  IF COALESCE(p_cards_played, 0) > 52 THEN
    RAISE EXCEPTION 'INVALID_RESULT' USING ERRCODE = 'P0001', DETAIL = 'cards_played';
  END IF;
  IF COALESCE(p_lanes_cleared, 0) > 20 THEN
    RAISE EXCEPTION 'INVALID_RESULT' USING ERRCODE = 'P0001', DETAIL = 'lanes_cleared';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.expire_async_duels(p_now timestamptz DEFAULT now())
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_count integer := 0;
BEGIN
  UPDATE public.async_duels
  SET status = 'expired', updated_at = p_now
  WHERE status IN ('challenger_playing', 'awaiting_opponent', 'opponent_playing')
    AND expires_at <= p_now;

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;

REVOKE ALL ON FUNCTION public.expire_async_duels(timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.expire_async_duels(timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.expire_async_duels(timestamptz) TO authenticated;

-- ---------------------------------------------------------------------------
-- create_async_duel
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

  -- Eligible = has a profile row (v1.4 Phase 1). Future: blocklists, bans.
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_opponent_id) THEN
    RAISE EXCEPTION 'PLAYER_NOT_ELIGIBLE' USING ERRCODE = 'P0001';
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

  -- Server-generated seed; never from client.
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
    'participantRole', 'challenger'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_async_duel(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_async_duel(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- complete_async_duel_attempt
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
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  PERFORM public.expire_async_duels(now());

  SELECT * INTO attempt
  FROM public.async_duel_attempts
  WHERE id = p_attempt_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'DUEL_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;

  IF attempt.user_id IS DISTINCT FROM v_user THEN
    RAISE EXCEPTION 'NOT_PARTICIPANT' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO duel
  FROM public.async_duels
  WHERE id = attempt.duel_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'DUEL_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;

  IF duel.status IN ('expired', 'declined', 'cancelled', 'invalid') THEN
    RAISE EXCEPTION 'EXPIRED' USING ERRCODE = 'P0001', DETAIL = duel.status;
  END IF;

  IF attempt.status = 'completed' THEN
    RETURN public.get_async_duel_result(duel.id);
  END IF;

  IF attempt.status <> 'started' THEN
    RAISE EXCEPTION 'ALREADY_COMPLETED' USING ERRCODE = 'P0001';
  END IF;

  IF p_rules_version IS DISTINCT FROM duel.rules_version THEN
    RAISE EXCEPTION 'INVALID_RESULT' USING ERRCODE = 'P0001', DETAIL = 'rules_version';
  END IF;
  IF p_deck_version IS DISTINCT FROM duel.deck_version THEN
    RAISE EXCEPTION 'INVALID_RESULT' USING ERRCODE = 'P0001', DETAIL = 'deck_version';
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

    RETURN jsonb_build_object(
      'duelId', duel.id,
      'attemptId', attempt.id,
      'status', duel.status,
      'alreadyCompleted', false,
      'score', attempt.score,
      'settled', false
    );
  END IF;

  -- Opponent completion + settlement
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

  -- Phase 1: intentionally grant no XP and no Blaze Coins.

  RETURN public.get_async_duel_result(duel.id);
END;
$$;

REVOKE ALL ON FUNCTION public.complete_async_duel_attempt(
  uuid, integer, integer, integer, integer, integer, integer, integer, text, text, text
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_async_duel_attempt(
  uuid, integer, integer, integer, integer, integer, integer, integer, text, text, text
) TO authenticated;

-- ---------------------------------------------------------------------------
-- start_async_duel_opponent_attempt
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.start_async_duel_opponent_attempt(p_duel_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  duel public.async_duels%ROWTYPE;
  attempt public.async_duel_attempts%ROWTYPE;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  PERFORM public.expire_async_duels(now());

  SELECT * INTO duel
  FROM public.async_duels
  WHERE id = p_duel_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'DUEL_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;

  IF duel.opponent_id IS DISTINCT FROM v_user THEN
    RAISE EXCEPTION 'NOT_PARTICIPANT' USING ERRCODE = 'P0001';
  END IF;

  IF duel.status = 'declined' THEN
    RAISE EXCEPTION 'DECLINED' USING ERRCODE = 'P0001';
  END IF;

  IF duel.status = 'expired' OR duel.expires_at <= now() THEN
    IF duel.status <> 'expired' THEN
      UPDATE public.async_duels SET status = 'expired', updated_at = now() WHERE id = duel.id;
    END IF;
    RAISE EXCEPTION 'EXPIRED' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO attempt
  FROM public.async_duel_attempts
  WHERE duel_id = duel.id
    AND participant_role = 'opponent';

  IF FOUND THEN
    IF attempt.user_id IS DISTINCT FROM v_user THEN
      RAISE EXCEPTION 'NOT_PARTICIPANT' USING ERRCODE = 'P0001';
    END IF;
    -- Resume policy: return existing start payload (seed only after start).
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
      'participantRole', 'opponent',
      'alreadyStarted', true
    );
  END IF;

  IF duel.status <> 'awaiting_opponent' THEN
    RAISE EXCEPTION 'INVALID_DUEL_STATE' USING ERRCODE = 'P0001';
  END IF;

  PERFORM public.assert_async_duel_transition(duel.status, 'opponent_playing');

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
    v_user,
    'opponent',
    'started',
    duel.rules_version,
    duel.deck_version
  )
  RETURNING * INTO attempt;

  UPDATE public.async_duels
  SET
    status = 'opponent_playing',
    opponent_started_at = now(),
    updated_at = now()
  WHERE id = duel.id
  RETURNING * INTO duel;

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
    'participantRole', 'opponent',
    'alreadyStarted', false
  );
EXCEPTION
  WHEN unique_violation THEN
    -- Concurrent start race: return existing attempt.
    SELECT * INTO attempt
    FROM public.async_duel_attempts
    WHERE duel_id = p_duel_id
      AND participant_role = 'opponent';

    SELECT * INTO duel FROM public.async_duels WHERE id = p_duel_id;

    IF attempt.id IS NULL OR duel.id IS NULL THEN
      RAISE;
    END IF;

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
      'participantRole', 'opponent',
      'alreadyStarted', true
    );
END;
$$;

REVOKE ALL ON FUNCTION public.start_async_duel_opponent_attempt(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.start_async_duel_opponent_attempt(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- decline / cancel
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.decline_async_duel(p_duel_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  duel public.async_duels%ROWTYPE;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT * INTO duel FROM public.async_duels WHERE id = p_duel_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'DUEL_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;
  IF duel.opponent_id IS DISTINCT FROM v_user THEN
    RAISE EXCEPTION 'NOT_PARTICIPANT' USING ERRCODE = 'P0001';
  END IF;
  IF duel.status = 'declined' THEN
    RETURN jsonb_build_object('duelId', duel.id, 'status', 'declined', 'alreadyDeclined', true);
  END IF;
  IF duel.status <> 'awaiting_opponent' THEN
    RAISE EXCEPTION 'INVALID_DUEL_STATE' USING ERRCODE = 'P0001';
  END IF;

  PERFORM public.assert_async_duel_transition(duel.status, 'declined');
  UPDATE public.async_duels SET status = 'declined', updated_at = now() WHERE id = duel.id
  RETURNING * INTO duel;

  RETURN jsonb_build_object('duelId', duel.id, 'status', duel.status, 'alreadyDeclined', false);
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_async_duel(p_duel_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  duel public.async_duels%ROWTYPE;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT * INTO duel FROM public.async_duels WHERE id = p_duel_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'DUEL_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;
  IF duel.challenger_id IS DISTINCT FROM v_user THEN
    RAISE EXCEPTION 'NOT_PARTICIPANT' USING ERRCODE = 'P0001';
  END IF;
  IF duel.status = 'cancelled' THEN
    RETURN jsonb_build_object('duelId', duel.id, 'status', 'cancelled', 'alreadyCancelled', true);
  END IF;
  -- Cancel only before challenger completes (challenger_playing).
  IF duel.status <> 'challenger_playing' THEN
    RAISE EXCEPTION 'INVALID_DUEL_STATE' USING ERRCODE = 'P0001';
  END IF;

  PERFORM public.assert_async_duel_transition(duel.status, 'cancelled');
  UPDATE public.async_duels SET status = 'cancelled', updated_at = now() WHERE id = duel.id
  RETURNING * INTO duel;

  RETURN jsonb_build_object('duelId', duel.id, 'status', duel.status, 'alreadyCancelled', false);
END;
$$;

REVOKE ALL ON FUNCTION public.decline_async_duel(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cancel_async_duel(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.decline_async_duel(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_async_duel(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- Inbox / history / details / result (participant-safe, no seed)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.async_duel_public_participant(p_user_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'userId', p.id,
    'displayName', COALESCE(p.display_name::text, 'Blaze Player'),
    'profileFrameId', ec.profile_frame
  )
  FROM public.profiles p
  LEFT JOIN public.equipped_cosmetics ec ON ec.user_id = p.id
  WHERE p.id = p_user_id;
$$;

CREATE OR REPLACE FUNCTION public.get_async_duel_inbox(
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

  PERFORM public.expire_async_duels(now());

  SELECT COALESCE(jsonb_agg(row_to_json(x)::jsonb ORDER BY x.created_at DESC), '[]'::jsonb)
  INTO items
  FROM (
    SELECT
      d.id AS "duelId",
      public.async_duel_public_participant(d.challenger_id) AS challenger,
      CASE
        WHEN d.target_score_visibility THEN ca.score
        ELSE NULL
      END AS "challengerScore",
      d.rules_version AS "rulesVersion",
      d.deck_version AS "deckVersion",
      d.duration_seconds AS "durationSeconds",
      d.bust_limit AS "bustLimit",
      d.created_at AS "createdAt",
      d.expires_at AS "expiresAt",
      d.status,
      d.created_at
    FROM public.async_duels d
    LEFT JOIN public.async_duel_attempts ca
      ON ca.duel_id = d.id
     AND ca.participant_role = 'challenger'
     AND ca.status = 'completed'
    WHERE d.opponent_id = v_user
      AND d.status = 'awaiting_opponent'
      AND d.expires_at > now()
    ORDER BY d.created_at DESC
    LIMIT safe_limit
    OFFSET safe_offset
  ) x;

  RETURN jsonb_build_object(
    'items', items,
    'limit', safe_limit,
    'offset', safe_offset
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_async_duel_history(
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

  SELECT COALESCE(jsonb_agg(row_to_json(x)::jsonb ORDER BY x."updatedAt" DESC), '[]'::jsonb)
  INTO items
  FROM (
    SELECT
      d.id AS "duelId",
      d.status,
      d.outcome,
      d.winner_user_id AS "winnerUserId",
      CASE
        WHEN d.challenger_id = v_user THEN public.async_duel_public_participant(d.opponent_id)
        ELSE public.async_duel_public_participant(d.challenger_id)
      END AS opponent,
      ca.score AS "challengerScore",
      oa.score AS "opponentScore",
      d.challenger_completed_at AS "challengerCompletedAt",
      d.opponent_completed_at AS "opponentCompletedAt",
      d.settled_at AS "settledAt",
      d.updated_at AS "updatedAt"
    FROM public.async_duels d
    LEFT JOIN public.async_duel_attempts ca
      ON ca.duel_id = d.id AND ca.participant_role = 'challenger'
    LEFT JOIN public.async_duel_attempts oa
      ON oa.duel_id = d.id AND oa.participant_role = 'opponent'
    WHERE (d.challenger_id = v_user OR d.opponent_id = v_user)
      AND d.status IN ('completed', 'declined', 'cancelled', 'expired', 'invalid')
    ORDER BY d.updated_at DESC
    LIMIT safe_limit
    OFFSET safe_offset
  ) x;

  RETURN jsonb_build_object('items', items, 'limit', safe_limit, 'offset', safe_offset);
END;
$$;

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
    -- Seed intentionally omitted.
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_async_duel_result(p_duel_id uuid)
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

  RETURN jsonb_build_object(
    'duelId', duel.id,
    'status', duel.status,
    'outcome', duel.outcome,
    'winnerUserId', duel.winner_user_id,
    'decidingField', duel.deciding_field,
    'settledAt', duel.settled_at,
    'challengerResult', CASE WHEN ca.id IS NULL THEN NULL ELSE jsonb_build_object(
      'attemptId', ca.id,
      'score', ca.score,
      'exact21Count', ca.exact_21_count,
      'fiveCardClearCount', ca.five_card_clear_count,
      'bustCount', ca.bust_count,
      'cardsPlayed', ca.cards_played,
      'lanesCleared', ca.lanes_cleared,
      'completionMs', ca.completion_ms,
      'status', ca.status
    ) END,
    'opponentResult', CASE WHEN oa.id IS NULL THEN NULL ELSE jsonb_build_object(
      'attemptId', oa.id,
      'score', oa.score,
      'exact21Count', oa.exact_21_count,
      'fiveCardClearCount', oa.five_card_clear_count,
      'bustCount', oa.bust_count,
      'cardsPlayed', oa.cards_played,
      'lanesCleared', oa.lanes_cleared,
      'completionMs', oa.completion_ms,
      'status', oa.status
    ) END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_async_duel_inbox(integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_async_duel_history(integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_async_duel_details(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_async_duel_result(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
-- RLS: no direct table access for clients — participant data via RPCs only.
-- This prevents reading `seed` from a SELECT before opponent start.
ALTER TABLE public.async_duels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.async_duel_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS async_duels_select_participant ON public.async_duels;
DROP POLICY IF EXISTS async_duel_attempts_select_participant ON public.async_duel_attempts;

REVOKE ALL ON public.async_duels FROM authenticated, anon;
REVOKE ALL ON public.async_duel_attempts FROM authenticated, anon;

-- Service role retains full access for admin tooling / edge functions.

COMMENT ON TABLE public.async_duels IS
  'v1.4 Async Duel matches. Seed is server-generated; writes via SECURITY DEFINER RPCs only.';
COMMENT ON TABLE public.async_duel_attempts IS
  'One challenger and one opponent attempt per duel. No direct client writes.';
COMMENT ON FUNCTION public.create_async_duel(uuid) IS
  'Creates duel + challenger attempt transactionally. Client submits opponent id only.';
COMMENT ON FUNCTION public.complete_async_duel_attempt IS
  'Completes an attempt; opponent completion settles the duel once. No XP/coins in Phase 1.';
