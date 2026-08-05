-- Version 1.3B — Daily and weekly challenge leaderboards
-- Verified ranked attempts only. Server-authoritative ranking.

ALTER TABLE public.daily_challenges
  ADD COLUMN IF NOT EXISTS finalized_at timestamptz,
  ADD COLUMN IF NOT EXISTS ranking_rules_version integer NOT NULL DEFAULT 1;

ALTER TABLE public.daily_challenge_attempts
  ADD COLUMN IF NOT EXISTS daily_rank integer,
  ADD COLUMN IF NOT EXISTS challenge_points integer;

-- Extend display name length for public leaderboard (3–20 visible chars).
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_display_name_length;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_display_name_length CHECK (
    char_length(display_name::text) BETWEEN 3 AND 20
  );

-- ---------------------------------------------------------------------------
-- Challenge points from daily rank
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.challenge_points_for_rank(p_rank integer)
RETURNS integer
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_rank IS NULL OR p_rank < 1 THEN 0
    WHEN p_rank = 1 THEN 100
    WHEN p_rank = 2 THEN 90
    WHEN p_rank = 3 THEN 85
    WHEN p_rank <= 10 THEN 75
    WHEN p_rank <= 25 THEN 60
    WHEN p_rank <= 50 THEN 45
    WHEN p_rank <= 100 THEN 30
    ELSE 15
  END;
$$;

-- ---------------------------------------------------------------------------
-- Public display name helper (no raw UUID exposure)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.public_display_name(
  p_display_name extensions.citext,
  p_user_id uuid
)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = public, extensions
AS $$
  SELECT CASE
    WHEN p_display_name IS NOT NULL AND char_length(p_display_name::text) >= 3
      THEN left(p_display_name::text, 20)
    ELSE 'Blazer ' || right(replace(p_user_id::text, '-', ''), 4)
  END;
$$;

-- ---------------------------------------------------------------------------
-- Daily leaderboard view — verified ranked attempts only
-- Tie-break order documented in docs/V1_3B_RANKING_RULES.md
-- ---------------------------------------------------------------------------
DROP VIEW IF EXISTS public.daily_challenge_leaderboard;

CREATE VIEW public.daily_challenge_leaderboard AS
SELECT
  a.challenge_id,
  c.challenge_date,
  c.status AS challenge_status,
  c.finalized_at,
  a.user_id,
  public.public_display_name(p.display_name, a.user_id) AS player_name,
  COALESCE(ec.profile_frame, 'default_profile_frame') AS profile_frame_id,
  ec.player_title AS player_title_id,
  a.verified_score AS score,
  a.verified_clears AS lanes_cleared,
  a.verified_exact_21_count AS exact_21_count,
  a.verified_five_card_clears AS five_card_clears,
  a.verified_bust_count AS bust_count,
  a.verified_multiplier AS best_multiplier,
  a.elapsed_time_ms,
  a.completed_at,
  COALESCE(a.daily_rank, (
    RANK() OVER (
      PARTITION BY a.challenge_id
      ORDER BY
        a.verified_score DESC,
        a.verified_exact_21_count DESC,
        a.verified_five_card_clears DESC,
        a.verified_bust_count ASC,
        a.verified_multiplier DESC,
        a.elapsed_time_ms ASC NULLS LAST,
        a.completed_at ASC
    )
  ))::integer AS rank,
  COALESCE(a.challenge_points, public.challenge_points_for_rank(
    COALESCE(a.daily_rank, (
      RANK() OVER (
        PARTITION BY a.challenge_id
        ORDER BY
          a.verified_score DESC,
          a.verified_exact_21_count DESC,
          a.verified_five_card_clears DESC,
          a.verified_bust_count ASC,
          a.verified_multiplier DESC,
          a.elapsed_time_ms ASC NULLS LAST,
          a.completed_at ASC
      )
    ))::integer
  )) AS challenge_points
FROM public.daily_challenge_attempts a
JOIN public.daily_challenges c ON c.id = a.challenge_id
JOIN public.profiles p ON p.id = a.user_id
LEFT JOIN public.equipped_cosmetics ec ON ec.user_id = a.user_id
WHERE a.attempt_type = 'ranked'
  AND a.status = 'completed'
  AND a.verification_status = 'verified'
  AND a.verified_score IS NOT NULL;

GRANT SELECT ON public.daily_challenge_leaderboard TO authenticated;

