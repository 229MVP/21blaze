-- Version 1.3 Phase 4 — Daily Missions + XP / Player Level + Progression
-- XP curve, fixed daily missions, daily challenge XP, mission progress extensions,
-- future sabotage unlock hooks, authenticated read/claim RPCs.

-- ---------------------------------------------------------------------------
-- XP curve (v1.3): Level 1→2 = 500, 2→3 = 600, 3→4 = 700 … (+100 per level)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.xp_required_for_level(p_level integer)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_level IS NULL OR p_level < 1 THEN 0
    WHEN p_level >= 50 THEN 0
    ELSE 500 + ((p_level - 1) * 100)
  END;
$$;

COMMENT ON FUNCTION public.xp_required_for_level(integer) IS
  'XP needed to advance from p_level to p_level+1. v1.3 curve: 500 + (level-1)*100. 0 at max level 50.';

CREATE OR REPLACE FUNCTION public.get_level_from_lifetime_xp(p_total_xp bigint)
RETURNS integer
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  lvl integer := 1;
  remaining bigint := GREATEST(COALESCE(p_total_xp, 0), 0);
  needed integer;
BEGIN
  WHILE lvl < 50 LOOP
    needed := public.xp_required_for_level(lvl);
    IF needed <= 0 OR remaining < needed THEN
      EXIT;
    END IF;
    remaining := remaining - needed;
    lvl := lvl + 1;
  END LOOP;
  RETURN lvl;
END;
$$;

