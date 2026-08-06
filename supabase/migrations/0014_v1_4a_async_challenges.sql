-- Version 1.4A — Asynchronous player challenges (direct invite, shared seed)

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.async_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invite_code_hash text NOT NULL,
  creator_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  opponent_user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'open',
  seed integer NOT NULL,
  rules_version integer NOT NULL DEFAULT 1,
  scoring_version integer NOT NULL DEFAULT 1,
  duration_seconds integer NOT NULL DEFAULT 120,
  created_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  expires_at timestamptz NOT NULL,
  completed_at timestamptz,
  finalized_at timestamptz,
  winner_user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  result_type text,
  finalization_version integer NOT NULL DEFAULT 1,
  CONSTRAINT async_challenges_status_check CHECK (
    status IN (
      'open',
      'accepted',
      'in_progress',
      'awaiting_opponent',
      'verifying',
      'completed',
      'expired',
      'cancelled',
      'rejected'
    )
  ),
  CONSTRAINT async_challenges_result_type_check CHECK (
    result_type IS NULL OR result_type IN (
      'creator_win',
      'opponent_win',
      'draw',
      'expired',
      'cancelled',
      'invalid'
    )
  ),
  CONSTRAINT async_challenges_invite_hash_format CHECK (
    invite_code_hash ~ '^[a-f0-9]{64}$'
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS async_challenges_invite_code_hash_unique_idx
  ON public.async_challenges (invite_code_hash);

CREATE INDEX IF NOT EXISTS async_challenges_creator_status_idx
  ON public.async_challenges (creator_user_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS async_challenges_opponent_status_idx
  ON public.async_challenges (opponent_user_id, status, created_at DESC)
  WHERE opponent_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS async_challenges_expires_at_idx
  ON public.async_challenges (expires_at)
  WHERE status NOT IN ('completed', 'expired', 'cancelled', 'rejected');

CREATE TABLE IF NOT EXISTS public.async_challenge_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id uuid NOT NULL REFERENCES public.async_challenges (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'created',
  started_at timestamptz,
  first_move_at timestamptz,
  completed_at timestamptz,
  verification_status text NOT NULL DEFAULT 'pending',
  verified_score integer,
  verified_exact_21_count integer,
  verified_five_card_clears integer,
  verified_bust_count integer,
  verified_multiplier integer,
  verified_elapsed_time integer,
  verified_clears integer,
  rules_version integer,
  scoring_version integer,
  move_log jsonb,
  game_over_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT async_challenge_attempts_status_check CHECK (
    status IN ('created', 'started', 'completed', 'abandoned', 'expired', 'rejected')
  ),
  CONSTRAINT async_challenge_attempts_verification_check CHECK (
    verification_status IN ('pending', 'verified', 'rejected', 'failed')
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS async_challenge_one_attempt_per_user_idx
  ON public.async_challenge_attempts (challenge_id, user_id);

CREATE INDEX IF NOT EXISTS async_challenge_attempts_challenge_idx
  ON public.async_challenge_attempts (challenge_id, status);

CREATE TABLE IF NOT EXISTS public.async_challenge_rate_limits (
  actor_key text NOT NULL,
  action_type text NOT NULL,
  window_key text NOT NULL,
  attempt_count integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (actor_key, action_type, window_key)
);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.hash_async_invite_code(p_normalized_code text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = public, extensions
AS $$
  SELECT encode(extensions.digest(p_normalized_code, 'sha256'), 'hex');
$$;

CREATE OR REPLACE FUNCTION public.compare_async_verified_attempts(
  p_score_a integer,
  p_exact21_a integer,
  p_five_card_a integer,
  p_bust_a integer,
  p_multiplier_a integer,
  p_elapsed_a integer,
  p_score_b integer,
  p_exact21_b integer,
  p_five_card_b integer,
  p_bust_b integer,
  p_multiplier_b integer,
  p_elapsed_b integer
)
RETURNS integer
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_score_a IS DISTINCT FROM p_score_b THEN
      CASE WHEN p_score_a > p_score_b THEN 1 ELSE -1 END
    WHEN p_exact21_a IS DISTINCT FROM p_exact21_b THEN
      CASE WHEN p_exact21_a > p_exact21_b THEN 1 ELSE -1 END
    WHEN p_five_card_a IS DISTINCT FROM p_five_card_b THEN
      CASE WHEN p_five_card_a > p_five_card_b THEN 1 ELSE -1 END
    WHEN p_bust_a IS DISTINCT FROM p_bust_b THEN
      CASE WHEN p_bust_a < p_bust_b THEN 1 ELSE -1 END
    WHEN p_multiplier_a IS DISTINCT FROM p_multiplier_b THEN
      CASE WHEN p_multiplier_a > p_multiplier_b THEN 1 ELSE -1 END
    WHEN COALESCE(p_elapsed_a, 2147483647) IS DISTINCT FROM COALESCE(p_elapsed_b, 2147483647) THEN
      CASE WHEN COALESCE(p_elapsed_a, 2147483647) < COALESCE(p_elapsed_b, 2147483647) THEN 1 ELSE -1 END
    ELSE 0
  END;
$$;

-- ---------------------------------------------------------------------------
-- Expire stale challenges (lazy, server time)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.finalize_expired_async_challenges()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
BEGIN
  UPDATE public.async_challenges
  SET
    status = 'expired',
    result_type = 'expired',
    finalized_at = now(),
    completed_at = COALESCE(completed_at, now())
  WHERE status IN ('open', 'accepted', 'in_progress', 'awaiting_opponent')
    AND expires_at < now();

  GET DIAGNOSTICS v_count = ROW_COUNT;

  UPDATE public.async_challenge_attempts a
  SET
    status = 'expired',
    updated_at = now()
  FROM public.async_challenges c
  WHERE a.challenge_id = c.id
    AND c.status = 'expired'
    AND a.status IN ('created', 'started');

  RETURN v_count;
END;
$$;

-- ---------------------------------------------------------------------------
-- Rate limit helper (service role / edge only)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_async_challenge_rate_limit(
  p_actor_key text,
  p_action_type text,
  p_window_key text,
  p_max_attempts integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  INSERT INTO public.async_challenge_rate_limits AS rl (
    actor_key,
    action_type,
    window_key,
    attempt_count,
    updated_at
  )
  VALUES (p_actor_key, p_action_type, p_window_key, 1, now())
  ON CONFLICT (actor_key, action_type, window_key)
  DO UPDATE SET
    attempt_count = CASE
      WHEN rl.updated_at < now() - interval '1 day' AND p_window_key LIKE 'utc:%'
        THEN 1
      WHEN rl.updated_at < now() - interval '1 hour' AND p_window_key NOT LIKE 'utc:%'
        THEN 1
      ELSE rl.attempt_count + 1
    END,
    updated_at = now()
  RETURNING attempt_count INTO v_count;

  RETURN v_count <= p_max_attempts;
END;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.async_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.async_challenge_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.async_challenge_rate_limits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS async_challenges_select_participant ON public.async_challenges;
CREATE POLICY async_challenges_select_participant ON public.async_challenges
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = creator_user_id OR auth.uid() = opponent_user_id
  );

DROP POLICY IF EXISTS async_challenge_attempts_select_own ON public.async_challenge_attempts;
CREATE POLICY async_challenge_attempts_select_own ON public.async_challenge_attempts
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- No direct INSERT/UPDATE for clients — Edge Function uses service role.

REVOKE ALL ON public.async_challenge_rate_limits FROM authenticated, anon;
GRANT SELECT ON public.async_challenges TO authenticated;
GRANT SELECT ON public.async_challenge_attempts TO authenticated;

COMMENT ON TABLE public.async_challenges IS
  'Version 1.4A async duel challenges. Authoritative seed and lifecycle via Edge Function.';
COMMENT ON TABLE public.async_challenge_attempts IS
  'One official attempt per participant. Private move logs; opponent stats gated server-side.';
