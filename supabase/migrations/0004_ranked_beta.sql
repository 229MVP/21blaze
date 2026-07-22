-- 21 Blaze Ranked Beta 0.4
-- Safe to re-run where practical.

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- ---------------------------------------------------------------------------
-- Extend live match / queue modes for ranked
-- ---------------------------------------------------------------------------
ALTER TABLE public.live_matches
  DROP CONSTRAINT IF EXISTS live_matches_mode_check;

ALTER TABLE public.live_matches
  ADD CONSTRAINT live_matches_mode_check
  CHECK (mode IN ('friend', 'quick_match', 'ranked'));

ALTER TABLE public.matchmaking_queue
  DROP CONSTRAINT IF EXISTS matchmaking_queue_mode_check;

ALTER TABLE public.matchmaking_queue
  ADD CONSTRAINT matchmaking_queue_mode_check
  CHECK (mode IN ('casual', 'ranked'));

ALTER TABLE public.matchmaking_queue
  ADD COLUMN IF NOT EXISTS season_id uuid;

ALTER TABLE public.matchmaking_queue
  ADD COLUMN IF NOT EXISTS rating_snapshot integer;

ALTER TABLE public.matchmaking_queue
  ADD COLUMN IF NOT EXISTS placement_status text;

ALTER TABLE public.matchmaking_queue
  ADD COLUMN IF NOT EXISTS rating_range_at_join integer;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS ranked_suspended_until timestamptz;

-- ---------------------------------------------------------------------------
-- Seasons
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ranked_seasons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  status text NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ranked_seasons_status_check CHECK (
    status IN ('upcoming', 'active', 'completed', 'archived')
  ),
  CONSTRAINT ranked_seasons_window_check CHECK (ends_at > starts_at)
);

CREATE UNIQUE INDEX IF NOT EXISTS ranked_seasons_one_active_idx
  ON public.ranked_seasons ((status))
  WHERE status = 'active';

-- ---------------------------------------------------------------------------
-- Player rankings
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.player_rankings (
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  season_id uuid NOT NULL REFERENCES public.ranked_seasons (id) ON DELETE CASCADE,
  rating integer NOT NULL DEFAULT 1200,
  placement_matches_completed integer NOT NULL DEFAULT 0,
  ranked_matches_played integer NOT NULL DEFAULT 0,
  wins integer NOT NULL DEFAULT 0,
  losses integer NOT NULL DEFAULT 0,
  draws integer NOT NULL DEFAULT 0,
  current_win_streak integer NOT NULL DEFAULT 0,
  longest_win_streak integer NOT NULL DEFAULT 0,
  peak_rating integer NOT NULL DEFAULT 1200,
  current_division text NOT NULL DEFAULT 'unranked',
  peak_division text NOT NULL DEFAULT 'unranked',
  last_ranked_match_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, season_id),
  CONSTRAINT player_rankings_rating_check CHECK (rating >= 100),
  CONSTRAINT player_rankings_placement_check CHECK (
    placement_matches_completed BETWEEN 0 AND 5
  ),
  CONSTRAINT player_rankings_played_check CHECK (ranked_matches_played >= 0),
  CONSTRAINT player_rankings_wins_check CHECK (wins >= 0),
  CONSTRAINT player_rankings_losses_check CHECK (losses >= 0),
  CONSTRAINT player_rankings_draws_check CHECK (draws >= 0),
  CONSTRAINT player_rankings_totals_check CHECK (
    wins + losses + draws <= ranked_matches_played
  ),
  CONSTRAINT player_rankings_streak_check CHECK (current_win_streak >= 0),
  CONSTRAINT player_rankings_longest_streak_check CHECK (
    longest_win_streak >= current_win_streak
  ),
  CONSTRAINT player_rankings_division_check CHECK (
    current_division IN (
      'unranked', 'ember', 'spark', 'flame', 'inferno', 'blaze', 'blaze_elite'
    )
  ),
  CONSTRAINT player_rankings_peak_division_check CHECK (
    peak_division IN (
      'unranked', 'ember', 'spark', 'flame', 'inferno', 'blaze', 'blaze_elite'
    )
  )
);

CREATE INDEX IF NOT EXISTS player_rankings_season_rating_idx
  ON public.player_rankings (season_id, rating DESC, wins DESC, losses ASC);

CREATE INDEX IF NOT EXISTS player_rankings_user_idx
  ON public.player_rankings (user_id, season_id);