-- ---------------------------------------------------------------------------
-- Finalize challenges after verification grace (10 minutes after UTC day end)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.finalize_expired_daily_challenges()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.daily_challenges
  SET
    status = 'closed',
    finalized_at = COALESCE(finalized_at, now())
  WHERE status <> 'closed'
    AND ends_at + interval '10 minutes' < now()
    AND finalized_at IS NULL;
END;
$$;

-- ---------------------------------------------------------------------------
-- get_daily_challenge_leaderboard
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_daily_challenge_leaderboard(
  p_challenge_date date DEFAULT NULL,
  p_limit integer DEFAULT 100,
  p_after_rank integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_date date := COALESCE(p_challenge_date, (now() AT TIME ZONE 'UTC')::date);
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 100), 1), 100);
  v_after integer := GREATEST(COALESCE(p_after_rank, 0), 0);
  v_challenge_id uuid;
  v_challenge_status text;
  v_finalized_at timestamptz;
  v_ends_at timestamptz;
  v_entries jsonb;
  v_player jsonb;
  v_total integer;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  PERFORM public.finalize_expired_daily_challenges();

  SELECT id, status, finalized_at, ends_at
  INTO v_challenge_id, v_challenge_status, v_finalized_at, v_ends_at
  FROM public.daily_challenges
  WHERE challenge_date = v_date;

  IF v_challenge_id IS NULL THEN
    RETURN jsonb_build_object(
      'challengeDate', v_date,
      'entries', '[]'::jsonb,
      'totalParticipants', 0,
      'finalized', false,
      'playerRank', null,
      'serverTime', now()
    );
  END IF;

  SELECT COUNT(*)::integer INTO v_total
  FROM public.daily_challenge_leaderboard lb
  WHERE lb.challenge_id = v_challenge_id;

  SELECT COALESCE(jsonb_agg(row_to_json(e)::jsonb ORDER BY e.rank), '[]'::jsonb)
  INTO v_entries
  FROM (
    SELECT
      lb.rank,
      lb.player_name,
      lb.score,
      lb.exact_21_count,
      lb.five_card_clears,
      lb.bust_count,
      lb.best_multiplier,
      lb.elapsed_time_ms,
      lb.challenge_points,
      lb.profile_frame_id,
      lb.player_title_id,
      (lb.user_id = v_user_id) AS is_current_player
    FROM public.daily_challenge_leaderboard lb
    WHERE lb.challenge_id = v_challenge_id
      AND lb.rank > v_after
    ORDER BY lb.rank
    LIMIT v_limit
  ) e;

  SELECT jsonb_build_object(
    'rank', lb.rank,
    'score', lb.score,
    'challengePoints', lb.challenge_points,
    'verificationStatus', 'verified'
  )
  INTO v_player
  FROM public.daily_challenge_leaderboard lb
  WHERE lb.challenge_id = v_challenge_id
    AND lb.user_id = v_user_id;

  RETURN jsonb_build_object(
    'challengeId', v_challenge_id,
    'challengeDate', v_date,
    'endsAt', v_ends_at,
    'finalized', v_challenge_status = 'closed' OR v_finalized_at IS NOT NULL,
    'totalParticipants', v_total,
    'entries', v_entries,
    'playerRank', v_player,
    'serverTime', now()
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- get_nearby_daily_ranks
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_nearby_daily_ranks(
  p_challenge_date date DEFAULT NULL,
  p_window integer DEFAULT 2
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_date date := COALESCE(p_challenge_date, (now() AT TIME ZONE 'UTC')::date);
  v_window integer := LEAST(GREATEST(COALESCE(p_window, 2), 1), 10);
  v_challenge_id uuid;
  v_player_rank integer;
  v_entries jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  SELECT id INTO v_challenge_id
  FROM public.daily_challenges
  WHERE challenge_date = v_date;

  IF v_challenge_id IS NULL THEN
    RETURN jsonb_build_object('entries', '[]'::jsonb);
  END IF;

  SELECT lb.rank INTO v_player_rank
  FROM public.daily_challenge_leaderboard lb
  WHERE lb.challenge_id = v_challenge_id AND lb.user_id = v_user_id;

  IF v_player_rank IS NULL THEN
    RETURN jsonb_build_object('entries', '[]'::jsonb);
  END IF;

  SELECT COALESCE(jsonb_agg(row_to_json(e)::jsonb ORDER BY e.rank), '[]'::jsonb)
  INTO v_entries
  FROM (
    SELECT
      lb.rank,
      lb.player_name,
      lb.score,
      lb.challenge_points,
      (lb.user_id = v_user_id) AS is_current_player
    FROM public.daily_challenge_leaderboard lb
    WHERE lb.challenge_id = v_challenge_id
      AND lb.rank BETWEEN v_player_rank - v_window AND v_player_rank + v_window
    ORDER BY lb.rank
  ) e;

  RETURN jsonb_build_object('entries', v_entries);
END;
$$;

-- ---------------------------------------------------------------------------
-- Weekly leaderboard (UTC Monday week)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_weekly_challenge_leaderboard(
  p_week_start date DEFAULT NULL,
  p_limit integer DEFAULT 100,
  p_after_rank integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_week_start date := COALESCE(
    p_week_start,
    date_trunc('week', (now() AT TIME ZONE 'UTC'))::date
  );
  v_week_end date := v_week_start + 7;
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 100), 1), 100);
  v_after integer := GREATEST(COALESCE(p_after_rank, 0), 0);
  v_entries jsonb;
  v_player jsonb;
  v_total integer;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  WITH daily AS (
    SELECT
      lb.user_id,
      lb.challenge_date,
      lb.rank AS daily_rank,
      lb.score,
      lb.exact_21_count,
      lb.five_card_clears,
      lb.bust_count,
      lb.challenge_points,
      lb.completed_at,
      lb.player_name,
      lb.profile_frame_id,
      lb.player_title_id
    FROM public.daily_challenge_leaderboard lb
    WHERE lb.challenge_date >= v_week_start
      AND lb.challenge_date < v_week_end
  ),
  weekly AS (
    SELECT
      d.user_id,
      d.player_name,
      d.profile_frame_id,
      d.player_title_id,
      SUM(d.challenge_points)::integer AS challenge_points,
      COUNT(*)::integer AS verified_days_completed,
      MIN(d.daily_rank)::integer AS best_daily_rank,
      SUM(d.score)::integer AS total_verified_score,
      SUM(d.exact_21_count)::integer AS total_exact_21_count,
      SUM(d.five_card_clears)::integer AS total_five_card_clears,
      SUM(d.bust_count)::integer AS total_bust_count,
      MAX(d.completed_at) AS last_contributed_at
    FROM daily d
    GROUP BY d.user_id, d.player_name, d.profile_frame_id, d.player_title_id
  ),
  ranked AS (
    SELECT
      w.*,
      RANK() OVER (
        ORDER BY
          w.challenge_points DESC,
          w.verified_days_completed DESC,
          w.best_daily_rank ASC,
          w.total_verified_score DESC,
          w.total_exact_21_count DESC,
          w.total_five_card_clears DESC,
          w.total_bust_count ASC,
          w.last_contributed_at ASC
      )::integer AS rank
    FROM weekly w
  )
  SELECT COUNT(*)::integer INTO v_total FROM ranked;

  SELECT COALESCE(jsonb_agg(row_to_json(e)::jsonb ORDER BY e.rank), '[]'::jsonb)
  INTO v_entries
  FROM (
    SELECT
      r.rank,
      r.player_name,
      r.challenge_points,
      r.verified_days_completed,
      r.best_daily_rank,
      r.total_verified_score,
      r.total_exact_21_count,
      r.total_five_card_clears,
      r.total_bust_count,
      r.profile_frame_id,
      r.player_title_id,
      (r.user_id = v_user_id) AS is_current_player
    FROM ranked r
    WHERE r.rank > v_after
    ORDER BY r.rank
    LIMIT v_limit
  ) e;

  WITH daily AS (
    SELECT lb.user_id, lb.challenge_date, lb.rank AS daily_rank, lb.score,
      lb.exact_21_count, lb.five_card_clears, lb.bust_count, lb.challenge_points,
      lb.completed_at, lb.player_name, lb.profile_frame_id, lb.player_title_id
    FROM public.daily_challenge_leaderboard lb
    WHERE lb.challenge_date >= v_week_start AND lb.challenge_date < v_week_end
  ),
  weekly AS (
    SELECT d.user_id,
      SUM(d.challenge_points)::integer AS challenge_points,
      COUNT(*)::integer AS verified_days_completed,
      MIN(d.daily_rank)::integer AS best_daily_rank,
      SUM(d.score)::integer AS total_verified_score,
      MAX(d.completed_at) AS last_contributed_at
    FROM daily d
    GROUP BY d.user_id
  ),
  ranked AS (
    SELECT w.*,
      RANK() OVER (
        ORDER BY w.challenge_points DESC, w.verified_days_completed DESC,
          w.best_daily_rank ASC, w.total_verified_score DESC,
          w.last_contributed_at ASC
      )::integer AS rank
    FROM weekly w
  )
  SELECT jsonb_build_object(
    'rank', r.rank,
    'challengePoints', r.challenge_points,
    'verifiedDaysCompleted', r.verified_days_completed
  )
  INTO v_player
  FROM ranked r
  WHERE r.user_id = v_user_id;

  RETURN jsonb_build_object(
    'weekStart', v_week_start,
    'weekEnd', (v_week_end - 1),
    'totalParticipants', v_total,
    'entries', v_entries,
    'playerRank', v_player,
    'serverTime', now()
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_nearby_weekly_ranks(
  p_week_start date DEFAULT NULL,
  p_window integer DEFAULT 2
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_week_start date := COALESCE(
    p_week_start,
    date_trunc('week', (now() AT TIME ZONE 'UTC'))::date
  );
  v_week_end date := v_week_start + 7;
  v_window integer := LEAST(GREATEST(COALESCE(p_window, 2), 1), 10);
  v_player_rank integer;
  v_entries jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  WITH daily AS (
    SELECT lb.user_id, lb.rank AS daily_rank, lb.challenge_points, lb.player_name
    FROM public.daily_challenge_leaderboard lb
    WHERE lb.challenge_date >= v_week_start AND lb.challenge_date < v_week_end
  ),
  weekly AS (
    SELECT d.user_id, d.player_name,
      SUM(d.challenge_points)::integer AS challenge_points,
      COUNT(*)::integer AS verified_days_completed,
      MIN(d.daily_rank)::integer AS best_daily_rank
    FROM daily d
    GROUP BY d.user_id, d.player_name
  ),
  ranked AS (
    SELECT w.*,
      RANK() OVER (
        ORDER BY w.challenge_points DESC, w.verified_days_completed DESC,
          w.best_daily_rank ASC
      )::integer AS rank
    FROM weekly w
  )
  SELECT r.rank INTO v_player_rank FROM ranked r WHERE r.user_id = v_user_id;

  IF v_player_rank IS NULL THEN
    RETURN jsonb_build_object('entries', '[]'::jsonb);
  END IF;

  WITH daily AS (
    SELECT lb.user_id, lb.rank AS daily_rank, lb.challenge_points, lb.player_name
    FROM public.daily_challenge_leaderboard lb
    WHERE lb.challenge_date >= v_week_start AND lb.challenge_date < v_week_end
  ),
  weekly AS (
    SELECT d.user_id, d.player_name,
      SUM(d.challenge_points)::integer AS challenge_points
    FROM daily d
    GROUP BY d.user_id, d.player_name
  ),
  ranked AS (
    SELECT w.*,
      RANK() OVER (ORDER BY w.challenge_points DESC)::integer AS rank
    FROM weekly w
  )
  SELECT COALESCE(jsonb_agg(row_to_json(e)::jsonb ORDER BY e.rank), '[]'::jsonb)
  INTO v_entries
  FROM (
    SELECT r.rank, r.player_name, r.challenge_points,
      (r.user_id = v_user_id) AS is_current_player
    FROM ranked r
    WHERE r.rank BETWEEN v_player_rank - v_window AND v_player_rank + v_window
    ORDER BY r.rank
  ) e;

  RETURN jsonb_build_object('entries', v_entries);
END;
$$;

GRANT EXECUTE ON FUNCTION public.finalize_expired_daily_challenges() TO authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_expired_daily_challenges() TO service_role;
GRANT EXECUTE ON FUNCTION public.get_nearby_daily_ranks(date, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_weekly_challenge_leaderboard(date, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_nearby_weekly_ranks(date, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.challenge_points_for_rank(integer) TO authenticated;

COMMENT ON FUNCTION public.get_daily_challenge_leaderboard IS
  'Returns top verified daily challenge ranks. Verified ranked attempts only.';
COMMENT ON FUNCTION public.get_weekly_challenge_leaderboard IS
  'UTC Monday week aggregation of Challenge Points from verified daily ranks.';
