-- Version 1.3.0 Phase 1 — Daily Challenge RPC foundation
-- Server-authoritative start/complete, hardened RLS, authoritative seed text.

-- ---------------------------------------------------------------------------
-- Schema extensions (non-destructive)
-- ---------------------------------------------------------------------------
ALTER TABLE public.daily_challenges
  ADD COLUMN IF NOT EXISTS deck_version text,
  ADD COLUMN IF NOT EXISTS bust_limit integer,
  ADD COLUMN IF NOT EXISTS authoritative_seed text,
  ADD COLUMN IF NOT EXISTS published_at timestamptz;

UPDATE public.daily_challenges
SET
  deck_version = COALESCE(deck_version, '1'),
  bust_limit = COALESCE(bust_limit, 3),
  authoritative_seed = COALESCE(
    authoritative_seed,
    '21blaze-daily-v1:' || challenge_date::text
  ),
  published_at = COALESCE(published_at, starts_at)
WHERE deck_version IS NULL
   OR bust_limit IS NULL
   OR authoritative_seed IS NULL
   OR published_at IS NULL;

ALTER TABLE public.daily_challenges
  ALTER COLUMN deck_version SET DEFAULT '1',
  ALTER COLUMN bust_limit SET DEFAULT 3;

ALTER TABLE public.daily_challenges
  ALTER COLUMN deck_version SET NOT NULL,
  ALTER COLUMN bust_limit SET NOT NULL;

ALTER TABLE public.daily_challenges
  DROP CONSTRAINT IF EXISTS daily_challenges_status_check;

ALTER TABLE public.daily_challenges
  ADD CONSTRAINT daily_challenges_status_check CHECK (
    status IN ('scheduled', 'active', 'published', 'closed')
  );

ALTER TABLE public.daily_challenge_attempts
  ADD COLUMN IF NOT EXISTS cards_played integer,
  ADD COLUMN IF NOT EXISTS rules_version text,
  ADD COLUMN IF NOT EXISTS submission_version text;

ALTER TABLE public.daily_challenge_attempts
  DROP CONSTRAINT IF EXISTS daily_challenge_attempts_status_check;

ALTER TABLE public.daily_challenge_attempts
  ADD CONSTRAINT daily_challenge_attempts_status_check CHECK (
    status IN (
      'created',
      'started',
      'completed',
      'abandoned',
      'rejected',
      'expired',
      'invalid'
    )
  );

-- ---------------------------------------------------------------------------
-- Deterministic seed helpers (must match src/game/challenge/seedDerivation.ts)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.derive_daily_challenge_authoritative_seed(p_date date)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT '21blaze-daily-v1:' || p_date::text;
$$;

CREATE OR REPLACE FUNCTION public.derive_daily_challenge_numeric_seed(p_input text)
RETURNS integer
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  hash bigint := 2166136261;
  i integer;
  ch integer;
