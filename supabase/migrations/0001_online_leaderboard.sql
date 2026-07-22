-- 21 Blaze online leaderboard schema
-- Safe to re-run: uses IF NOT EXISTS / OR REPLACE where practical.

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS citext WITH SCHEMA extensions;

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  display_name extensions.citext NOT NULL,
  avatar_seed integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT profiles_display_name_length CHECK (
    char_length(display_name::text) BETWEEN 3 AND 16
  ),
  CONSTRAINT profiles_display_name_format CHECK (
    display_name::text ~ '^[A-Za-z0-9_]+$'
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS profiles_display_name_unique_idx
  ON public.profiles (display_name);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_set_updated_at ON public.profiles;
CREATE TRIGGER profiles_set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  candidate text;
  suffix text;
  attempt integer := 0;
BEGIN
  LOOP
    suffix := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
    candidate := 'Blazer_' || suffix;
    BEGIN
      INSERT INTO public.profiles (id, display_name, avatar_seed)
      VALUES (
        NEW.id,
        candidate::extensions.citext,
        1 + (get_byte(decode(substr(md5(NEW.id::text), 1, 2), 'hex'), 0) % 32)
      );
      EXIT;
    EXCEPTION
      WHEN unique_violation THEN
        attempt := attempt + 1;
        IF attempt > 12 THEN
          RAISE;
        END IF;
    END;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Online matches
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.online_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  seed integer NOT NULL,
  status text NOT NULL DEFAULT 'active',
  started_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  completed_at timestamptz,
  client_version text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT online_matches_status_check CHECK (
    status IN ('active', 'completed', 'abandoned', 'rejected')
  )
);

CREATE INDEX IF NOT EXISTS online_matches_user_id_idx
  ON public.online_matches (user_id);

CREATE INDEX IF NOT EXISTS online_matches_status_idx
  ON public.online_matches (status);

CREATE INDEX IF NOT EXISTS online_matches_started_at_idx
  ON public.online_matches (started_at DESC);

CREATE INDEX IF NOT EXISTS online_matches_expires_at_idx
  ON public.online_matches (expires_at);

CREATE UNIQUE INDEX IF NOT EXISTS online_matches_one_active_per_user_idx
  ON public.online_matches (user_id)
  WHERE status = 'active';

-- ---------------------------------------------------------------------------
-- Verified scores
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.verified_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL UNIQUE REFERENCES public.online_matches (id),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  score integer NOT NULL,
  lanes_cleared integer NOT NULL,
  cards_played integer NOT NULL,
  busts integer NOT NULL,
  time_remaining_seconds integer NOT NULL,
  game_over_reason text NOT NULL,
  move_log jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT verified_scores_score_check CHECK (score >= 0),
  CONSTRAINT verified_scores_lanes_check CHECK (lanes_cleared >= 0),
  CONSTRAINT verified_scores_cards_check CHECK (cards_played BETWEEN 0 AND 52),
  CONSTRAINT verified_scores_busts_check CHECK (busts BETWEEN 0 AND 3),
  CONSTRAINT verified_scores_time_check CHECK (time_remaining_seconds BETWEEN 0 AND 120),
  CONSTRAINT verified_scores_reason_check CHECK (
    game_over_reason IN ('timeExpired', 'busts', 'deckEmpty')
  ),
  CONSTRAINT verified_scores_move_log_array_check CHECK (jsonb_typeof(move_log) = 'array')
);

CREATE INDEX IF NOT EXISTS verified_scores_score_desc_idx
  ON public.verified_scores (score DESC, lanes_cleared DESC, cards_played DESC, time_remaining_seconds DESC, created_at ASC);

CREATE INDEX IF NOT EXISTS verified_scores_user_id_created_idx
  ON public.verified_scores (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS verified_scores_created_at_idx
  ON public.verified_scores (created_at DESC);

-- ---------------------------------------------------------------------------
-- Global leaderboard (best score per player)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.global_leaderboard
WITH (security_invoker = true)
AS
WITH ranked_scores AS (
  SELECT
    vs.user_id,
    p.display_name::text AS display_name,
    vs.score,
    vs.lanes_cleared,
    vs.cards_played,
    vs.busts,
    vs.time_remaining_seconds,
    vs.game_over_reason,
    vs.created_at,
    row_number() OVER (
      PARTITION BY vs.user_id
      ORDER BY
        vs.score DESC,
        vs.lanes_cleared DESC,
        vs.cards_played DESC,
        vs.time_remaining_seconds DESC,
        vs.created_at ASC
    ) AS user_best_rank
  FROM public.verified_scores vs
  INNER JOIN public.profiles p ON p.id = vs.user_id
)
SELECT
  user_id,
  display_name,
  score,
  lanes_cleared,
  cards_played,
  busts,
  time_remaining_seconds,
  game_over_reason,
  created_at,
  row_number() OVER (
    ORDER BY
      score DESC,
      lanes_cleared DESC,
      cards_played DESC,
      time_remaining_seconds DESC,
      created_at ASC
  )::integer AS rank
FROM ranked_scores
WHERE user_best_rank = 1;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.online_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verified_scores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_authenticated" ON public.profiles;
CREATE POLICY "profiles_select_authenticated"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "online_matches_select_own" ON public.online_matches;
CREATE POLICY "online_matches_select_own"
  ON public.online_matches
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "verified_scores_select_authenticated" ON public.verified_scores;
CREATE POLICY "verified_scores_select_authenticated"
  ON public.verified_scores
  FOR SELECT
  TO authenticated
  USING (true);

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT ON public.online_matches TO authenticated;
GRANT SELECT ON public.verified_scores TO authenticated;
GRANT SELECT ON public.global_leaderboard TO authenticated;

REVOKE INSERT, DELETE ON public.profiles FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.online_matches FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.verified_scores FROM authenticated, anon;
REVOKE ALL ON public.profiles FROM anon;
REVOKE ALL ON public.online_matches FROM anon;
REVOKE ALL ON public.verified_scores FROM anon;
