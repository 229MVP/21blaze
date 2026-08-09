-- Version 1.3 Phase 3 — Daily/Weekly leaderboards, streaks, secure reward grants
-- Tie-breakers (documented centrally):
-- 1. Higher score
-- 2. More Exact 21 clears
-- 3. More Five Card clears
-- 4. Fewer busts
-- 5. Faster completion time (elapsed_time_ms)
-- 6. Earlier official completion timestamp (completed_at)

-- ---------------------------------------------------------------------------
-- Leaderboard eligibility helper
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_daily_leaderboard_eligible(p_verification_status text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT p_verification_status IN ('accepted', 'verified');
$$;

COMMENT ON FUNCTION public.is_daily_leaderboard_eligible(text) IS
  'Only accepted/verified official ranked completions enter competitive leaderboards.';

-- ---------------------------------------------------------------------------
-- UTC week boundary: Monday 00:00 UTC through Sunday (inclusive calendar days)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.utc_week_start(p_date date)
RETURNS date
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT (p_date - ((EXTRACT(dow FROM p_date)::integer + 6) % 7))::date;
$$;

CREATE OR REPLACE FUNCTION public.utc_week_end(p_date date)
RETURNS date
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT public.utc_week_start(p_date) + 6;
$$;

-- ---------------------------------------------------------------------------
-- Reward grants ledger (server-authoritative)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reward_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  source_type text NOT NULL,
  source_id text NOT NULL,
  reward_type text NOT NULL,
  reward_key text NOT NULL,
  amount bigint,
  cosmetic_entitlement text,
  status text NOT NULL DEFAULT 'eligible',
  created_at timestamptz NOT NULL DEFAULT now(),
  claimed_at timestamptz,
  CONSTRAINT reward_grants_status_check CHECK (
    status IN ('eligible', 'claimed', 'revoked')
  ),
  CONSTRAINT reward_grants_user_source_unique UNIQUE (user_id, source_type, source_id, reward_key)
);

CREATE INDEX IF NOT EXISTS reward_grants_user_status_idx
  ON public.reward_grants (user_id, status, created_at DESC);

ALTER TABLE public.reward_grants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS reward_grants_select_own ON public.reward_grants;
CREATE POLICY reward_grants_select_own ON public.reward_grants
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Streak milestone registry (server-side amounts — client never submits)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.daily_streak_milestone_coins(p_milestone integer)
RETURNS bigint
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_milestone
    WHEN 1 THEN 25
    WHEN 3 THEN 50
    WHEN 5 THEN 75
    WHEN 7 THEN 100
    WHEN 14 THEN 150
    WHEN 30 THEN 300
    ELSE NULL
  END;
$$;

CREATE OR REPLACE FUNCTION public.daily_streak_milestone_cosmetic(p_milestone integer)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_milestone
    WHEN 14 THEN 'future_streak_14_cosmetic'
    WHEN 30 THEN 'future_streak_30_cosmetic'
    ELSE NULL
  END;
$$;