CREATE INDEX IF NOT EXISTS player_rankings_last_match_idx
  ON public.player_rankings (last_ranked_match_at DESC NULLS LAST);

DROP TRIGGER IF EXISTS player_rankings_set_updated_at ON public.player_rankings;
CREATE TRIGGER player_rankings_set_updated_at
  BEFORE UPDATE ON public.player_rankings
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Ranked match results
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ranked_match_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL UNIQUE REFERENCES public.live_matches (id) ON DELETE CASCADE,
  season_id uuid NOT NULL REFERENCES public.ranked_seasons (id),
  player_one_user_id uuid NOT NULL REFERENCES auth.users (id),
  player_two_user_id uuid NOT NULL REFERENCES auth.users (id),
  winner_user_id uuid REFERENCES auth.users (id),
  result_type text NOT NULL,
  player_one_rating_before integer NOT NULL,
  player_one_rating_after integer NOT NULL,
  player_one_rating_change integer NOT NULL,
  player_two_rating_before integer NOT NULL,
  player_two_rating_after integer NOT NULL,
  player_two_rating_change integer NOT NULL,
  player_one_verified_score integer NOT NULL,
  player_two_verified_score integer NOT NULL,
  rating_processed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ranked_match_results_type_check CHECK (
    result_type IN (
      'player_one_win',
      'player_two_win',
      'draw',
      'player_one_forfeit',
      'player_two_forfeit',
      'no_contest'
    )
  )
);

CREATE INDEX IF NOT EXISTS ranked_match_results_season_idx
  ON public.ranked_match_results (season_id, created_at DESC);