BEGIN
  FOR i IN 1 .. length(p_input) LOOP
    ch := ascii(substr(p_input, i, 1));
    hash := (hash # ch) & 4294967295;
    hash := (hash * 16777619) & 4294967295;
  END LOOP;
  RETURN (hash % 2147483648)::integer;
END;
$$;

CREATE OR REPLACE FUNCTION public.utc_challenge_date(p_now timestamptz DEFAULT now())
RETURNS date
LANGUAGE sql
STABLE
AS $$
  SELECT (p_now AT TIME ZONE 'utc')::date;
$$;

-- ---------------------------------------------------------------------------
-- Ensure today's challenge exists (service / RPC internal)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ensure_daily_challenge_for_date(p_date date)
RETURNS public.daily_challenges
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  existing public.daily_challenges%ROWTYPE;
  auth_seed text;
  numeric_seed integer;
  starts timestamptz;
  ends timestamptz;
BEGIN
  SELECT * INTO existing
  FROM public.daily_challenges
  WHERE challenge_date = p_date;

  IF FOUND THEN
    RETURN existing;
  END IF;

  auth_seed := public.derive_daily_challenge_authoritative_seed(p_date);
  numeric_seed := public.derive_daily_challenge_numeric_seed(auth_seed);
  starts := (p_date::text || 'T00:00:00+00')::timestamptz;
  ends := starts + interval '1 day';

  INSERT INTO public.daily_challenges (
    challenge_date,
    seed,
    authoritative_seed,
    rules_version,
    scoring_version,
    deck_version,
    duration_seconds,
    bust_limit,
    status,
    starts_at,
    ends_at,
    published_at
  )
  VALUES (
    p_date,
    numeric_seed,
    auth_seed,
    1,
    1,
    '1',
    120,
    3,
    'active',
    starts,
    ends,
    now()
  )
  ON CONFLICT (challenge_date) DO NOTHING;

  SELECT * INTO existing
  FROM public.daily_challenges
  WHERE challenge_date = p_date;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'unable_to_ensure_daily_challenge';
  END IF;

  RETURN existing;
END;
$$;

-- ---------------------------------------------------------------------------
-- Read today's challenge (no seed)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_today_daily_challenge()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_today date := public.utc_challenge_date();
  challenge public.daily_challenges%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  challenge := public.ensure_daily_challenge_for_date(v_today);

  IF challenge.status NOT IN ('active', 'published') THEN
    RAISE EXCEPTION 'challenge_not_available';
  END IF;

  RETURN jsonb_build_object(
    'id', challenge.id,
    'challengeDate', challenge.challenge_date,
    'rulesVersion', challenge.rules_version::text,
    'deckVersion', challenge.deck_version,
    'durationSeconds', challenge.duration_seconds,
    'bustLimit', challenge.bust_limit,
    'status', challenge.status
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- Start ranked daily challenge (idempotent for in-progress attempts)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.start_daily_challenge()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_today date := public.utc_challenge_date();
  challenge public.daily_challenges%ROWTYPE;
  attempt public.daily_challenge_attempts%ROWTYPE;
  now_ts timestamptz := now();
  resumed boolean := false;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  challenge := public.ensure_daily_challenge_for_date(v_today);

  IF challenge.status NOT IN ('active', 'published') THEN
    RETURN jsonb_build_object('error', 'CHALLENGE_DISABLED');
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(v_user_id::text || ':' || challenge.id::text, 0)
  );

  SELECT * INTO attempt
  FROM public.daily_challenge_attempts
  WHERE challenge_id = challenge.id
    AND user_id = v_user_id
    AND attempt_type = 'ranked'
  FOR UPDATE;

  IF NOT FOUND THEN
    BEGIN
      INSERT INTO public.daily_challenge_attempts (
        challenge_id,
        user_id,
        attempt_type,
        status,
        started_at,
        scoring_version,
        rules_version,
        created_at
      )
      VALUES (
        challenge.id,
        v_user_id,
        'ranked',
        'started',
        now_ts,
        challenge.scoring_version,
        challenge.rules_version::text,
        now_ts
      )
      RETURNING * INTO attempt;
    EXCEPTION
      WHEN unique_violation THEN
        SELECT * INTO attempt
        FROM public.daily_challenge_attempts
        WHERE challenge_id = challenge.id
          AND user_id = v_user_id
          AND attempt_type = 'ranked'
        FOR UPDATE;
        resumed := true;
    END;
  ELSE
    resumed := true;
  END IF;

  IF attempt.status = 'completed' THEN
    RETURN jsonb_build_object('error', 'ALREADY_PLAYED');
  END IF;

  IF attempt.status IN ('abandoned', 'rejected', 'expired', 'invalid') THEN
    RETURN jsonb_build_object('error', 'ATTEMPT_NOT_AVAILABLE');
  END IF;

  IF attempt.status = 'created' THEN
    UPDATE public.daily_challenge_attempts
    SET
      status = 'started',
      started_at = COALESCE(attempt.started_at, now_ts),
      rules_version = challenge.rules_version::text
    WHERE id = attempt.id
    RETURNING * INTO attempt;
    resumed := true;
  END IF;

  RETURN jsonb_build_object(
    'attemptId', attempt.id,
    'challengeId', challenge.id,
    'challengeDate', challenge.challenge_date,
    'seed', challenge.authoritative_seed,
    'rulesVersion', challenge.rules_version::text,
    'deckVersion', challenge.deck_version,
    'durationSeconds', challenge.duration_seconds,
    'bustLimit', challenge.bust_limit,
    'startedAt', attempt.started_at,
    'resumed', resumed
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- Complete ranked attempt (architecture for future full replay validation)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.complete_daily_challenge(
  p_attempt_id uuid,
  p_score integer,
  p_exact_21_count integer,
  p_five_card_clear_count integer,
  p_bust_count integer,
  p_cards_played integer,
  p_completion_ms integer,
  p_rules_version text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  attempt public.daily_challenge_attempts%ROWTYPE;
  challenge public.daily_challenges%ROWTYPE;
  max_completion_ms integer := (120 + 30) * 1000;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF p_attempt_id IS NULL THEN
    RAISE EXCEPTION 'attempt_id_required';
  END IF;

  SELECT * INTO attempt
  FROM public.daily_challenge_attempts
  WHERE id = p_attempt_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'attempt_not_found';
  END IF;

  IF attempt.user_id IS DISTINCT FROM v_user_id THEN
    RAISE EXCEPTION 'attempt_not_owned';
  END IF;

  SELECT * INTO challenge
  FROM public.daily_challenges
  WHERE id = attempt.challenge_id;

  IF attempt.status = 'completed' THEN
    RETURN jsonb_build_object(
      'alreadyCompleted', true,
      'attemptId', attempt.id,
      'score', attempt.verified_score,
      'exact21Count', attempt.verified_exact_21_count,
      'fiveCardClearCount', attempt.verified_five_card_clears,
      'bustCount', attempt.verified_bust_count,
      'completionMs', attempt.elapsed_time_ms,
      'rulesVersion', attempt.scoring_version::text
    );
  END IF;

  IF attempt.status <> 'started' AND attempt.status <> 'created' THEN
    RAISE EXCEPTION 'attempt_not_active';
  END IF;

  IF challenge.challenge_date <> public.utc_challenge_date() THEN
    RAISE EXCEPTION 'challenge_date_mismatch';
  END IF;

  IF p_rules_version IS DISTINCT FROM challenge.rules_version::text THEN
    RAISE EXCEPTION 'rules_version_mismatch';
  END IF;

  IF p_score IS NULL OR p_score < 0 THEN
    RAISE EXCEPTION 'invalid_score';
  END IF;

  IF COALESCE(p_exact_21_count, 0) < 0
     OR COALESCE(p_five_card_clear_count, 0) < 0
     OR COALESCE(p_bust_count, 0) < 0
     OR COALESCE(p_cards_played, 0) < 0
     OR COALESCE(p_completion_ms, 0) < 0 THEN
    RAISE EXCEPTION 'invalid_counters';
  END IF;

  IF p_completion_ms IS NOT NULL AND p_completion_ms > max_completion_ms THEN
    RAISE EXCEPTION 'completion_time_implausible';
  END IF;

  UPDATE public.daily_challenge_attempts
  SET
    status = 'completed',
    completed_at = now(),
    verified_score = p_score,
    verified_exact_21_count = COALESCE(p_exact_21_count, 0),
    verified_five_card_clears = COALESCE(p_five_card_clear_count, 0),
    verified_bust_count = COALESCE(p_bust_count, 0),
    cards_played = COALESCE(p_cards_played, 0),
    elapsed_time_ms = COALESCE(p_completion_ms, 0),
    scoring_version = challenge.scoring_version,
    rules_version = challenge.rules_version::text,
    verification_status = 'pending'
  WHERE id = attempt.id
  RETURNING * INTO attempt;

  RETURN jsonb_build_object(
    'alreadyCompleted', false,
    'attemptId', attempt.id,
    'score', attempt.verified_score,
    'exact21Count', attempt.verified_exact_21_count,
    'fiveCardClearCount', attempt.verified_five_card_clears,
    'bustCount', attempt.verified_bust_count,
    'completionMs', attempt.elapsed_time_ms,
    'rulesVersion', attempt.scoring_version::text,
    'verificationStatus', attempt.verification_status
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- RLS hardening — attempts writable only via SECURITY DEFINER RPCs
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS daily_challenge_attempts_insert_own ON public.daily_challenge_attempts;
DROP POLICY IF EXISTS daily_challenge_attempts_update_own ON public.daily_challenge_attempts;

DROP POLICY IF EXISTS daily_challenges_select ON public.daily_challenges;
CREATE POLICY daily_challenges_select ON public.daily_challenges
  FOR SELECT
  TO authenticated
  USING (status IN ('active', 'published'));

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.ensure_daily_challenge_for_date(date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_today_daily_challenge() TO authenticated;
GRANT EXECUTE ON FUNCTION public.start_daily_challenge() TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_daily_challenge(
  uuid, integer, integer, integer, integer, integer, integer, text
) TO authenticated;

COMMENT ON FUNCTION public.start_daily_challenge IS
  'Starts or resumes the authenticated user ranked attempt for today UTC challenge. Never accepts client seed.';
COMMENT ON FUNCTION public.complete_daily_challenge IS
  'Completes a ranked attempt once; idempotent when already completed. Full replay validation deferred.';