REVOKE ALL ON FUNCTION public.get_level_from_lifetime_xp(bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_level_from_lifetime_xp(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_level_from_lifetime_xp(bigint) TO service_role;

CREATE OR REPLACE FUNCTION public.get_progress_to_next_level(p_total_xp bigint)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  lvl integer;
  remaining bigint;
  needed integer;
  walked bigint := 0;
  i integer;
BEGIN
  remaining := GREATEST(COALESCE(p_total_xp, 0), 0);
  lvl := 1;

  WHILE lvl < 50 LOOP
    needed := public.xp_required_for_level(lvl);
    IF needed <= 0 OR remaining < needed THEN
      EXIT;
    END IF;
    remaining := remaining - needed;
    lvl := lvl + 1;
  END LOOP;

  needed := public.xp_required_for_level(lvl);

  RETURN jsonb_build_object(
    'level', lvl,
    'total_xp', GREATEST(COALESCE(p_total_xp, 0), 0),
    'current_level_xp', remaining,
    'xp_required_for_next_level', needed
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_progress_to_next_level(bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_progress_to_next_level(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_progress_to_next_level(bigint) TO service_role;

-- ---------------------------------------------------------------------------
-- Expand progression source types for daily challenge + streak milestone XP
-- ---------------------------------------------------------------------------
ALTER TABLE public.progression_transactions
  DROP CONSTRAINT IF EXISTS progression_transactions_source_check;

ALTER TABLE public.progression_transactions
  ADD CONSTRAINT progression_transactions_source_check CHECK (
    source_type IN (
      'solo_match',
      'casual_duel',
      'ranked_duel',
      'daily_mission',
      'daily_reward',
      'level_reward',
      'daily_challenge_completion',
      'daily_streak_milestone',
      'admin_adjustment',
      'reversal'
    )
  );

-- ---------------------------------------------------------------------------
-- Future progression unlock types (architecture only — not granted in v1.3)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.progression_unlock_types (
  id text PRIMARY KEY,
  reward_type text NOT NULL,
  display_name text NOT NULL,
  description text NOT NULL DEFAULT '',
  is_enabled boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT progression_unlock_types_reward_type_check CHECK (
    reward_type IN (
      'cosmetic',
      'blaze_coins',
      'title',
      'sabotage_unlock',
      'defense_unlock',
      'deferred'
    )
  )
);

INSERT INTO public.progression_unlock_types (id, reward_type, display_name, description, is_enabled, metadata)
VALUES
  ('sabotage_time_burn', 'sabotage_unlock', 'Time Burn', 'Future Sabotage ability.', false, '{"sabotageKey":"time_burn"}'::jsonb),
  ('sabotage_blind_draw', 'sabotage_unlock', 'Blind Draw', 'Future Sabotage ability.', false, '{"sabotageKey":"blind_draw"}'::jsonb),
  ('sabotage_frozen_lane', 'sabotage_unlock', 'Frozen Lane', 'Future Sabotage ability.', false, '{"sabotageKey":"frozen_lane"}'::jsonb),
  ('sabotage_lane_fog', 'sabotage_unlock', 'Lane Fog', 'Future Sabotage ability.', false, '{"sabotageKey":"lane_fog"}'::jsonb),
  ('sabotage_multiplier_jam', 'sabotage_unlock', 'Multiplier Jam', 'Future Sabotage ability.', false, '{"sabotageKey":"multiplier_jam"}'::jsonb),
  ('defense_blaze_shield', 'defense_unlock', 'Blaze Shield', 'Future defense ability.', false, '{"defenseKey":"blaze_shield"}'::jsonb),
  ('defense_cleanse', 'defense_unlock', 'Cleanse', 'Future defense ability.', false, '{"defenseKey":"cleanse"}'::jsonb),
  ('defense_mirror_flame', 'defense_unlock', 'Mirror Flame', 'Future defense ability.', false, '{"defenseKey":"mirror_flame"}'::jsonb)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.progression_unlock_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS progression_unlock_types_select_authenticated ON public.progression_unlock_types;
CREATE POLICY progression_unlock_types_select_authenticated
  ON public.progression_unlock_types
  FOR SELECT
  TO authenticated
  USING (true);

GRANT SELECT ON public.progression_unlock_types TO authenticated;

-- ---------------------------------------------------------------------------
-- Mission templates — v1.3 fixed daily set + extended categories
-- ---------------------------------------------------------------------------
ALTER TABLE public.mission_templates
  DROP CONSTRAINT IF EXISTS mission_templates_category_check;

ALTER TABLE public.mission_templates
  ADD CONSTRAINT mission_templates_category_check CHECK (
    category IN (
      'participation',
      'skill',
      'mode',
      'gameplay',
      'score',
      'exact_21',
      'five_card',
      'survival',
      'daily_challenge',
      'completion'
    )
  );

INSERT INTO public.mission_templates (
  id,
  name,
  description,
  mission_type,
  target_value,
  xp_reward,
  blaze_coin_reward,
  category,
  requires_live_duel,
  requires_ranked,
  is_enabled,
  sort_order
)
VALUES
  (
    'v1_3_exact_21_three',
    'Hit Exact 21 ×3',
    'Clear 3 lanes at exactly 21',
    'exact_21',
    3,
    50,
    0,
    'exact_21',
    false,
    false,
    true,
    1
  ),
  (
    'v1_3_five_card_two',
    'Five-Card Clears ×2',
    'Complete 2 five-card clears',
    'five_card_clear',
    2,
    40,
    0,
    'five_card',
    false,
    false,
    true,
    2
  ),
  (
    'v1_3_daily_blaze',
    'Complete Daily Blaze',
    'Finish today''s official ranked Daily Blaze',
    'daily_challenge',
    1,
    75,
    25,
    'daily_challenge',
    false,
    false,
    true,
    3
  ),
  (
    'v1_3_solo_three',
    'Complete 3 Solo Games',
    'Complete 3 verified Solo matches',
    'solo_match',
    3,
    45,
    0,
    'completion',
    false,
    false,
    true,
    4
  ),
  (
    'v1_3_lane_ten',
    'Clear 10 Lanes',
    'Clear 10 total lanes',
    'lane_clears',
    10,
    50,
    0,
    'gameplay',
    false,
    false,
    true,
    5
  ),
  (
    'v1_3_score_8000',
    'Score 8,000+',
    'Score at least 8,000 in one game',
    'score_threshold',
    8000,
    60,
    0,
    'score',
    false,
    false,
    true,
    6
  ),
  (
    'v1_3_cards_no_bust',
    'Survival Run',
    'Play 15 cards without busting in one game',
    'cards_without_bust',
    1,
    55,
    0,
    'survival',
    false,
    false,
    true,
    7
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
-- grant_player_xp — accept new source types
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.grant_player_xp(
  p_target_user_id uuid,
  p_xp_amount integer,
  p_source_type text,
  p_source_id text,
  p_idempotency_key text,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  prog public.player_progression;
  existing public.progression_transactions%ROWTYPE;
  level_before integer;
  level_after integer;
  current_xp integer;
  total_after bigint;
  needed integer;
  levels_crossed integer[] := ARRAY[]::integer[];
  rewards jsonb := '[]'::jsonb;
  reward_row jsonb;
  crossed integer;
  tx_id uuid;
  xp_granted integer;
BEGIN
  IF p_target_user_id IS NULL THEN
    RAISE EXCEPTION 'target_user_id is required';
  END IF;
  IF p_idempotency_key IS NULL OR length(trim(p_idempotency_key)) = 0 THEN
    RAISE EXCEPTION 'idempotency_key is required';
  END IF;
  IF p_source_type IS NULL OR p_source_type NOT IN (
    'solo_match',
    'casual_duel',
    'ranked_duel',
    'daily_mission',
    'daily_reward',
    'level_reward',
    'daily_challenge_completion',
    'daily_streak_milestone',
    'admin_adjustment',
    'reversal'
  ) THEN
    RAISE EXCEPTION 'invalid source_type: %', p_source_type;
  END IF;
  IF p_xp_amount IS NULL OR p_xp_amount < 0 THEN
    RAISE EXCEPTION 'xp_amount must be a non-negative integer';
  END IF;

  prog := public.ensure_player_progression(p_target_user_id);

  SELECT * INTO existing
  FROM public.progression_transactions
  WHERE idempotency_key = p_idempotency_key;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'xp_granted', 0,
      'level_before', existing.level_before,
      'level_after', existing.level_after,
      'levels_gained', GREATEST(existing.level_after - existing.level_before, 0),
      'current_level_xp', prog.current_level_xp,
      'xp_required_for_next_level', public.xp_required_for_level(prog.level),
      'total_xp_after', prog.total_xp,
      'levels_crossed', '[]'::jsonb,
      'rewards_granted', '[]'::jsonb,
      'already_processed', true,
      'transaction_id', existing.id
    );
  END IF;

  xp_granted := p_xp_amount;
  level_before := prog.level;
  level_after := prog.level;
  current_xp := prog.current_level_xp + xp_granted;
  total_after := prog.total_xp + xp_granted;

  IF xp_granted > 0 THEN
    WHILE level_after < 50 LOOP
      needed := public.xp_required_for_level(level_after);
      EXIT WHEN needed <= 0 OR current_xp < needed;
      current_xp := current_xp - needed;
      level_after := level_after + 1;
      levels_crossed := array_append(levels_crossed, level_after);
    END LOOP;
  END IF;

  IF level_after > 50 THEN
    level_after := 50;
  END IF;

  UPDATE public.player_progression
  SET
    level = level_after,
    total_xp = total_after,
    current_level_xp = current_xp,
    highest_level_reached = GREATEST(highest_level_reached, level_after),
    updated_at = now()
  WHERE user_id = p_target_user_id
  RETURNING * INTO prog;

  INSERT INTO public.progression_transactions (
    user_id,
    transaction_type,
    xp_amount,
    level_before,
    level_after,
    total_xp_after,
    source_type,
    source_id,
    idempotency_key,
    metadata
  )
  VALUES (
    p_target_user_id,
    CASE
      WHEN p_source_type IN ('admin_adjustment', 'reversal') THEN p_source_type
      ELSE 'xp_earned'
    END,
    xp_granted,
    level_before,
    level_after,
    total_after,
    p_source_type,
    p_source_id,
    p_idempotency_key,
    COALESCE(p_metadata, '{}'::jsonb) || jsonb_build_object(
      'levels_crossed', to_jsonb(levels_crossed)
    )
  )
  RETURNING id INTO tx_id;

  IF cardinality(levels_crossed) > 0 THEN
    FOREACH crossed IN ARRAY levels_crossed LOOP
      reward_row := public.grant_level_reward_secure(p_target_user_id, crossed);
      rewards := rewards || jsonb_build_array(reward_row);
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'xp_granted', xp_granted,
    'level_before', level_before,
    'level_after', level_after,
    'levels_gained', level_after - level_before,
    'current_level_xp', prog.current_level_xp,
    'xp_required_for_next_level', public.xp_required_for_level(prog.level),
    'total_xp_after', prog.total_xp,
    'levels_crossed', to_jsonb(levels_crossed),
    'rewards_granted', rewards,
    'already_processed', false,
    'transaction_id', tx_id
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- assign_daily_missions_secure — v1.3 fixed set for all players (UTC day)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.assign_daily_missions_secure(
  p_user_id uuid,
  p_allow_live_duel boolean DEFAULT true,
  p_allow_ranked boolean DEFAULT true,
  p_mission_date date DEFAULT NULL
)
RETURNS SETOF public.player_daily_missions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  mission_day date;
  tmpl public.mission_templates%ROWTYPE;
  fixed_ids text[] := ARRAY[
    'v1_3_exact_21_three',
    'v1_3_five_card_two',
    'v1_3_daily_blaze'
  ];
  picked_id text;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'user_id is required';
  END IF;

  mission_day := COALESCE(p_mission_date, (now() AT TIME ZONE 'utc')::date);

  PERFORM public.ensure_player_progression(p_user_id);

  FOREACH picked_id IN ARRAY fixed_ids LOOP
  SELECT * INTO tmpl
  FROM public.mission_templates
  WHERE id = picked_id
    AND is_enabled = true;

  IF NOT FOUND THEN
    CONTINUE;
  END IF;

  INSERT INTO public.player_daily_missions (
    user_id,
    mission_template_id,
    mission_date,
    progress,
    target_value,
    xp_reward,
    blaze_coin_reward
  )
  VALUES (
    p_user_id,
    tmpl.id,
    mission_day,
    0,
    tmpl.target_value,
    tmpl.xp_reward,
    tmpl.blaze_coin_reward
  )
  ON CONFLICT (user_id, mission_template_id, mission_date) DO NOTHING;
  END LOOP;

  RETURN QUERY
  SELECT *
  FROM public.player_daily_missions
  WHERE user_id = p_user_id
    AND mission_date = mission_day
  ORDER BY created_at ASC;
END;
$$;

COMMENT ON FUNCTION public.assign_daily_missions_secure(uuid, boolean, boolean, date) IS
  'v1.3: assigns the same three fixed daily missions for every player per UTC day.';

-- ---------------------------------------------------------------------------
-- apply_mission_progress_from_match — extended mission types + practice guard
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
  p_busts integer DEFAULT NULL,
  p_score integer DEFAULT NULL,
  p_cards_played integer DEFAULT NULL
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
  is_daily_ranked boolean;
  is_practice boolean;
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
  is_daily_ranked := mode_norm IN ('daily_challenge_ranked', 'daily_challenge');
  is_practice := mode_norm IN ('daily_challenge_practice', 'practice');
  is_live := is_casual OR is_ranked;

  IF is_practice THEN
    RETURN jsonb_build_object(
      'applied', false,
      'reason', 'practice_not_counted',
      'updates', '[]'::jsonb
    );
  END IF;

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
      WHEN 'daily_challenge' THEN
        IF is_daily_ranked THEN
          delta := 1;
        END IF;
      WHEN 'score_threshold' THEN
        IF COALESCE(p_score, 0) >= mission_rec.target_value THEN
          delta := mission_rec.target_value;
        END IF;
      WHEN 'cards_without_bust' THEN
        IF COALESCE(p_busts, 99) = 0
           AND COALESCE(p_cards_played, 0) >= 15 THEN
          delta := 1;
        END IF;
      ELSE
        delta := 0;
    END CASE;

    IF delta <= 0 THEN
      CONTINUE;
    END IF;

    IF tmpl.mission_type = 'score_threshold' THEN
      new_progress := mission_rec.target_value;
    ELSE
      new_progress := LEAST(mission_rec.progress + delta, mission_rec.target_value);
    END IF;

    IF new_progress = mission_rec.progress THEN
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
  uuid, uuid, text, integer, integer, integer, integer, boolean, boolean, boolean, boolean, integer, integer, integer
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_mission_progress_from_match(
  uuid, uuid, text, integer, integer, integer, integer, boolean, boolean, boolean, boolean, integer, integer, integer
) TO service_role;

-- ---------------------------------------------------------------------------
-- Streak milestone bonus XP (small, idempotent)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.grant_daily_streak_milestone_xp(
  p_user_id uuid,
  p_milestone integer,
  p_challenge_date date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  bonus integer := 0;
BEGIN
  IF p_milestone IN (7, 14, 30) THEN
    bonus := 25;
  ELSIF p_milestone IN (3, 5) THEN
    bonus := 15;
  ELSE
    RETURN jsonb_build_object('xp_granted', 0, 'skipped', true);
  END IF;

  RETURN public.grant_player_xp(
    p_user_id,
    bonus,
    'daily_streak_milestone',
    p_milestone::text || ':' || p_challenge_date::text,
    'streak_milestone_xp:' || p_user_id::text || ':' || p_milestone::text || ':' || p_challenge_date::text,
    jsonb_build_object('milestone', p_milestone, 'challenge_date', p_challenge_date)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.grant_daily_streak_milestone_xp(uuid, integer, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.grant_daily_streak_milestone_xp(uuid, integer, date) TO service_role;

-- Patch streak apply to grant milestone XP (preserve Phase 3 reward_grants shape)
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

      PERFORM public.grant_daily_streak_milestone_xp(p_user_id, milestone, p_challenge_date);
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'currentStreak', current_streak,
    'longestStreak', longest_streak,
    'alreadyApplied', false
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- complete_daily_challenge — grant XP + mission progress on ranked completion
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
  xp_result jsonb;
  mission_result jsonb;
  daily_xp integer := 75;
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

  IF attempt.attempt_type <> 'ranked' THEN
    RAISE EXCEPTION 'practice_attempt_not_ranked';
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

  xp_result := public.grant_player_xp(
    v_user_id,
    daily_xp,
    'daily_challenge_completion',
    attempt.id::text,
    'daily_challenge_xp:' || attempt.id::text,
    jsonb_build_object(
      'attempt_id', attempt.id,
      'score', attempt.verified_score,
      'challenge_date', challenge.challenge_date
    )
  );

  mission_result := public.apply_mission_progress_from_match(
    v_user_id,
    attempt.id,
    'daily_challenge_ranked',
    COALESCE(p_exact_21_count, 0),
    COALESCE(p_five_card_clear_count, 0),
    0,
    0,
    true,
    true,
    false,
    false,
    COALESCE(p_bust_count, 0),
    p_score,
    COALESCE(p_cards_played, 0)
  );

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
    'totalPlayers', rank_result->'totalPlayers',
    'xpResult', xp_result,
    'missionProgress', mission_result
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- Authenticated RPCs
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_player_progression()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  prog public.player_progression%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  PERFORM public.ensure_player_progression(v_user_id);

  SELECT * INTO prog
  FROM public.player_progression
  WHERE user_id = v_user_id;

  RETURN jsonb_build_object(
    'userId', prog.user_id,
    'level', prog.level,
    'totalXp', prog.total_xp,
    'currentLevelXp', prog.current_level_xp,
    'xpRequiredForNextLevel', public.xp_required_for_level(prog.level),
    'highestLevelReached', prog.highest_level_reached,
    'dailyStreak', prog.daily_streak,
    'longestDailyStreak', prog.longest_daily_streak,
    'lastDailyClaimAt', prog.last_daily_claim_at,
    'nextDailyClaimAt', prog.next_daily_claim_at
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_player_progression() TO authenticated;

CREATE OR REPLACE FUNCTION public.claim_daily_mission_reward(p_mission_progress_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  RETURN public.claim_daily_mission_secure(v_user_id, p_mission_progress_id, NULL);
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_daily_mission_reward(uuid) TO authenticated;

COMMENT ON FUNCTION public.claim_daily_mission_reward(uuid) IS
  'Authenticated wrapper for claim_daily_mission_secure. Client submits only mission progress id.';

INSERT INTO public.app_configuration (key, value)
VALUES
  ('v1_3_progression_enabled', 'true'::jsonb)
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value, updated_at = now();