CREATE INDEX IF NOT EXISTS ranked_match_results_p1_idx
  ON public.ranked_match_results (player_one_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS ranked_match_results_p2_idx
  ON public.ranked_match_results (player_two_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS ranked_match_results_pair_idx
  ON public.ranked_match_results (player_one_user_id, player_two_user_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- Integrity flags (server-only)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ranked_integrity_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid REFERENCES public.live_matches (id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users (id) ON DELETE CASCADE,
  flag_type text NOT NULL,
  severity text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ranked_integrity_flags_severity_check CHECK (
    severity IN ('low', 'medium', 'high')
  )
);

CREATE INDEX IF NOT EXISTS ranked_integrity_flags_user_idx
  ON public.ranked_integrity_flags (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS ranked_integrity_flags_match_idx
  ON public.ranked_integrity_flags (match_id);

-- ---------------------------------------------------------------------------
-- FK for queue season after ranked_seasons exists
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'matchmaking_queue_season_id_fkey'
  ) THEN
    ALTER TABLE public.matchmaking_queue
      ADD CONSTRAINT matchmaking_queue_season_id_fkey
      FOREIGN KEY (season_id) REFERENCES public.ranked_seasons (id);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Initial season (idempotent)
-- ---------------------------------------------------------------------------
INSERT INTO public.ranked_seasons (name, slug, status, starts_at, ends_at)
SELECT
  '21 Blaze Beta Season',
  'beta-season-1',
  'active',
  now() - interval '1 day',
  now() + interval '90 days'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ranked_seasons WHERE slug = 'beta-season-1'
);

-- ---------------------------------------------------------------------------
-- Division helper (mirrors src/ranked/divisions.ts)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ranked_division_for(
  p_rating integer,
  p_placements integer
)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF p_placements < 5 THEN
    RETURN 'unranked';
  END IF;
  IF p_rating >= 1700 THEN
    RETURN 'blaze_elite';
  END IF;
  IF p_rating >= 1500 THEN
    RETURN 'blaze';
  END IF;
  IF p_rating >= 1300 THEN
    RETURN 'inferno';
  END IF;
  IF p_rating >= 1100 THEN
    RETURN 'flame';
  END IF;
  IF p_rating >= 900 THEN
    RETURN 'spark';
  END IF;
  RETURN 'ember';
END;
$$;

CREATE OR REPLACE FUNCTION public.ranked_k_factor(
  p_placements integer,
  p_matches_played integer
)
RETURNS integer
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF p_placements < 5 THEN
    RETURN 40;
  END IF;
  IF p_matches_played >= 100 THEN
    RETURN 16;
  END IF;
  RETURN 24;
END;
$$;

CREATE OR REPLACE FUNCTION public.ranked_expected_score(
  rating_a integer,
  rating_b integer
)
RETURNS double precision
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT 1.0 / (1.0 + power(10.0, ((rating_b - rating_a)::double precision / 400.0)));
$$;

-- ---------------------------------------------------------------------------
-- Leaderboard view
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.ranked_season_leaderboard
WITH (security_invoker = true)
AS
SELECT
  row_number() OVER (
    PARTITION BY pr.season_id
    ORDER BY
      pr.rating DESC,
      pr.wins DESC,
      pr.losses ASC,
      pr.peak_rating DESC,
      pr.last_ranked_match_at ASC NULLS LAST
  )::integer AS rank,
  pr.season_id,
  pr.user_id,
  p.display_name::text AS display_name,
  pr.rating,
  pr.current_division,
  pr.placement_matches_completed,
  pr.ranked_matches_played,
  pr.wins,
  pr.losses,
  pr.draws,
  pr.current_win_streak,
  pr.peak_rating,
  pr.peak_division,
  pr.last_ranked_match_at
FROM public.player_rankings pr
INNER JOIN public.profiles p ON p.id = pr.user_id
WHERE pr.placement_matches_completed >= 5;

-- ---------------------------------------------------------------------------
-- ensure ranking row
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ensure_player_ranking(
  p_user_id uuid,
  p_season_id uuid
)
RETURNS public.player_rankings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  row public.player_rankings;
BEGIN
  INSERT INTO public.player_rankings (user_id, season_id)
  VALUES (p_user_id, p_season_id)
  ON CONFLICT (user_id, season_id) DO NOTHING;

  SELECT * INTO row
  FROM public.player_rankings
  WHERE user_id = p_user_id AND season_id = p_season_id
  FOR UPDATE;

  RETURN row;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_player_ranking(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_player_ranking(uuid, uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- Ranked matchmaker
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.try_create_ranked_match(
  requesting_user_id uuid,
  requesting_region text,
  requesting_game_rules_version text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  season public.ranked_seasons%ROWTYPE;
  requester public.matchmaking_queue%ROWTYPE;
  opponent public.matchmaking_queue%ROWTYPE;
  req_ranking public.player_rankings%ROWTYPE;
  opp_ranking public.player_rankings%ROWTYPE;
  wait_seconds integer;
  rating_range integer;
  prefer_same_region boolean;
  found_opponent boolean := false;
  new_match_id uuid;
  room_code text;
  seed integer;
  acceptance_deadline timestamptz;
  match_expires timestamptz;
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  i integer;
  seat1_user uuid;
  seat2_user uuid;
  seat1_name text;
  seat2_name text;
  seat1_queue uuid;
  seat2_queue uuid;
  req_name text;
  opp_name text;
BEGIN
  SELECT * INTO season
  FROM public.ranked_seasons
  WHERE status = 'active'
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = requesting_user_id
      AND ranked_suspended_until IS NOT NULL
      AND ranked_suspended_until > now()
  ) THEN
    RETURN NULL;
  END IF;

  UPDATE public.matchmaking_queue
  SET status = 'expired', cancelled_at = COALESCE(cancelled_at, now())
  WHERE status = 'queued'
    AND mode = 'ranked'
    AND expires_at <= now();

  SELECT * INTO requester
  FROM public.matchmaking_queue
  WHERE user_id = requesting_user_id
    AND mode = 'ranked'
    AND status = 'queued'
    AND expires_at > now()
  ORDER BY queued_at ASC
  FOR UPDATE SKIP LOCKED
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF requester.match_id IS NOT NULL THEN
    RETURN requester.match_id;
  END IF;

  req_ranking := public.ensure_player_ranking(requesting_user_id, season.id);
  wait_seconds := GREATEST(0, EXTRACT(EPOCH FROM (now() - requester.queued_at))::integer);

  IF wait_seconds < 10 THEN
    rating_range := 100;
  ELSIF wait_seconds < 20 THEN
    rating_range := 200;
  ELSIF wait_seconds < 30 THEN
    rating_range := 300;
  ELSIF wait_seconds < 45 THEN
    rating_range := 450;
  ELSE
    rating_range := 100000;
  END IF;

  prefer_same_region :=
    wait_seconds < 60
    AND requesting_region IS NOT NULL
    AND requesting_region <> 'unknown';

  -- Prefer other placement players when requester is still placing.
  IF req_ranking.placement_matches_completed < 5 THEN
    SELECT q.* INTO opponent
    FROM public.matchmaking_queue q
    INNER JOIN public.player_rankings pr
      ON pr.user_id = q.user_id AND pr.season_id = season.id
    WHERE q.status = 'queued'
      AND q.mode = 'ranked'
      AND q.expires_at > now()
      AND q.user_id <> requesting_user_id
      AND q.game_rules_version = requesting_game_rules_version
      AND q.season_id = season.id
      AND pr.placement_matches_completed < 5
      AND abs(COALESCE(q.rating_snapshot, 1200) - COALESCE(requester.rating_snapshot, 1200)) <= rating_range
      AND (
        NOT prefer_same_region
        OR q.region IS NOT DISTINCT FROM requesting_region
        OR q.region IS NULL
        OR q.region = 'unknown'
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = q.user_id
          AND p.ranked_suspended_until IS NOT NULL
          AND p.ranked_suspended_until > now()
      )
    ORDER BY q.queued_at ASC
    FOR UPDATE OF q SKIP LOCKED
    LIMIT 1;

    IF FOUND THEN
      found_opponent := true;
    END IF;
  END IF;

  IF NOT found_opponent THEN
    SELECT q.* INTO opponent
    FROM public.matchmaking_queue q
    WHERE q.status = 'queued'
      AND q.mode = 'ranked'
      AND q.expires_at > now()
      AND q.user_id <> requesting_user_id
      AND q.game_rules_version = requesting_game_rules_version
      AND q.season_id = season.id
      AND abs(COALESCE(q.rating_snapshot, 1200) - COALESCE(requester.rating_snapshot, 1200)) <= rating_range
      AND (
        NOT prefer_same_region
        OR q.region IS NOT DISTINCT FROM requesting_region
        OR q.region IS NULL
        OR q.region = 'unknown'
        OR wait_seconds >= 60
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = q.user_id
          AND p.ranked_suspended_until IS NOT NULL
          AND p.ranked_suspended_until > now()
      )
    ORDER BY q.queued_at ASC
    FOR UPDATE OF q SKIP LOCKED
    LIMIT 1;

    IF FOUND THEN
      found_opponent := true;
    END IF;
  END IF;

  IF NOT found_opponent THEN
    RETURN NULL;
  END IF;

  opp_ranking := public.ensure_player_ranking(opponent.user_id, season.id);

  IF requester.queued_at <= opponent.queued_at THEN
    seat1_user := requester.user_id;
    seat2_user := opponent.user_id;
    seat1_queue := requester.id;
    seat2_queue := opponent.id;
  ELSE
    seat1_user := opponent.user_id;
    seat2_user := requester.user_id;
    seat1_queue := opponent.id;
    seat2_queue := requester.id;
  END IF;

  SELECT display_name::text INTO req_name FROM public.profiles WHERE id = requester.user_id;
  SELECT display_name::text INTO opp_name FROM public.profiles WHERE id = opponent.user_id;

  IF seat1_user = requester.user_id THEN
    seat1_name := COALESCE(req_name, 'Blazer');
    seat2_name := COALESCE(opp_name, 'Blazer');
  ELSE
    seat1_name := COALESCE(opp_name, 'Blazer');
    seat2_name := COALESCE(req_name, 'Blazer');
  END IF;

  seed := (get_byte(gen_random_bytes(4), 0)::integer << 24)
        | (get_byte(gen_random_bytes(4), 1)::integer << 16)
        | (get_byte(gen_random_bytes(4), 2)::integer << 8)
        | get_byte(gen_random_bytes(4), 3)::integer;
  seed := abs(seed % 2147483647);

  LOOP
    room_code := '';
    FOR i IN 1..6 LOOP
      room_code := room_code || substr(
        alphabet,
        1 + (get_byte(gen_random_bytes(1), 0) % length(alphabet)),
        1
      );
    END LOOP;
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.live_matches lm WHERE lm.room_code = room_code::extensions.citext
    );
  END LOOP;

  acceptance_deadline := now() + interval '12 seconds';
  match_expires := now() + interval '10 minutes';

  INSERT INTO public.live_matches (
    room_code, mode, status, seed, host_user_id, expires_at
  ) VALUES (
    room_code::extensions.citext,
    'ranked',
    'ready',
    seed,
    seat1_user,
    match_expires
  )
  RETURNING id INTO new_match_id;

  INSERT INTO public.live_match_players (
    match_id, user_id, seat, last_seen_at, display_name_snapshot
  ) VALUES
    (new_match_id, seat1_user, 1, now(), seat1_name),
    (new_match_id, seat2_user, 2, now(), seat2_name);

  INSERT INTO public.quick_match_acceptances (match_id, user_id, expires_at)
  VALUES
    (new_match_id, seat1_user, acceptance_deadline),
    (new_match_id, seat2_user, acceptance_deadline);

  UPDATE public.matchmaking_queue
  SET status = 'matched',
      matched_at = now(),
      match_id = new_match_id,
      last_check_at = now(),
      rating_range_at_join = rating_range
  WHERE id IN (seat1_queue, seat2_queue)
    AND status = 'queued';

  RETURN new_match_id;
END;
$$;

REVOKE ALL ON FUNCTION public.try_create_ranked_match(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.try_create_ranked_match(uuid, text, text) TO service_role;

-- ---------------------------------------------------------------------------
-- Finalize ranked match (idempotent)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.finalize_ranked_match(p_match_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  match_row public.live_matches%ROWTYPE;
  season public.ranked_seasons%ROWTYPE;
  p1 public.live_match_players%ROWTYPE;
  p2 public.live_match_players%ROWTYPE;
  r1 public.player_rankings%ROWTYPE;
  r2 public.player_rankings%ROWTYPE;
  existing public.ranked_match_results%ROWTYPE;
  result_type text;
  winner uuid;
  actual1 double precision;
  actual2 double precision;
  expected1 double precision;
  expected2 double precision;
  k1 integer;
  k2 integer;
  after1 integer;
  after2 integer;
  change1 integer;
  change2 integer;
  score1 integer;
  score2 integer;
  zero_rating boolean := false;
  recent_pair_count integer;
  new_div1 text;
  new_div2 text;
  peak_div1 text;
  peak_div2 text;
BEGIN
  SELECT * INTO match_row
  FROM public.live_matches
  WHERE id = p_match_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Match not found';
  END IF;

  IF match_row.mode <> 'ranked' THEN
    RAISE EXCEPTION 'Match is not ranked';
  END IF;

  SELECT * INTO existing
  FROM public.ranked_match_results
  WHERE match_id = p_match_id;

  IF FOUND THEN
    RETURN to_jsonb(existing);
  END IF;

  SELECT * INTO season
  FROM public.ranked_seasons
  WHERE id = (
    SELECT season_id FROM public.matchmaking_queue
    WHERE match_id = p_match_id
    LIMIT 1
  );

  IF NOT FOUND THEN
    SELECT * INTO season FROM public.ranked_seasons WHERE status = 'active' LIMIT 1;
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No ranked season available';
  END IF;

  SELECT * INTO p1 FROM public.live_match_players
  WHERE match_id = p_match_id AND seat = 1 FOR UPDATE;
  SELECT * INTO p2 FROM public.live_match_players
  WHERE match_id = p_match_id AND seat = 2 FOR UPDATE;

  IF NOT FOUND OR p1.user_id IS NULL OR p2.user_id IS NULL THEN
    RAISE EXCEPTION 'Ranked match requires two players';
  END IF;

  -- Determine outcome
  IF p1.result = 'forfeit_loss' OR p2.result = 'forfeit_win' THEN
    result_type := 'player_two_forfeit';
    winner := p2.user_id;
    actual1 := 0; actual2 := 1;
    score1 := COALESCE(p1.verified_score, 0);
    score2 := COALESCE(p2.verified_score, 0);
  ELSIF p2.result = 'forfeit_loss' OR p1.result = 'forfeit_win' THEN
    result_type := 'player_one_forfeit';
    winner := p1.user_id;
    actual1 := 1; actual2 := 0;
    score1 := COALESCE(p1.verified_score, 0);
    score2 := COALESCE(p2.verified_score, 0);
  ELSIF match_row.finish_reason = 'no_contest' THEN
    result_type := 'no_contest';
    winner := NULL;
    actual1 := 0.5; actual2 := 0.5;
    score1 := COALESCE(p1.verified_score, 0);
    score2 := COALESCE(p2.verified_score, 0);
    zero_rating := true;
  ELSIF p1.submitted_at IS NULL OR p2.submitted_at IS NULL
     OR p1.verified_score IS NULL OR p2.verified_score IS NULL THEN
    RAISE EXCEPTION 'Verified results incomplete';
  ELSE
    score1 := p1.verified_score;
    score2 := p2.verified_score;
    IF score1 > score2
      OR (score1 = score2 AND p1.verified_lanes_cleared > p2.verified_lanes_cleared)
      OR (score1 = score2 AND p1.verified_lanes_cleared = p2.verified_lanes_cleared
          AND p1.verified_cards_played > p2.verified_cards_played)
      OR (score1 = score2 AND p1.verified_lanes_cleared = p2.verified_lanes_cleared
          AND p1.verified_cards_played = p2.verified_cards_played
          AND p1.verified_busts < p2.verified_busts)
      OR (score1 = score2 AND p1.verified_lanes_cleared = p2.verified_lanes_cleared
          AND p1.verified_cards_played = p2.verified_cards_played
          AND p1.verified_busts = p2.verified_busts
          AND p1.verified_time_remaining_seconds > p2.verified_time_remaining_seconds)
    THEN
      result_type := 'player_one_win';
      winner := p1.user_id;
      actual1 := 1; actual2 := 0;
    ELSIF score2 > score1
      OR (score1 = score2 AND p2.verified_lanes_cleared > p1.verified_lanes_cleared)
      OR (score1 = score2 AND p1.verified_lanes_cleared = p2.verified_lanes_cleared
          AND p2.verified_cards_played > p1.verified_cards_played)
      OR (score1 = score2 AND p1.verified_lanes_cleared = p2.verified_lanes_cleared
          AND p1.verified_cards_played = p2.verified_cards_played
          AND p2.verified_busts < p1.verified_busts)
      OR (score1 = score2 AND p1.verified_lanes_cleared = p2.verified_lanes_cleared
          AND p1.verified_cards_played = p2.verified_cards_played
          AND p1.verified_busts = p2.verified_busts
          AND p2.verified_time_remaining_seconds > p1.verified_time_remaining_seconds)
    THEN
      result_type := 'player_two_win';
      winner := p2.user_id;
      actual1 := 0; actual2 := 1;
    ELSE
      result_type := 'draw';
      winner := NULL;
      actual1 := 0.5; actual2 := 0.5;
    END IF;
  END IF;

  -- Anti win-trading: >3 rated matches vs same opponent in 24h => zero rating delta
  SELECT count(*) INTO recent_pair_count
  FROM public.ranked_match_results r
  WHERE r.created_at > now() - interval '24 hours'
    AND r.result_type <> 'no_contest'
    AND (
      (r.player_one_user_id = p1.user_id AND r.player_two_user_id = p2.user_id)
      OR (r.player_one_user_id = p2.user_id AND r.player_two_user_id = p1.user_id)
    );

  IF recent_pair_count >= 3 AND result_type <> 'no_contest' THEN
    zero_rating := true;
    INSERT INTO public.ranked_integrity_flags (match_id, user_id, flag_type, severity, metadata)
    VALUES
      (p_match_id, p1.user_id, 'repeated_opponent_cap', 'medium',
        jsonb_build_object('opponent_id', p2.user_id, 'count_24h', recent_pair_count)),
      (p_match_id, p2.user_id, 'repeated_opponent_cap', 'medium',
        jsonb_build_object('opponent_id', p1.user_id, 'count_24h', recent_pair_count));
  END IF;

  IF match_row.completed_at IS NOT NULL
     AND match_row.starts_at IS NOT NULL
     AND match_row.completed_at < match_row.starts_at + interval '20 seconds'
     AND result_type IN ('player_one_forfeit', 'player_two_forfeit') THEN
    INSERT INTO public.ranked_integrity_flags (match_id, user_id, flag_type, severity, metadata)
    VALUES (
      p_match_id,
      COALESCE(winner, p1.user_id),
      'rapid_forfeit',
      'low',
      jsonb_build_object('result_type', result_type)
    );
  END IF;

  r1 := public.ensure_player_ranking(p1.user_id, season.id);
  r2 := public.ensure_player_ranking(p2.user_id, season.id);

  expected1 := public.ranked_expected_score(r1.rating, r2.rating);
  expected2 := public.ranked_expected_score(r2.rating, r1.rating);
  k1 := public.ranked_k_factor(r1.placement_matches_completed, r1.ranked_matches_played);
  k2 := public.ranked_k_factor(r2.placement_matches_completed, r2.ranked_matches_played);

  IF zero_rating OR result_type = 'no_contest' THEN
    after1 := r1.rating;
    after2 := r2.rating;
    change1 := 0;
    change2 := 0;
  ELSE
    after1 := GREATEST(100, round(r1.rating + k1 * (actual1 - expected1))::integer);
    after2 := GREATEST(100, round(r2.rating + k2 * (actual2 - expected2))::integer);
    change1 := after1 - r1.rating;
    change2 := after2 - r2.rating;
  END IF;

  -- No-contest records audit rows but does not alter placement or W/L/D.
  IF result_type <> 'no_contest' THEN
    new_div1 := public.ranked_division_for(
      after1,
      LEAST(5, r1.placement_matches_completed + 1)
    );
    new_div2 := public.ranked_division_for(
      after2,
      LEAST(5, r2.placement_matches_completed + 1)
    );

    peak_div1 := CASE
      WHEN r1.peak_division = 'unranked' THEN new_div1
      WHEN new_div1 = 'blaze_elite' THEN 'blaze_elite'
      WHEN new_div1 = 'blaze' AND r1.peak_division NOT IN ('blaze_elite') THEN 'blaze'
      WHEN new_div1 = 'inferno' AND r1.peak_division NOT IN ('blaze_elite', 'blaze') THEN 'inferno'
      WHEN new_div1 = 'flame' AND r1.peak_division IN ('unranked', 'ember', 'spark', 'flame') THEN 'flame'
      WHEN new_div1 = 'spark' AND r1.peak_division IN ('unranked', 'ember', 'spark') THEN 'spark'
      WHEN new_div1 = 'ember' AND r1.peak_division IN ('unranked', 'ember') THEN 'ember'
      ELSE r1.peak_division
    END;

    peak_div2 := CASE
      WHEN r2.peak_division = 'unranked' THEN new_div2
      WHEN new_div2 = 'blaze_elite' THEN 'blaze_elite'
      WHEN new_div2 = 'blaze' AND r2.peak_division NOT IN ('blaze_elite') THEN 'blaze'
      WHEN new_div2 = 'inferno' AND r2.peak_division NOT IN ('blaze_elite', 'blaze') THEN 'inferno'
      WHEN new_div2 = 'flame' AND r2.peak_division IN ('unranked', 'ember', 'spark', 'flame') THEN 'flame'
      WHEN new_div2 = 'spark' AND r2.peak_division IN ('unranked', 'ember', 'spark') THEN 'spark'
      WHEN new_div2 = 'ember' AND r2.peak_division IN ('unranked', 'ember') THEN 'ember'
      ELSE r2.peak_division
    END;

    UPDATE public.player_rankings SET
      rating = after1,
      placement_matches_completed = LEAST(5, placement_matches_completed + 1),
      ranked_matches_played = ranked_matches_played + 1,
      wins = wins + CASE WHEN actual1 = 1 THEN 1 ELSE 0 END,
      losses = losses + CASE WHEN actual1 = 0 THEN 1 ELSE 0 END,
      draws = draws + CASE WHEN actual1 = 0.5 THEN 1 ELSE 0 END,
      current_win_streak = CASE
        WHEN actual1 = 1 THEN current_win_streak + 1
        ELSE 0
      END,
      longest_win_streak = CASE
        WHEN actual1 = 1 THEN GREATEST(longest_win_streak, current_win_streak + 1)
        ELSE longest_win_streak
      END,
      peak_rating = GREATEST(peak_rating, after1),
      current_division = new_div1,
      peak_division = peak_div1,
      last_ranked_match_at = now()
    WHERE user_id = p1.user_id AND season_id = season.id;

    UPDATE public.player_rankings SET
      rating = after2,
      placement_matches_completed = LEAST(5, placement_matches_completed + 1),
      ranked_matches_played = ranked_matches_played + 1,
      wins = wins + CASE WHEN actual2 = 1 THEN 1 ELSE 0 END,
      losses = losses + CASE WHEN actual2 = 0 THEN 1 ELSE 0 END,
      draws = draws + CASE WHEN actual2 = 0.5 THEN 1 ELSE 0 END,
      current_win_streak = CASE
        WHEN actual2 = 1 THEN current_win_streak + 1
        ELSE 0
      END,
      longest_win_streak = CASE
        WHEN actual2 = 1 THEN GREATEST(longest_win_streak, current_win_streak + 1)
        ELSE longest_win_streak
      END,
      peak_rating = GREATEST(peak_rating, after2),
      current_division = new_div2,
      peak_division = peak_div2,
      last_ranked_match_at = now()
    WHERE user_id = p2.user_id AND season_id = season.id;
  END IF;

  INSERT INTO public.ranked_match_results (
    match_id,
    season_id,
    player_one_user_id,
    player_two_user_id,
    winner_user_id,
    result_type,
    player_one_rating_before,
    player_one_rating_after,
    player_one_rating_change,
    player_two_rating_before,
    player_two_rating_after,
    player_two_rating_change,
    player_one_verified_score,
    player_two_verified_score
  ) VALUES (
    p_match_id,
    season.id,
    p1.user_id,
    p2.user_id,
    winner,
    result_type,
    r1.rating,
    after1,
    change1,
    r2.rating,
    after2,
    change2,
    score1,
    score2
  )
  RETURNING * INTO existing;

  UPDATE public.live_matches
  SET winner_user_id = COALESCE(winner_user_id, winner)
  WHERE id = p_match_id;

  RETURN to_jsonb(existing);
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_ranked_match(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finalize_ranked_match(uuid) TO service_role;

-- Documented soft-reset helper for future season rollover (not auto-run).
CREATE OR REPLACE FUNCTION public.soft_reset_ranked_rating(old_rating integer)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT GREATEST(100, round(1200 + ((old_rating - 1200) * 0.5))::integer);
$$;

-- Foundation for a future season rollover job (NOT scheduled in beta).
-- Steps when an operator runs this later:
-- 1) Mark the current active season completed
-- 2) Snapshot final ranks via ranked_season_leaderboard
-- 3) Insert the next season as active
-- 4) Soft-reset each player rating toward 1200 with soft_reset_ranked_rating
CREATE OR REPLACE FUNCTION public.prepare_next_ranked_season(
  p_name text,
  p_slug text,
  p_starts_at timestamptz,
  p_ends_at timestamptz
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_season public.ranked_seasons%ROWTYPE;
  next_id uuid;
  ranking public.player_rankings%ROWTYPE;
BEGIN
  SELECT * INTO current_season
  FROM public.ranked_seasons
  WHERE status = 'active'
  FOR UPDATE;

  IF FOUND THEN
    UPDATE public.ranked_seasons
    SET status = 'completed'
    WHERE id = current_season.id;
  END IF;

  INSERT INTO public.ranked_seasons (name, slug, status, starts_at, ends_at)
  VALUES (p_name, p_slug, 'active', p_starts_at, p_ends_at)
  RETURNING id INTO next_id;

  IF FOUND AND current_season.id IS NOT NULL THEN
    FOR ranking IN
      SELECT * FROM public.player_rankings WHERE season_id = current_season.id
    LOOP
      INSERT INTO public.player_rankings (
        user_id,
        season_id,
        rating,
        placement_matches_completed,
        ranked_matches_played,
        wins,
        losses,
        draws,
        current_win_streak,
        longest_win_streak,
        peak_rating,
        current_division,
        peak_division
      ) VALUES (
        ranking.user_id,
        next_id,
        public.soft_reset_ranked_rating(ranking.rating),
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        public.soft_reset_ranked_rating(ranking.rating),
        'unranked',
        'unranked'
      )
      ON CONFLICT (user_id, season_id) DO NOTHING;
    END LOOP;
  END IF;

  RETURN next_id;
END;
$$;

REVOKE ALL ON FUNCTION public.prepare_next_ranked_season(text, text, timestamptz, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.prepare_next_ranked_season(text, text, timestamptz, timestamptz) TO service_role;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.ranked_seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_rankings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ranked_match_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ranked_integrity_flags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ranked_seasons_select" ON public.ranked_seasons;
CREATE POLICY "ranked_seasons_select"
  ON public.ranked_seasons
  FOR SELECT
  TO authenticated
  USING (status IN ('upcoming', 'active', 'completed'));

DROP POLICY IF EXISTS "player_rankings_select" ON public.player_rankings;
CREATE POLICY "player_rankings_select"
  ON public.player_rankings
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "ranked_match_results_select_participants"
  ON public.ranked_match_results;
CREATE POLICY "ranked_match_results_select_participants"
  ON public.ranked_match_results
  FOR SELECT
  TO authenticated
  USING (
    player_one_user_id = (SELECT auth.uid())
    OR player_two_user_id = (SELECT auth.uid())
  );

-- No client policies on integrity flags (deny by default with RLS enabled).

GRANT SELECT ON public.ranked_seasons TO authenticated;
GRANT SELECT ON public.player_rankings TO authenticated;
GRANT SELECT ON public.ranked_match_results TO authenticated;
GRANT SELECT ON public.ranked_season_leaderboard TO authenticated;

REVOKE INSERT, UPDATE, DELETE ON public.ranked_seasons FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.player_rankings FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.ranked_match_results FROM authenticated, anon;
REVOKE ALL ON public.ranked_integrity_flags FROM authenticated, anon;
