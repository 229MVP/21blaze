-- 21 Blaze Version 1.1A — Rewards and Economy Foundation
-- Safe to re-run (CREATE OR REPLACE, IF NOT EXISTS, DROP POLICY IF EXISTS).
-- Depends on 0005 (apply_wallet_delta, ensure_player_wallet) and
-- 0006/0007 (player_progression, verified_scores, online_matches,
-- grant_player_xp, daily_reward_for_streak_day).
--
-- Scope:
--   1) Update the daily reward calendar to Version 1.1A values.
--   2) Add the Version 1.1A Solo match economy (flat completion coins,
--      first-of-day bonus, active-play-time coins) as a new, additive,
--      fully idempotent reward flow that does not modify or remove the
--      Version 1.0 `claim_solo_match_coins` function or its callers.

-- ---------------------------------------------------------------------------
-- daily_reward_for_streak_day — Version 1.1A calendar
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.daily_reward_for_streak_day(p_streak_day integer)
RETURNS TABLE (
  streak_day integer,
  blaze_coins integer,
  xp integer,
  cosmetic_id text
)
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT
    d.day,
    d.blaze_coins,
    d.xp,
    d.cosmetic_id
  FROM (
    VALUES
      (1, 20, 20, NULL::text),
      (2, 25, 25, NULL::text),
      (3, 30, 30, NULL::text),
      (4, 40, 40, NULL::text),
      (5, 50, 50, NULL::text),
      (6, 60, 60, NULL::text),
      (7, 100, 100, 'seven_day_blaze_title'::text)
  ) AS d(day, blaze_coins, xp, cosmetic_id)
  WHERE d.day = ((((GREATEST(COALESCE(p_streak_day, 1), 1) - 1) % 7) + 1));
$$;

COMMENT ON FUNCTION public.daily_reward_for_streak_day(integer) IS
  'Version 1.1A daily streak calendar: 20/25/30/40/50/60/100 Blaze Coins. Day 7 grants the existing seven_day_blaze_title cosmetic.';

-- ---------------------------------------------------------------------------
-- Daily mission pool — align two templates to the Version 1.1A spec pool
-- and add the missing "fewer than three busts" mission.
-- ---------------------------------------------------------------------------

-- "Complete 3 Solo Matches" (was 2).
UPDATE public.mission_templates
SET
  name = 'Complete 3 Solo Matches',
  description = 'Complete 3 verified Solo matches',
  target_value = 3
WHERE id = 'complete_two_solo_matches';

-- "Complete 2 Five-Card Clears" (was 3).
UPDATE public.mission_templates
SET
  name = 'Five-Card Clears ×2',
  description = 'Complete 2 five-card clears',
  target_value = 2
WHERE id = 'get_three_five_card_clears';

INSERT INTO public.mission_templates (
  id, name, description, mission_type, target_value,
  xp_reward, blaze_coin_reward, category,
  requires_live_duel, requires_ranked, is_enabled, sort_order
)
VALUES (
  'complete_low_bust_match',
  'Clean Match',
  'Complete one match with fewer than 3 busts',
  'low_busts',
  1,
  75,
  30,
  'skill',
  false,
  false,
  true,
  60
)
ON CONFLICT (id) DO UPDATE
SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  mission_type = EXCLUDED.mission_type,
  target_value = EXCLUDED.target_value,
  xp_reward = EXCLUDED.xp_reward,
  blaze_coin_reward = EXCLUDED.blaze_coin_reward,
  category = EXCLUDED.category,
  requires_live_duel = EXCLUDED.requires_live_duel,
  requires_ranked = EXCLUDED.requires_ranked,
  is_enabled = EXCLUDED.is_enabled,
  sort_order = EXCLUDED.sort_order;

