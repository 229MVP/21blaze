-- Version 1.3A — Daily Challenge foundation
-- One UTC challenge per day, ranked + practice attempts, daily leaderboard view.

CREATE TABLE IF NOT EXISTS public.daily_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_date date NOT NULL,
  seed integer NOT NULL,
  rules_version integer NOT NULL DEFAULT 1,
  scoring_version integer NOT NULL DEFAULT 1,
  duration_seconds integer NOT NULL DEFAULT 120,
  status text NOT NULL DEFAULT 'active',
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT daily_challenges_status_check CHECK (
    status IN ('scheduled', 'active', 'closed')
  ),
  CONSTRAINT daily_challenges_date_unique UNIQUE (challenge_date)
);

CREATE INDEX IF NOT EXISTS daily_challenges_active_date_idx
  ON public.daily_challenges (challenge_date DESC);

CREATE TABLE IF NOT EXISTS public.daily_challenge_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id uuid NOT NULL REFERENCES public.daily_challenges (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  attempt_type text NOT NULL,
  status text NOT NULL DEFAULT 'created',
  started_at timestamptz,
  completed_at timestamptz,
  first_move_at timestamptz,
  verified_score integer,
  verified_clears integer,
  verified_exact_21_count integer,
  verified_five_card_clears integer,
  verified_bust_count integer,
  verified_multiplier integer,
  elapsed_time_ms integer,
  scoring_version integer,
  verification_status text,
  move_log jsonb,
  game_over_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT daily_challenge_attempts_type_check CHECK (
    attempt_type IN ('ranked', 'practice')
  ),
  CONSTRAINT daily_challenge_attempts_status_check CHECK (
    status IN ('created', 'started', 'completed', 'abandoned', 'rejected', 'expired')
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS daily_challenge_one_ranked_per_user_idx
  ON public.daily_challenge_attempts (challenge_id, user_id)
  WHERE attempt_type = 'ranked';

CREATE INDEX IF NOT EXISTS daily_challenge_attempts_user_idx
  ON public.daily_challenge_attempts (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS daily_challenge_attempts_challenge_ranked_idx
  ON public.daily_challenge_attempts (challenge_id, attempt_type, status, verified_score DESC)
  WHERE attempt_type = 'ranked' AND status = 'completed';

CREATE TABLE IF NOT EXISTS public.daily_challenge_streaks (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  current_streak integer NOT NULL DEFAULT 0,
  longest_streak integer NOT NULL DEFAULT 0,
  last_completed_date date,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE VIEW public.daily_challenge_leaderboard AS
SELECT
  a.challenge_id,
  c.challenge_date,
  a.user_id,
  p.display_name AS player_name,
  a.verified_score AS score,
  a.verified_clears AS lanes_cleared,
  a.verified_exact_21_count AS exact_21_count,
  a.verified_five_card_clears AS five_card_clears,
  a.verified_bust_count AS bust_count,
  a.verified_multiplier AS best_multiplier,
  a.elapsed_time_ms,
  a.completed_at,
  RANK() OVER (
    PARTITION BY a.challenge_id
    ORDER BY a.verified_score DESC, a.completed_at ASC
  )::integer AS rank
FROM public.daily_challenge_attempts a
JOIN public.daily_challenges c ON c.id = a.challenge_id
JOIN public.profiles p ON p.id = a.user_id
WHERE a.attempt_type = 'ranked'
  AND a.status = 'completed'
  AND a.verification_status = 'verified'
  AND a.verified_score IS NOT NULL;

ALTER TABLE public.daily_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_challenge_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_challenge_streaks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS daily_challenges_select ON public.daily_challenges;
CREATE POLICY daily_challenges_select ON public.daily_challenges
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS daily_challenge_attempts_select_own ON public.daily_challenge_attempts;
CREATE POLICY daily_challenge_attempts_select_own ON public.daily_challenge_attempts
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS daily_challenge_attempts_insert_own ON public.daily_challenge_attempts;
CREATE POLICY daily_challenge_attempts_insert_own ON public.daily_challenge_attempts
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS daily_challenge_attempts_update_own ON public.daily_challenge_attempts;
CREATE POLICY daily_challenge_attempts_update_own ON public.daily_challenge_attempts
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS daily_challenge_streaks_select_own ON public.daily_challenge_streaks;
CREATE POLICY daily_challenge_streaks_select_own ON public.daily_challenge_streaks
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS daily_challenge_streaks_insert_own ON public.daily_challenge_streaks;
CREATE POLICY daily_challenge_streaks_insert_own ON public.daily_challenge_streaks
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS daily_challenge_streaks_update_own ON public.daily_challenge_streaks;
CREATE POLICY daily_challenge_streaks_update_own ON public.daily_challenge_streaks
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Leaderboard rows are readable by authenticated users (display names only).
GRANT SELECT ON public.daily_challenge_leaderboard TO authenticated;

COMMENT ON TABLE public.daily_challenges IS
  'Server-authoritative UTC daily challenge definitions. Lazy-created on first access.';
COMMENT ON TABLE public.daily_challenge_attempts IS
  'Ranked (one per user per challenge) and unlimited practice attempts.';
COMMENT ON TABLE public.daily_challenge_streaks IS
  'Verified ranked completion streak tracked by UTC challenge date.';