-- ---------------------------------------------------------------------------
-- Apply streak on official completion (idempotent per challenge date)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.apply_daily_challenge_streak(
  p_user_id uuid,
  p_challenge_date date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  existing public.daily_challenge_streaks%ROWTYPE;
  current_streak integer := 1;
  longest_streak integer := 1;
  day_gap integer;
  milestone integer;
  coins bigint;
  cosmetic text;
  grant_source_id text;
BEGIN
  IF p_user_id IS NULL OR p_challenge_date IS NULL THEN
    RAISE EXCEPTION 'invalid_streak_input';
  END IF;

  SELECT * INTO existing
  FROM public.daily_challenge_streaks
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF FOUND AND existing.last_completed_date = p_challenge_date THEN
    RETURN jsonb_build_object(
      'currentStreak', existing.current_streak,
      'longestStreak', existing.longest_streak,
      'alreadyApplied', true
    );
  END IF;

  IF FOUND AND existing.last_completed_date IS NOT NULL THEN
    day_gap := p_challenge_date - existing.last_completed_date;
    IF day_gap = 1 THEN
      current_streak := existing.current_streak + 1;
    ELSE
      current_streak := 1;
    END IF;
    longest_streak := GREATEST(existing.longest_streak, current_streak);
  END IF;

  INSERT INTO public.daily_challenge_streaks (
    user_id,
    current_streak,
    longest_streak,
    last_completed_date,
    updated_at
  )
  VALUES (
    p_user_id,
    current_streak,
    longest_streak,
    p_challenge_date,
    now()
  )
  ON CONFLICT (user_id) DO UPDATE
  SET
    current_streak = EXCLUDED.current_streak,
    longest_streak = EXCLUDED.longest_streak,
    last_completed_date = EXCLUDED.last_completed_date,
    updated_at = now();

  FOR milestone IN SELECT unnest(ARRAY[1, 3, 5, 7, 14, 30]) LOOP
    IF current_streak = milestone THEN
      coins := public.daily_streak_milestone_coins(milestone);
      cosmetic := public.daily_streak_milestone_cosmetic(milestone);
      grant_source_id := 'streak:' || milestone::text || ':' || p_challenge_date::text;

      IF coins IS NOT NULL THEN
        INSERT INTO public.reward_grants (
          user_id,
          source_type,
          source_id,
          reward_type,
          reward_key,
          amount,
          status
        )
        VALUES (
          p_user_id,
          'daily_streak',
          grant_source_id,
          'blaze_coins',
          'milestone_' || milestone::text,
          coins,
          'eligible'
        )
        ON CONFLICT (user_id, source_type, source_id, reward_key) DO NOTHING;
      END IF;

      IF cosmetic IS NOT NULL THEN
        INSERT INTO public.reward_grants (
          user_id,
          source_type,
          source_id,
          reward_type,
          reward_key,
          cosmetic_entitlement,
          status
        )
        VALUES (
          p_user_id,
          'daily_streak',
          grant_source_id,
          'cosmetic_entitlement',
          cosmetic,
          cosmetic,
          'eligible'
        )
        ON CONFLICT (user_id, source_type, source_id, reward_key) DO NOTHING;
      END IF;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'currentStreak', current_streak,
    'longestStreak', longest_streak,
    'alreadyApplied', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.apply_daily_challenge_streak(uuid, date) FROM PUBLIC;

-- ---------------------------------------------------------------------------
-- Daily leaderboard view (canonical tie-break order)
-- ---------------------------------------------------------------------------
DROP VIEW IF EXISTS public.daily_challenge_leaderboard;

CREATE VIEW public.daily_challenge_leaderboard AS
SELECT
  a.challenge_id,
  c.challenge_date,
  a.user_id,
  COALESCE(p.display_name::text, 'Blaze Player') AS display_name,
  ec.profile_frame AS profile_frame_id,
  a.verified_score AS score,
  a.verified_exact_21_count AS exact_21_count,
  a.verified_five_card_clears AS five_card_clear_count,
  a.verified_bust_count AS bust_count,
  a.elapsed_time_ms AS completion_ms,
  a.completed_at,
  RANK() OVER (
    PARTITION BY a.challenge_id
    ORDER BY
      a.verified_score DESC,
      a.verified_exact_21_count DESC NULLS LAST,
      a.verified_five_card_clears DESC NULLS LAST,
      a.verified_bust_count ASC NULLS LAST,
      a.elapsed_time_ms ASC NULLS LAST,
      a.completed_at ASC NULLS LAST
  )::integer AS rank
FROM public.daily_challenge_attempts a
JOIN public.daily_challenges c ON c.id = a.challenge_id
LEFT JOIN public.profiles p ON p.id = a.user_id
LEFT JOIN public.equipped_cosmetics ec ON ec.user_id = a.user_id
WHERE a.attempt_type = 'ranked'
  AND a.status = 'completed'
  AND public.is_daily_leaderboard_eligible(a.verification_status)
  AND a.verified_score IS NOT NULL;

GRANT SELECT ON public.daily_challenge_leaderboard TO authenticated;

-- ---------------------------------------------------------------------------
-- Rank helper for a challenge attempt
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.compute_daily_challenge_rank(
  p_challenge_id uuid,
  p_attempt_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  attempt public.daily_challenge_attempts%ROWTYPE;
  player_rank integer;
  total_players integer;
BEGIN
  SELECT * INTO attempt
  FROM public.daily_challenge_attempts
  WHERE id = p_attempt_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('rank', NULL, 'totalPlayers', 0);
  END IF;

  IF NOT public.is_daily_leaderboard_eligible(attempt.verification_status)
     OR attempt.status <> 'completed'
     OR attempt.attempt_type <> 'ranked' THEN
    RETURN jsonb_build_object('rank', NULL, 'totalPlayers', 0);
  END IF;

  SELECT COUNT(*)::integer INTO total_players
  FROM public.daily_challenge_attempts a
  WHERE a.challenge_id = p_challenge_id
    AND a.attempt_type = 'ranked'
    AND a.status = 'completed'
    AND public.is_daily_leaderboard_eligible(a.verification_status);

  SELECT lb.rank INTO player_rank
  FROM public.daily_challenge_leaderboard lb
  WHERE lb.challenge_id = p_challenge_id
    AND lb.user_id = attempt.user_id;

  RETURN jsonb_build_object(
    'rank', player_rank,
    'totalPlayers', total_players
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- get_daily_leaderboard
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_daily_leaderboard(
  p_challenge_id uuid,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  entries jsonb;
  total_count integer;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  p_limit := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 100);
  p_offset := GREATEST(COALESCE(p_offset, 0), 0);

  SELECT COUNT(*)::integer INTO total_count
  FROM public.daily_challenge_leaderboard lb
  WHERE lb.challenge_id = p_challenge_id;

  SELECT COALESCE(jsonb_agg(row_to_json(e)::jsonb ORDER BY e.rank), '[]'::jsonb)
  INTO entries
  FROM (
    SELECT
      lb.rank,
      lb.display_name,
      lb.score,
      lb.exact_21_count,
      lb.five_card_clear_count,
      lb.bust_count,
      lb.completion_ms,
      lb.profile_frame_id,
      (lb.user_id = v_user_id) AS is_current_player
    FROM public.daily_challenge_leaderboard lb
    WHERE lb.challenge_id = p_challenge_id
    ORDER BY lb.rank ASC
    LIMIT p_limit
    OFFSET p_offset
  ) e;

  RETURN jsonb_build_object(
    'entries', entries,
    'totalPlayers', total_count,
    'limit', p_limit,
    'offset', p_offset
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- get_my_daily_leaderboard_position
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_my_daily_leaderboard_position(p_challenge_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  row_data record;
  total_count integer;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT COUNT(*)::integer INTO total_count
  FROM public.daily_challenge_leaderboard lb
  WHERE lb.challenge_id = p_challenge_id;

  SELECT
    lb.rank,
    lb.display_name,
    lb.score,
    lb.exact_21_count,
    lb.five_card_clear_count,
    lb.bust_count,
    lb.completion_ms,
    lb.profile_frame_id
  INTO row_data
  FROM public.daily_challenge_leaderboard lb
  WHERE lb.challenge_id = p_challenge_id
    AND lb.user_id = v_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'entry', NULL,
      'totalPlayers', total_count
    );
  END IF;

  RETURN jsonb_build_object(
    'entry', jsonb_build_object(
      'rank', row_data.rank,
      'displayName', row_data.display_name,
      'score', row_data.score,
      'exact21Count', row_data.exact_21_count,
      'fiveCardClearCount', row_data.five_card_clear_count,
      'bustCount', row_data.bust_count,
      'completionMs', row_data.completion_ms,
      'profileFrameId', row_data.profile_frame_id,
      'isCurrentPlayer', true
    ),
    'totalPlayers', total_count
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- Weekly leaderboard aggregation
-- WEEKLY SCORE = sum of official daily scores during UTC week (Mon–Sun)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_weekly_leaderboard(
  p_week_start date DEFAULT public.utc_week_start(public.utc_challenge_date()),
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  week_end date := p_week_start + 6;
  entries jsonb;
  total_count integer;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  p_limit := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 100);
  p_offset := GREATEST(COALESCE(p_offset, 0), 0);

  WITH weekly AS (
    SELECT
      a.user_id,
      COALESCE(p.display_name::text, 'Blaze Player') AS display_name,
      ec.profile_frame AS profile_frame_id,
      SUM(a.verified_score)::bigint AS weekly_score,
      COUNT(DISTINCT c.challenge_date)::integer AS days_played,
      MAX(a.verified_score)::integer AS best_daily_score
    FROM public.daily_challenge_attempts a
    JOIN public.daily_challenges c ON c.id = a.challenge_id
    LEFT JOIN public.profiles p ON p.id = a.user_id
    LEFT JOIN public.equipped_cosmetics ec ON ec.user_id = a.user_id
    WHERE a.attempt_type = 'ranked'
      AND a.status = 'completed'
      AND public.is_daily_leaderboard_eligible(a.verification_status)
      AND c.challenge_date >= p_week_start
      AND c.challenge_date <= week_end
    GROUP BY a.user_id, p.display_name, ec.profile_frame
  ),
  ranked AS (
    SELECT
      *,
      RANK() OVER (
        ORDER BY
          weekly_score DESC,
          days_played DESC,
          best_daily_score DESC,
          user_id ASC
      )::integer AS rank
    FROM weekly
  )
  SELECT COUNT(*)::integer INTO total_count FROM ranked;

  SELECT COALESCE(jsonb_agg(row_to_json(e)::jsonb ORDER BY e.rank), '[]'::jsonb)
  INTO entries
  FROM (
    SELECT
      r.rank,
      r.display_name,
      r.weekly_score,
      r.days_played,
      r.best_daily_score,
      r.profile_frame_id,
      (r.user_id = v_user_id) AS is_current_player
    FROM ranked r
    ORDER BY r.rank ASC
    LIMIT p_limit
    OFFSET p_offset
  ) e;

  RETURN jsonb_build_object(
    'weekStart', p_week_start,
    'weekEnd', week_end,
    'entries', entries,
    'totalPlayers', total_count,
    'limit', p_limit,
    'offset', p_offset
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_my_weekly_leaderboard_position(
  p_week_start date DEFAULT public.utc_week_start(public.utc_challenge_date())
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  week_end date := p_week_start + 6;
  row_data record;
  total_count integer;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  WITH weekly AS (
    SELECT
      a.user_id,
      COALESCE(p.display_name::text, 'Blaze Player') AS display_name,
      ec.profile_frame AS profile_frame_id,
      SUM(a.verified_score)::bigint AS weekly_score,
      COUNT(DISTINCT c.challenge_date)::integer AS days_played,
      MAX(a.verified_score)::integer AS best_daily_score
    FROM public.daily_challenge_attempts a
    JOIN public.daily_challenges c ON c.id = a.challenge_id
    LEFT JOIN public.profiles p ON p.id = a.user_id
    LEFT JOIN public.equipped_cosmetics ec ON ec.user_id = a.user_id
    WHERE a.attempt_type = 'ranked'
      AND a.status = 'completed'
      AND public.is_daily_leaderboard_eligible(a.verification_status)
      AND c.challenge_date >= p_week_start
      AND c.challenge_date <= week_end
    GROUP BY a.user_id, p.display_name, ec.profile_frame
  ),
  ranked AS (
    SELECT
      *,
      RANK() OVER (
        ORDER BY
          weekly_score DESC,
          days_played DESC,
          best_daily_score DESC,
          user_id ASC
      )::integer AS rank
    FROM weekly
  )
  SELECT COUNT(*)::integer INTO total_count FROM ranked;

  SELECT
    r.rank,
    r.display_name,
    r.weekly_score,
    r.days_played,
    r.best_daily_score,
    r.profile_frame_id
  INTO row_data
  FROM ranked r
  WHERE r.user_id = v_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'weekStart', p_week_start,
      'weekEnd', week_end,
      'entry', NULL,
      'totalPlayers', total_count
    );
  END IF;

  RETURN jsonb_build_object(
    'weekStart', p_week_start,
    'weekEnd', week_end,
    'entry', jsonb_build_object(
      'rank', row_data.rank,
      'displayName', row_data.display_name,
      'weeklyScore', row_data.weekly_score,
      'daysPlayed', row_data.days_played,
      'bestDailyScore', row_data.best_daily_score,
      'profileFrameId', row_data.profile_frame_id,
      'isCurrentPlayer', true
    ),
    'totalPlayers', total_count
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- Claim streak milestone reward (idempotent)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.claim_daily_streak_reward(p_milestone integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  grant_row public.reward_grants%ROWTYPE;
  coins bigint;
  wallet public.player_wallets;
  idempotency text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  coins := public.daily_streak_milestone_coins(p_milestone);
  IF coins IS NULL THEN
    RAISE EXCEPTION 'invalid_milestone';
  END IF;

  SELECT * INTO grant_row
  FROM public.reward_grants
  WHERE user_id = v_user_id
    AND source_type = 'daily_streak'
    AND reward_key = 'milestone_' || p_milestone::text
    AND reward_type = 'blaze_coins'
    AND status = 'eligible'
  ORDER BY created_at ASC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'reward_not_available';
  END IF;

  IF grant_row.status = 'claimed' THEN
    RETURN jsonb_build_object(
      'alreadyClaimed', true,
      'milestone', p_milestone,
      'amount', grant_row.amount
    );
  END IF;

  idempotency := 'daily_streak_claim:' || grant_row.id::text;

  wallet := public.apply_wallet_delta(
    v_user_id,
    grant_row.amount,
    'grant',
    'daily_streak_reward',
    idempotency,
    jsonb_build_object(
      'milestone', p_milestone,
      'sourceId', grant_row.source_id
    )
  );

  UPDATE public.reward_grants
  SET status = 'claimed', claimed_at = now()
  WHERE id = grant_row.id;

  RETURN jsonb_build_object(
    'alreadyClaimed', false,
    'milestone', p_milestone,
    'amount', grant_row.amount,
    'balance', wallet.blaze_coins
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- Streak + reward read RPC
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_daily_streak_status()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  streak_row public.daily_challenge_streaks%ROWTYPE;
  eligible jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT * INTO streak_row
  FROM public.daily_challenge_streaks
  WHERE user_id = v_user_id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'grantId', rg.id,
    'milestone', (regexp_replace(rg.reward_key, '^milestone_', '')::integer),
    'amount', rg.amount,
    'status', rg.status,
    'sourceId', rg.source_id
  ) ORDER BY rg.created_at), '[]'::jsonb)
  INTO eligible
  FROM public.reward_grants rg
  WHERE rg.user_id = v_user_id
    AND rg.source_type = 'daily_streak'
    AND rg.reward_type = 'blaze_coins'
    AND rg.status = 'eligible';

  RETURN jsonb_build_object(
    'currentStreak', COALESCE(streak_row.current_streak, 0),
    'longestStreak', COALESCE(streak_row.longest_streak, 0),
    'lastCompletedChallengeDate', streak_row.last_completed_date,
    'updatedAt', streak_row.updated_at,
    'eligibleRewards', eligible
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- Upgrade complete_daily_challenge: accept result, streak, rank in one txn
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
  streak_result jsonb;
  rank_result jsonb;
  was_already_completed boolean := false;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
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
    was_already_completed := true;
    rank_result := public.compute_daily_challenge_rank(challenge.id, attempt.id);
    RETURN jsonb_build_object(
      'alreadyCompleted', true,
      'attemptId', attempt.id,
      'score', attempt.verified_score,
      'exact21Count', attempt.verified_exact_21_count,
      'fiveCardClearCount', attempt.verified_five_card_clears,
      'bustCount', attempt.verified_bust_count,
      'completionMs', attempt.elapsed_time_ms,
      'rulesVersion', attempt.rules_version,
      'verificationStatus', attempt.verification_status,
      'currentStreak', (SELECT current_streak FROM public.daily_challenge_streaks WHERE user_id = v_user_id),
      'longestStreak', (SELECT longest_streak FROM public.daily_challenge_streaks WHERE user_id = v_user_id),
      'dailyRank', rank_result->'rank',
      'totalPlayers', rank_result->'totalPlayers'
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
    verification_status = 'accepted'
  WHERE id = attempt.id
  RETURNING * INTO attempt;

  streak_result := public.apply_daily_challenge_streak(v_user_id, challenge.challenge_date);
  rank_result := public.compute_daily_challenge_rank(challenge.id, attempt.id);

  RETURN jsonb_build_object(
    'alreadyCompleted', false,
    'attemptId', attempt.id,
    'score', attempt.verified_score,
    'exact21Count', attempt.verified_exact_21_count,
    'fiveCardClearCount', attempt.verified_five_card_clears,
    'bustCount', attempt.verified_bust_count,
    'completionMs', attempt.elapsed_time_ms,
    'rulesVersion', attempt.rules_version,
    'verificationStatus', attempt.verification_status,
    'currentStreak', streak_result->'currentStreak',
    'longestStreak', streak_result->'longestStreak',
    'dailyRank', rank_result->'rank',
    'totalPlayers', rank_result->'totalPlayers'
  );
END;
$$;

-- Backfill pending completions to accepted for leaderboard eligibility
UPDATE public.daily_challenge_attempts
SET verification_status = 'accepted'
WHERE status = 'completed'
  AND attempt_type = 'ranked'
  AND verification_status = 'pending';

-- ---------------------------------------------------------------------------
-- RLS hardening — streaks server-only writes
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS daily_challenge_streaks_insert_own ON public.daily_challenge_streaks;
DROP POLICY IF EXISTS daily_challenge_streaks_update_own ON public.daily_challenge_streaks;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.get_daily_leaderboard(uuid, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_daily_leaderboard_position(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_weekly_leaderboard(date, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_weekly_leaderboard_position(date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_daily_streak_reward(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_daily_streak_status() TO authenticated;

COMMENT ON FUNCTION public.get_daily_leaderboard IS
  'Paginated daily Blaze leaderboard with canonical server-side tie-breakers.';
COMMENT ON FUNCTION public.get_weekly_leaderboard IS
  'Weekly Blaze leaderboard: sum of official daily scores for UTC Mon–Sun week.';
COMMENT ON FUNCTION public.claim_daily_streak_reward IS
  'Claims a milestone Blaze Coin reward from server registry; idempotent per grant row.';