-- ---------------------------------------------------------------------------
-- apply_mission_progress_from_match — add p_busts for the "low_busts" type.
-- Adding one new trailing parameter with a default is a compatible
-- CREATE OR REPLACE; existing 10-argument callers keep working unchanged
-- (p_busts defaults to NULL, and the "low_busts" mission type simply never
-- progresses for callers that don't supply it).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.apply_mission_progress_from_match(
  p_user_id uuid,
  p_match_id uuid,
  p_match_mode text,
  p_exact_twenty_one_clears integer DEFAULT 0,
  p_five_card_clears integer DEFAULT 0,
  p_total_lane_clears integer DEFAULT 0,
  p_maximum_multiplier_reached integer DEFAULT 0,
  p_match_completed boolean DEFAULT false,
  p_valid_completion boolean DEFAULT false,
  p_allow_live_duel boolean DEFAULT true,
  p_allow_ranked boolean DEFAULT true,
  p_busts integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  mission_day date := (now() AT TIME ZONE 'utc')::date;
  mission_rec public.player_daily_missions%ROWTYPE;
  tmpl public.mission_templates%ROWTYPE;
  delta integer;
  new_progress integer;
  updates jsonb := '[]'::jsonb;
  mode_norm text;
  is_live boolean;
  is_solo boolean;
  is_casual boolean;
  is_ranked boolean;
BEGIN
  IF p_user_id IS NULL OR p_match_id IS NULL THEN
    RAISE EXCEPTION 'user_id and match_id are required';
  END IF;

  IF NOT COALESCE(p_match_completed, false) OR NOT COALESCE(p_valid_completion, false) THEN
    RETURN jsonb_build_object(
      'applied', false,
      'reason', 'invalid_or_incomplete_match',
      'updates', '[]'::jsonb
    );
  END IF;

  mode_norm := lower(COALESCE(p_match_mode, 'unknown'));
  is_solo := mode_norm IN ('solo');
  is_casual := mode_norm IN ('casual', 'quick_match', 'friend');
  is_ranked := mode_norm IN ('ranked');
  is_live := is_casual OR is_ranked;

  PERFORM public.assign_daily_missions_secure(
    p_user_id,
    p_allow_live_duel,
    p_allow_ranked,
    mission_day
  );

  FOR mission_rec IN
    SELECT *
    FROM public.player_daily_missions
    WHERE user_id = p_user_id
      AND mission_date = mission_day
    FOR UPDATE
  LOOP
    SELECT * INTO tmpl
    FROM public.mission_templates
    WHERE id = mission_rec.mission_template_id;

    IF NOT FOUND THEN
      CONTINUE;
    END IF;

    -- Skip if this match already contributed to this mission.
    IF EXISTS (
      SELECT 1
      FROM public.mission_progress_events
      WHERE player_mission_id = mission_rec.id
        AND match_id = p_match_id
    ) THEN
      CONTINUE;
    END IF;

    delta := 0;

    CASE tmpl.mission_type
      WHEN 'play_match' THEN
        delta := 1;
      WHEN 'live_duel' THEN
        IF is_live THEN
          delta := 1;
        END IF;
      WHEN 'lane_clears' THEN
        delta := GREATEST(COALESCE(p_total_lane_clears, 0), 0);
      WHEN 'exact_21' THEN
        delta := GREATEST(COALESCE(p_exact_twenty_one_clears, 0), 0);
      WHEN 'five_card_clear' THEN
        delta := GREATEST(COALESCE(p_five_card_clears, 0), 0);
      WHEN 'reach_multiplier_x3' THEN
        IF COALESCE(p_maximum_multiplier_reached, 0) >= 3 THEN
          delta := 1;
        END IF;
      WHEN 'reach_multiplier_x5' THEN
        IF COALESCE(p_maximum_multiplier_reached, 0) >= 5 THEN
          delta := 1;
        END IF;
      WHEN 'solo_match' THEN
        IF is_solo THEN
          delta := 1;
        END IF;
      WHEN 'casual_duel' THEN
        IF is_casual THEN
          delta := 1;
        END IF;
      WHEN 'ranked_match' THEN
        IF is_ranked THEN
          delta := 1;
        END IF;
      WHEN 'low_busts' THEN
        IF p_busts IS NOT NULL AND p_busts < 3 THEN
          delta := 1;
        END IF;
      ELSE
        delta := 0;
    END CASE;

    IF delta <= 0 THEN
      CONTINUE;
    END IF;

    new_progress := LEAST(mission_rec.progress + delta, mission_rec.target_value);

    IF new_progress = mission_rec.progress THEN
      -- Still record the event so duplicate match processing is blocked.
      INSERT INTO public.mission_progress_events (
        user_id,
        player_mission_id,
        match_id,
        progress_delta,
        progress_after
      )
      VALUES (
        p_user_id,
        mission_rec.id,
        p_match_id,
        0,
        mission_rec.progress
      )
      ON CONFLICT (player_mission_id, match_id) DO NOTHING;
      CONTINUE;
    END IF;

    UPDATE public.player_daily_missions
    SET
      progress = new_progress,
      completed_at = CASE
        WHEN new_progress >= target_value AND completed_at IS NULL THEN now()
        ELSE completed_at
      END
    WHERE id = mission_rec.id
    RETURNING * INTO mission_rec;

    INSERT INTO public.mission_progress_events (
      user_id,
      player_mission_id,
      match_id,
      progress_delta,
      progress_after
    )
    VALUES (
      p_user_id,
      mission_rec.id,
      p_match_id,
      delta,
      new_progress
    )
    ON CONFLICT (player_mission_id, match_id) DO NOTHING;

    updates := updates || jsonb_build_array(
      jsonb_build_object(
        'player_mission_id', mission_rec.id,
        'mission_template_id', mission_rec.mission_template_id,
        'progress_delta', delta,
        'progress', mission_rec.progress,
        'target_value', mission_rec.target_value,
        'completed_at', mission_rec.completed_at,
        'is_complete', mission_rec.completed_at IS NOT NULL
      )
    );
  END LOOP;

  RETURN jsonb_build_object(
    'applied', true,
    'match_id', p_match_id,
    'mission_date', mission_day,
    'updates', updates
  );
END;
$$;

REVOKE ALL ON FUNCTION public.apply_mission_progress_from_match(
  uuid, uuid, text, integer, integer, integer, integer, boolean, boolean, boolean, boolean, integer
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_mission_progress_from_match(
  uuid, uuid, text, integer, integer, integer, integer, boolean, boolean, boolean, boolean, integer
) TO service_role;

COMMENT ON FUNCTION public.apply_mission_progress_from_match(
  uuid, uuid, text, integer, integer, integer, integer, boolean, boolean, boolean, boolean, integer
) IS
  'Version 1.1A: adds p_busts for the low_busts ("fewer than 3 busts") mission type. Applies verified match summary progress to the player''s UTC daily missions. Idempotent per mission/match.';

-- ---------------------------------------------------------------------------
-- match_v1_1_rewards — one itemized reward summary row per rewarded match
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.match_v1_1_rewards (
  match_id uuid PRIMARY KEY REFERENCES public.online_matches (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  match_coins integer NOT NULL DEFAULT 0,
  first_match_bonus_coins integer NOT NULL DEFAULT 0,
  active_time_coins integer NOT NULL DEFAULT 0,
  active_time_seconds integer NOT NULL DEFAULT 0,
  xp_granted integer NOT NULL DEFAULT 0,
  is_first_of_day boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT match_v1_1_rewards_coins_check CHECK (
    match_coins >= 0 AND first_match_bonus_coins >= 0 AND active_time_coins >= 0
  ),
  CONSTRAINT match_v1_1_rewards_seconds_check CHECK (active_time_seconds >= 0),
  CONSTRAINT match_v1_1_rewards_xp_check CHECK (xp_granted >= 0)
);

CREATE INDEX IF NOT EXISTS match_v1_1_rewards_user_created_idx
  ON public.match_v1_1_rewards (user_id, created_at DESC);

ALTER TABLE public.match_v1_1_rewards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "match_v1_1_rewards_select_own" ON public.match_v1_1_rewards;
CREATE POLICY "match_v1_1_rewards_select_own"
  ON public.match_v1_1_rewards
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

GRANT SELECT ON public.match_v1_1_rewards TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.match_v1_1_rewards FROM authenticated, anon;
REVOKE ALL ON public.match_v1_1_rewards FROM anon;

COMMENT ON TABLE public.match_v1_1_rewards IS
  'One itemized Version 1.1A reward summary per rewarded match. Written once by claim_v1_1_match_reward; read back on retry for idempotent identical results.';

-- ---------------------------------------------------------------------------
-- Pure helpers — Version 1.1A economy math (mirrors src/config/economyConfig.ts)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.calculate_v1_1_match_coins(p_is_first_of_day boolean)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT 10 + (CASE WHEN COALESCE(p_is_first_of_day, false) THEN 20 ELSE 0 END);
$$;

REVOKE ALL ON FUNCTION public.calculate_v1_1_match_coins(boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.calculate_v1_1_match_coins(boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_v1_1_match_coins(boolean) TO service_role;

COMMENT ON FUNCTION public.calculate_v1_1_match_coins(boolean) IS
  'Version 1.1A: 10 flat completion coins, +20 if the first completed Solo match of the UTC day.';

CREATE OR REPLACE FUNCTION public.calculate_v1_1_active_time_coins(
  p_active_seconds integer,
  p_already_granted_today integer
)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT GREATEST(
    0,
    LEAST(
      FLOOR(GREATEST(COALESCE(p_active_seconds, 0), 0) / 60.0)::integer,
      20 - GREATEST(COALESCE(p_already_granted_today, 0), 0)
    )
  );
$$;

REVOKE ALL ON FUNCTION public.calculate_v1_1_active_time_coins(integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.calculate_v1_1_active_time_coins(integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_v1_1_active_time_coins(integer, integer) TO service_role;

COMMENT ON FUNCTION public.calculate_v1_1_active_time_coins(integer, integer) IS
  'Version 1.1A: 1 coin per full active minute, capped at 20 total active-time coins per UTC day.';

-- ---------------------------------------------------------------------------
-- claim_v1_1_match_reward — one secure, idempotent Solo match reward flow
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.claim_v1_1_match_reward(
  p_user_id uuid,
  p_match_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  match_row public.online_matches%ROWTYPE;
  score_row public.verified_scores%ROWTYPE;
  existing public.match_v1_1_rewards%ROWTYPE;
  is_first_of_day boolean := false;
  match_coins integer := 0;
  bonus_coins integer := 0;
  active_seconds integer := 0;
  wall_clock_seconds integer := 0;
  already_active_today integer := 0;
  active_coins integer := 0;
  xp_row public.progression_transactions%ROWTYPE;
  xp_granted integer := 0;
  wallet public.player_wallets;
  reward_row public.match_v1_1_rewards%ROWTYPE;
  game_duration_seconds CONSTANT integer := 120;
BEGIN
  IF p_user_id IS NULL OR p_match_id IS NULL THEN
    RAISE EXCEPTION 'user_id and match_id are required';
  END IF;

  -- Idempotent: a prior call already computed and stored the summary.
  SELECT * INTO existing
  FROM public.match_v1_1_rewards
  WHERE match_id = p_match_id;

  IF FOUND THEN
    IF existing.user_id IS DISTINCT FROM p_user_id THEN
      RAISE EXCEPTION 'match % does not belong to user %', p_match_id, p_user_id;
    END IF;
    SELECT * INTO wallet FROM public.player_wallets WHERE user_id = p_user_id;
    RETURN jsonb_build_object(
      'already_processed', true,
      'match_id', p_match_id,
      'match_coins', existing.match_coins,
      'first_match_bonus_coins', existing.first_match_bonus_coins,
      'active_time_coins', existing.active_time_coins,
      'active_time_seconds', existing.active_time_seconds,
      'xp_granted', existing.xp_granted,
      'total_coins', existing.match_coins + existing.first_match_bonus_coins + existing.active_time_coins,
      'balance', COALESCE(wallet.blaze_coins, 0)
    );
  END IF;

  SELECT * INTO match_row
  FROM public.online_matches
  WHERE id = p_match_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'match % not found', p_match_id;
  END IF;

  IF match_row.user_id IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'match % does not belong to user %', p_match_id, p_user_id;
  END IF;

  IF match_row.status IS DISTINCT FROM 'completed' THEN
    RAISE EXCEPTION 'match % is not completed (status=%)', p_match_id, match_row.status;
  END IF;

  SELECT * INTO score_row
  FROM public.verified_scores
  WHERE match_id = p_match_id
    AND user_id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'verified score not found for match %', p_match_id;
  END IF;

  PERFORM public.ensure_player_wallet(p_user_id);

  -- Quit matches are invalid completions: zero reward, but still recorded
  -- once so a retry returns the same (zero) result instead of erroring.
  IF score_row.game_over_reason = 'quit' THEN
    INSERT INTO public.match_v1_1_rewards (
      match_id, user_id, match_coins, first_match_bonus_coins,
      active_time_coins, active_time_seconds, xp_granted, is_first_of_day
    )
    VALUES (p_match_id, p_user_id, 0, 0, 0, 0, 0, false)
    ON CONFLICT (match_id) DO NOTHING
    RETURNING * INTO reward_row;

    SELECT * INTO wallet FROM public.player_wallets WHERE user_id = p_user_id;
    RETURN jsonb_build_object(
      'already_processed', false,
      'match_id', p_match_id,
      'match_coins', 0,
      'first_match_bonus_coins', 0,
      'active_time_coins', 0,
      'active_time_seconds', 0,
      'xp_granted', 0,
      'total_coins', 0,
      'balance', COALESCE(wallet.blaze_coins, 0)
    );
  END IF;

  -- First-of-day check (UTC), scoped to the Version 1.1A bonus source key only.
  SELECT NOT EXISTS (
    SELECT 1
    FROM public.wallet_transactions wt
    WHERE wt.user_id = p_user_id
      AND wt.source_key = 'v1_1_first_day'
      AND (wt.created_at AT TIME ZONE 'utc')::date = (now() AT TIME ZONE 'utc')::date
  ) INTO is_first_of_day;

  match_coins := public.calculate_v1_1_match_coins(false);
  bonus_coins := CASE
    WHEN is_first_of_day THEN
      public.calculate_v1_1_match_coins(true) - public.calculate_v1_1_match_coins(false)
    ELSE 0
  END;

  -- Active time: the smaller of (a) the verified replay's implied elapsed
  -- time (game_duration - time_remaining, which by construction excludes
  -- countdown and paused time since the match timer only advances while
  -- running) and (b) real wall-clock time between match start and now.
  -- Neither the client-reported move-log timestamps nor a long real-world
  -- pause can inflate the credited amount beyond the true minimum of both.
  wall_clock_seconds := GREATEST(
    0,
    LEAST(
      EXTRACT(EPOCH FROM (now() - match_row.started_at))::integer,
      game_duration_seconds
    )
  );
  active_seconds := LEAST(
    GREATEST(0, game_duration_seconds - COALESCE(score_row.time_remaining_seconds, 0)),
    wall_clock_seconds
  );

  SELECT COALESCE(SUM(wt.amount), 0) INTO already_active_today
  FROM public.wallet_transactions wt
  WHERE wt.user_id = p_user_id
    AND wt.source_key = 'v1_1_active_time'
    AND (wt.created_at AT TIME ZONE 'utc')::date = (now() AT TIME ZONE 'utc')::date;

  active_coins := public.calculate_v1_1_active_time_coins(active_seconds, already_active_today);

  -- Three independently idempotent wallet deltas — a duplicate call for
  -- this match_id can never re-grant any one of them twice.
  wallet := public.apply_wallet_delta(
    p_user_id,
    match_coins::bigint,
    'earn',
    'v1_1_match_coins',
    'v1_1_match_coins:' || p_match_id::text,
    jsonb_build_object('match_id', p_match_id, 'coins', match_coins)
  );

  IF bonus_coins > 0 THEN
    wallet := public.apply_wallet_delta(
      p_user_id,
      bonus_coins::bigint,
      'earn',
      'v1_1_first_day',
      'v1_1_first_day:' || p_match_id::text,
      jsonb_build_object('match_id', p_match_id, 'coins', bonus_coins)
    );
  END IF;

  IF active_coins > 0 THEN
    wallet := public.apply_wallet_delta(
      p_user_id,
      active_coins::bigint,
      'earn',
      'v1_1_active_time',
      'v1_1_active_time:' || p_match_id::text,
      jsonb_build_object(
        'match_id', p_match_id,
        'coins', active_coins,
        'active_time_seconds', active_seconds
      )
    );
  END IF;

  -- XP for this match is granted by the existing solo-match progression
  -- flow (grant_player_xp via the submit-match Edge Function), using the
  -- same idempotency key format. Read it back for display only — never
  -- grant XP a second time here.
  SELECT * INTO xp_row
  FROM public.progression_transactions
  WHERE idempotency_key = 'progression:solo:' || p_match_id::text;

  IF FOUND THEN
    xp_granted := GREATEST(0, xp_row.xp_amount);
  END IF;

  INSERT INTO public.match_v1_1_rewards (
    match_id, user_id, match_coins, first_match_bonus_coins,
    active_time_coins, active_time_seconds, xp_granted, is_first_of_day
  )
  VALUES (
    p_match_id, p_user_id, match_coins, bonus_coins,
    active_coins, active_seconds, xp_granted, is_first_of_day
  )
  ON CONFLICT (match_id) DO NOTHING
  RETURNING * INTO reward_row;

  IF NOT FOUND THEN
    -- Lost an insert race — return the winner's row for a consistent result.
    SELECT * INTO reward_row FROM public.match_v1_1_rewards WHERE match_id = p_match_id;
  END IF;

  SELECT * INTO wallet FROM public.player_wallets WHERE user_id = p_user_id;

  RETURN jsonb_build_object(
    'already_processed', false,
    'match_id', p_match_id,
    'match_coins', reward_row.match_coins,
    'first_match_bonus_coins', reward_row.first_match_bonus_coins,
    'active_time_coins', reward_row.active_time_coins,
    'active_time_seconds', reward_row.active_time_seconds,
    'xp_granted', reward_row.xp_granted,
    'total_coins',
      reward_row.match_coins + reward_row.first_match_bonus_coins + reward_row.active_time_coins,
    'balance', COALESCE(wallet.blaze_coins, 0)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.claim_v1_1_match_reward(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_v1_1_match_reward(uuid, uuid) TO service_role;

COMMENT ON FUNCTION public.claim_v1_1_match_reward(uuid, uuid) IS
  'Version 1.1A: idempotent Solo match reward flow. Grants flat completion coins, first-of-day bonus, and capped active-time coins; reads back (does not re-grant) XP from the existing solo progression flow. Never trusts client-submitted amounts or active time.';

-- Feature flag record (client flags remain the source of truth; this is
-- informational only, matching the pattern from 0006).
INSERT INTO public.app_configuration (key, value)
VALUES ('v1_1_rewards_enabled', 'false'::jsonb)
ON CONFLICT (key) DO NOTHING;
