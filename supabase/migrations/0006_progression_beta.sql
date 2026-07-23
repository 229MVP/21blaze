-- 21 Blaze Retention & Progression Beta 0.5B
-- Safe to re-run where practical (IF NOT EXISTS, DROP POLICY IF EXISTS, OR REPLACE).
-- Tables, RLS, catalogs, and SECURITY DEFINER RPCs for XP/levels, daily rewards,
-- daily missions, and free level rewards.
-- Depends on 0005 helpers: ensure_player_wallet, apply_wallet_delta, unlock_cosmetic.

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- ---------------------------------------------------------------------------
-- cosmetic_catalog — authoritative cosmetic definitions (create first)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cosmetic_catalog (
  id text PRIMARY KEY,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  category text NOT NULL,
  rarity text NOT NULL DEFAULT 'common',
  is_enabled boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cosmetic_catalog_category_check CHECK (
    category IN (
      'card_theme',
      'arena',
      'profile_frame',
      'title',
      'emote',
      'victory_effect'
    )
  ),
  CONSTRAINT cosmetic_catalog_rarity_check CHECK (
    rarity IN ('common', 'uncommon', 'rare', 'epic', 'legendary')
  )
);

CREATE INDEX IF NOT EXISTS cosmetic_catalog_category_idx
  ON public.cosmetic_catalog (category);

CREATE INDEX IF NOT EXISTS cosmetic_catalog_enabled_idx
  ON public.cosmetic_catalog (is_enabled)
  WHERE is_enabled = true;

INSERT INTO public.cosmetic_catalog (id, name, description, category, rarity, metadata)
VALUES
  (
    'seven_day_blaze_title',
    'Seven-Day Blaze',
    'Earned by completing a full seven-day daily reward streak.',
    'title',
    'rare',
    '{"source":"daily_reward","day":7}'::jsonb
  ),
  (
    'rookie_blazer_title',
    'Rookie Blazer',
    'Level 3 free progression title.',
    'title',
    'common',
    '{"source":"level_reward","level":3}'::jsonb
  ),
  (
    'ember_card_back',
    'Ember Card Back',
    'Level 5 free card theme.',
    'card_theme',
    'uncommon',
    '{"source":"level_reward","level":5}'::jsonb
  ),
  (
    'spark_profile_frame',
    'Spark Profile Frame',
    'Level 10 free profile frame.',
    'profile_frame',
    'uncommon',
    '{"source":"level_reward","level":10}'::jsonb
  ),
  (
    'flame_card_face',
    'Flame Card Face',
    'Level 15 free card theme.',
    'card_theme',
    'rare',
    '{"source":"level_reward","level":15}'::jsonb
  ),
  (
    'inferno_player_title',
    'Inferno Player',
    'Level 25 free progression title.',
    'title',
    'rare',
    '{"source":"level_reward","level":25}'::jsonb
  ),
  (
    'veteran_blazer_card_back',
    'Veteran Blazer Card Back',
    'Level 30 free card theme.',
    'card_theme',
    'epic',
    '{"source":"level_reward","level":30}'::jsonb
  ),
  (
    'blaze_profile_frame',
    'Blaze Profile Frame',
    'Level 40 free profile frame.',
    'profile_frame',
    'epic',
    '{"source":"level_reward","level":40}'::jsonb
  ),
  (
    'blaze_master_title',
    'Blaze Master',
    'Level 50 free progression title.',
    'title',
    'legendary',
    '{"source":"level_reward","level":50}'::jsonb
  ),
  (
    'level_50_champion_card_back',
    'Level 50 Champion Card Back',
    'Second Level 50 free card theme.',
    'card_theme',
    'legendary',
    '{"source":"level_reward","level":50,"secondary":true}'::jsonb
  )
ON CONFLICT (id) DO UPDATE
SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  rarity = EXCLUDED.rarity,
  is_enabled = true,
  metadata = EXCLUDED.metadata;

-- ---------------------------------------------------------------------------
-- player_progression — XP, levels, daily streak state
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.player_progression (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  level integer NOT NULL DEFAULT 1,
  total_xp bigint NOT NULL DEFAULT 0,
  current_level_xp integer NOT NULL DEFAULT 0,
  highest_level_reached integer NOT NULL DEFAULT 1,
  daily_streak integer NOT NULL DEFAULT 0,
  longest_daily_streak integer NOT NULL DEFAULT 0,
  last_daily_claim_at timestamptz,
  next_daily_claim_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT player_progression_level_check CHECK (level BETWEEN 1 AND 50),
  CONSTRAINT player_progression_total_xp_check CHECK (total_xp >= 0),
  CONSTRAINT player_progression_current_level_xp_check CHECK (current_level_xp >= 0),
  CONSTRAINT player_progression_highest_level_check CHECK (
    highest_level_reached BETWEEN 1 AND 50
  ),
  CONSTRAINT player_progression_daily_streak_check CHECK (daily_streak >= 0),
  CONSTRAINT player_progression_longest_streak_check CHECK (
    longest_daily_streak >= daily_streak
  )
);

CREATE INDEX IF NOT EXISTS player_progression_level_idx
  ON public.player_progression (level DESC);

CREATE INDEX IF NOT EXISTS player_progression_last_daily_claim_idx
  ON public.player_progression (last_daily_claim_at DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS player_progression_updated_at_idx
  ON public.player_progression (updated_at DESC);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'set_updated_at'
  ) THEN
    DROP TRIGGER IF EXISTS player_progression_set_updated_at ON public.player_progression;
    CREATE TRIGGER player_progression_set_updated_at
      BEFORE UPDATE ON public.player_progression
      FOR EACH ROW
      EXECUTE FUNCTION public.set_updated_at();
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- progression_transactions — append-only XP / level ledger
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.progression_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  transaction_type text NOT NULL,
  xp_amount integer NOT NULL,
  level_before integer NOT NULL,
  level_after integer NOT NULL,
  total_xp_after bigint NOT NULL,
  source_type text NOT NULL,
  source_id text,
  idempotency_key text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT progression_transactions_type_check CHECK (
    transaction_type IN (
      'xp_earned',
      'level_reward',
      'admin_adjustment',
      'reversal'
    )
  ),
  CONSTRAINT progression_transactions_source_check CHECK (
    source_type IN (
      'solo_match',
      'casual_duel',
      'ranked_duel',
      'daily_mission',
      'daily_reward',
      'level_reward',
      'admin_adjustment',
      'reversal'
    )
  ),
  CONSTRAINT progression_transactions_levels_check CHECK (
    level_before BETWEEN 1 AND 50
    AND level_after BETWEEN 1 AND 50
  ),
  CONSTRAINT progression_transactions_total_xp_check CHECK (total_xp_after >= 0),
  CONSTRAINT progression_transactions_idempotency_unique UNIQUE (idempotency_key)
);

CREATE INDEX IF NOT EXISTS progression_transactions_user_created_idx
  ON public.progression_transactions (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS progression_transactions_source_idx
  ON public.progression_transactions (user_id, source_type, source_id, created_at DESC);

CREATE INDEX IF NOT EXISTS progression_transactions_type_idx
  ON public.progression_transactions (user_id, transaction_type, created_at DESC);

-- ---------------------------------------------------------------------------
-- daily_reward_claims — daily streak claim history
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.daily_reward_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  streak_day integer NOT NULL,
  blaze_coin_reward integer NOT NULL,
  xp_reward integer NOT NULL,
  cosmetic_id text REFERENCES public.cosmetic_catalog (id),
  claimed_at timestamptz NOT NULL DEFAULT now(),
  idempotency_key text NOT NULL,
  CONSTRAINT daily_reward_claims_streak_day_check CHECK (streak_day BETWEEN 1 AND 7),
  CONSTRAINT daily_reward_claims_coins_check CHECK (blaze_coin_reward >= 0),
  CONSTRAINT daily_reward_claims_xp_check CHECK (xp_reward >= 0),
  CONSTRAINT daily_reward_claims_idempotency_unique UNIQUE (idempotency_key)
);

CREATE INDEX IF NOT EXISTS daily_reward_claims_user_claimed_idx
  ON public.daily_reward_claims (user_id, claimed_at DESC);

CREATE INDEX IF NOT EXISTS daily_reward_claims_user_streak_day_idx
  ON public.daily_reward_claims (user_id, streak_day);

-- ---------------------------------------------------------------------------
-- mission_templates — seedable daily mission definitions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.mission_templates (
  id text PRIMARY KEY,
  name text NOT NULL,
  description text NOT NULL,
  mission_type text NOT NULL,
  target_value integer NOT NULL,
  xp_reward integer NOT NULL,
  blaze_coin_reward integer NOT NULL,
  category text NOT NULL,
  requires_live_duel boolean NOT NULL DEFAULT false,
  requires_ranked boolean NOT NULL DEFAULT false,
  is_enabled boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mission_templates_category_check CHECK (
    category IN ('participation', 'skill', 'mode')
  ),
  CONSTRAINT mission_templates_target_check CHECK (target_value > 0),
  CONSTRAINT mission_templates_xp_check CHECK (xp_reward >= 0),
  CONSTRAINT mission_templates_coins_check CHECK (blaze_coin_reward >= 0)
);

CREATE INDEX IF NOT EXISTS mission_templates_category_enabled_idx
  ON public.mission_templates (category, is_enabled, sort_order);

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
  -- Participation
  (
    'play_three_matches',
    'Play 3 Matches',
    'Play 3 verified matches',
    'play_match',
    3,
    75,
    30,
    'participation',
    false,
    false,
    true,
    10
  ),
  (
    'play_five_matches',
    'Play 5 Matches',
    'Play 5 verified matches',
    'play_match',
    5,
    100,
    40,
    'participation',
    false,
    false,
    true,
    20
  ),
  (
    'play_one_live_duel',
    'Play a Live Duel',
    'Complete 1 verified Live Duel',
    'live_duel',
    1,
    75,
    35,
    'participation',
    true,
    false,
    true,
    30
  ),
  -- Skill
  (
    'clear_ten_lanes',
    'Clear 10 Lanes',
    'Clear 10 total lanes',
    'lane_clears',
    10,
    75,
    30,
    'skill',
    false,
    false,
    true,
    10
  ),
  (
    'hit_five_exact_21',
    'Hit Exact 21 ×5',
    'Clear 5 lanes at exactly 21',
    'exact_21',
    5,
    100,
    40,
    'skill',
    false,
    false,
    true,
    20
  ),
  (
    'get_three_five_card_clears',
    'Five-Card Clears ×3',
    'Complete 3 five-card clears',
    'five_card_clear',
    3,
    100,
    40,
    'skill',
    false,
    false,
    true,
    30
  ),
  (
    'reach_x3_three_times',
    'Reach ×3 Three Times',
    'Reach a x3 multiplier in 3 matches',
    'reach_multiplier_x3',
    3,
    75,
    30,
    'skill',
    false,
    false,
    true,
    40
  ),
  (
    'reach_x5_once',
    'Reach ×5 Once',
    'Reach a x5 multiplier once',
    'reach_multiplier_x5',
    1,
    125,
    50,
    'skill',
    false,
    false,
    true,
    50
  ),
  -- Mode
  (
    'complete_two_solo_matches',
    'Complete 2 Solo Matches',
    'Complete 2 verified Solo matches',
    'solo_match',
    2,
    60,
    25,
    'mode',
    false,
    false,
    true,
    10
  ),
  (
    'complete_two_casual_duels',
    'Complete 2 Casual Duels',
    'Complete 2 Casual Live Duels',
    'casual_duel',
    2,
    100,
    40,
    'mode',
    true,
    false,
    true,
    20
  ),
  (
    'complete_one_ranked_match',
    'Complete 1 Ranked Match',
    'Complete 1 Ranked Duel',
    'ranked_match',
    1,
    100,
    40,
    'mode',
    true,
    true,
    true,
    30
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
-- player_daily_missions — per-user daily assignment + progress
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.player_daily_missions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  mission_template_id text NOT NULL REFERENCES public.mission_templates (id),
  mission_date date NOT NULL,
  progress integer NOT NULL DEFAULT 0,
  target_value integer NOT NULL,
  completed_at timestamptz,
  claimed_at timestamptz,
  xp_reward integer NOT NULL,
  blaze_coin_reward integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT player_daily_missions_progress_check CHECK (progress >= 0),
  CONSTRAINT player_daily_missions_target_check CHECK (target_value > 0),
  CONSTRAINT player_daily_missions_xp_check CHECK (xp_reward >= 0),
  CONSTRAINT player_daily_missions_coins_check CHECK (blaze_coin_reward >= 0),
  CONSTRAINT player_daily_missions_user_template_date_unique
    UNIQUE (user_id, mission_template_id, mission_date)
);

CREATE INDEX IF NOT EXISTS player_daily_missions_user_date_idx
  ON public.player_daily_missions (user_id, mission_date DESC);

CREATE INDEX IF NOT EXISTS player_daily_missions_user_claimable_idx
  ON public.player_daily_missions (user_id, mission_date)
  WHERE completed_at IS NOT NULL AND claimed_at IS NULL;

-- ---------------------------------------------------------------------------
-- mission_progress_events — idempotent per-match mission increments
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.mission_progress_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  player_mission_id uuid NOT NULL REFERENCES public.player_daily_missions (id) ON DELETE CASCADE,
  match_id uuid NOT NULL,
  progress_delta integer NOT NULL,
  progress_after integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mission_progress_events_delta_check CHECK (progress_delta >= 0),
  CONSTRAINT mission_progress_events_after_check CHECK (progress_after >= 0),
  CONSTRAINT mission_progress_events_mission_match_unique UNIQUE (player_mission_id, match_id)
);

CREATE INDEX IF NOT EXISTS mission_progress_events_user_created_idx
  ON public.mission_progress_events (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS mission_progress_events_match_idx
  ON public.mission_progress_events (match_id);

-- ---------------------------------------------------------------------------
-- level_reward_catalog — free level-up rewards (optional secondary cosmetic)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.level_reward_catalog (
  level integer PRIMARY KEY,
  blaze_coin_reward integer NOT NULL DEFAULT 0,
  cosmetic_id text REFERENCES public.cosmetic_catalog (id),
  cosmetic_id_secondary text REFERENCES public.cosmetic_catalog (id),
  title text,
  is_enabled boolean NOT NULL DEFAULT true,
  CONSTRAINT level_reward_catalog_level_check CHECK (level BETWEEN 2 AND 50),
  CONSTRAINT level_reward_catalog_coins_check CHECK (blaze_coin_reward >= 0)
);

INSERT INTO public.level_reward_catalog (
  level,
  blaze_coin_reward,
  cosmetic_id,
  cosmetic_id_secondary,
  title,
  is_enabled
)
VALUES
  (2, 50, NULL, NULL, NULL, true),
  (3, 0, 'rookie_blazer_title', NULL, 'Rookie Blazer', true),
  (5, 0, 'ember_card_back', NULL, NULL, true),
  (7, 100, NULL, NULL, NULL, true),
  (10, 0, 'spark_profile_frame', NULL, NULL, true),
  (15, 0, 'flame_card_face', NULL, NULL, true),
  (20, 250, NULL, NULL, NULL, true),
  (25, 0, 'inferno_player_title', NULL, 'Inferno Player', true),
  (30, 0, 'veteran_blazer_card_back', NULL, NULL, true),
  (35, 350, NULL, NULL, NULL, true),
  (40, 0, 'blaze_profile_frame', NULL, NULL, true),
  (45, 500, NULL, NULL, NULL, true),
  (
    50,
    0,
    'blaze_master_title',
    'level_50_champion_card_back',
    'Blaze Master',
    true
  )
ON CONFLICT (level) DO UPDATE
SET
  blaze_coin_reward = EXCLUDED.blaze_coin_reward,
  cosmetic_id = EXCLUDED.cosmetic_id,
  cosmetic_id_secondary = EXCLUDED.cosmetic_id_secondary,
  title = EXCLUDED.title,
  is_enabled = EXCLUDED.is_enabled;

-- ---------------------------------------------------------------------------
-- player_level_rewards — once-per-level grant ledger
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.player_level_rewards (
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  level integer NOT NULL REFERENCES public.level_reward_catalog (level),
  claimed_at timestamptz NOT NULL DEFAULT now(),
  transaction_id uuid,
  PRIMARY KEY (user_id, level)
);

CREATE INDEX IF NOT EXISTS player_level_rewards_user_claimed_idx
  ON public.player_level_rewards (user_id, claimed_at DESC);

-- Feature flags (upsert-safe).
INSERT INTO public.app_configuration (key, value)
VALUES
  ('progression_enabled', 'true'::jsonb),
  ('daily_rewards_enabled', 'true'::jsonb),
  ('daily_missions_enabled', 'true'::jsonb)
ON CONFLICT (key) DO UPDATE
SET
  value = EXCLUDED.value,
  updated_at = now();

-- ---------------------------------------------------------------------------
-- Pure helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.xp_required_for_level(p_level integer)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_level IS NULL OR p_level < 1 THEN 0
    WHEN p_level >= 50 THEN 0
    ELSE 100 + ((p_level - 1) * 25)
  END;
$$;

REVOKE ALL ON FUNCTION public.xp_required_for_level(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.xp_required_for_level(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.xp_required_for_level(integer) TO service_role;

COMMENT ON FUNCTION public.xp_required_for_level(integer) IS
  'XP needed to advance from p_level to p_level+1. Formula: 100+((level-1)*25). 0 at/above max level 50.';

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
      (1, 25, 25, NULL::text),
      (2, 30, 30, NULL::text),
      (3, 40, 40, NULL::text),
      (4, 50, 50, NULL::text),
      (5, 60, 60, NULL::text),
      (6, 75, 75, NULL::text),
      (7, 100, 100, 'seven_day_blaze_title'::text)
  ) AS d(day, blaze_coins, xp, cosmetic_id)
  WHERE d.day = ((((GREATEST(COALESCE(p_streak_day, 1), 1) - 1) % 7) + 1));
$$;

REVOKE ALL ON FUNCTION public.daily_reward_for_streak_day(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.daily_reward_for_streak_day(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.daily_reward_for_streak_day(integer) TO service_role;

-- ---------------------------------------------------------------------------
-- ensure_player_progression — create row if missing, lock FOR UPDATE
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ensure_player_progression(p_user_id uuid)
RETURNS public.player_progression
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  prog public.player_progression;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'user_id is required';
  END IF;

  INSERT INTO public.player_progression (user_id)
  VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT * INTO prog
  FROM public.player_progression
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'failed to ensure progression for user %', p_user_id;
  END IF;

  RETURN prog;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_player_progression(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_player_progression(uuid) TO service_role;

COMMENT ON FUNCTION public.ensure_player_progression(uuid) IS
  'Inserts a player_progression row if missing and returns it locked FOR UPDATE.';

-- ---------------------------------------------------------------------------
-- Internal: grant_level_reward_secure — once-per-level coins + cosmetics
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.grant_level_reward_secure(
  p_user_id uuid,
  p_level integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  catalog public.level_reward_catalog%ROWTYPE;
  already public.player_level_rewards%ROWTYPE;
  cosmetic_row public.cosmetic_catalog%ROWTYPE;
  tx_id uuid;
  unlocked text[] := ARRAY[]::text[];
BEGIN
  IF p_user_id IS NULL OR p_level IS NULL THEN
    RAISE EXCEPTION 'user_id and level are required';
  END IF;

  SELECT * INTO catalog
  FROM public.level_reward_catalog
  WHERE level = p_level
    AND is_enabled = true;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'level', p_level,
      'granted', false,
      'reason', 'no_reward'
    );
  END IF;

  SELECT * INTO already
  FROM public.player_level_rewards
  WHERE user_id = p_user_id
    AND level = p_level;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'level', p_level,
      'granted', false,
      'already_claimed', true,
      'blaze_coins', catalog.blaze_coin_reward,
      'cosmetic_id', catalog.cosmetic_id,
      'cosmetic_id_secondary', catalog.cosmetic_id_secondary,
      'title', catalog.title
    );
  END IF;

  IF catalog.blaze_coin_reward > 0 THEN
    PERFORM public.apply_wallet_delta(
      p_user_id,
      catalog.blaze_coin_reward::bigint,
      'earn',
      'level_reward:' || p_level::text,
      'level_reward_coins:' || p_user_id::text || ':' || p_level::text,
      jsonb_build_object('level', p_level, 'blaze_coins', catalog.blaze_coin_reward)
    );
  END IF;

  IF catalog.cosmetic_id IS NOT NULL THEN
    SELECT * INTO cosmetic_row
    FROM public.cosmetic_catalog
    WHERE id = catalog.cosmetic_id;

    IF FOUND THEN
      PERFORM public.unlock_cosmetic(
        p_user_id,
        cosmetic_row.id,
        cosmetic_row.category,
        'level_reward'
      );
      unlocked := array_append(unlocked, cosmetic_row.id);
    END IF;
  END IF;

  IF catalog.cosmetic_id_secondary IS NOT NULL THEN
    SELECT * INTO cosmetic_row
    FROM public.cosmetic_catalog
    WHERE id = catalog.cosmetic_id_secondary;

    IF FOUND THEN
      PERFORM public.unlock_cosmetic(
        p_user_id,
        cosmetic_row.id,
        cosmetic_row.category,
        'level_reward'
      );
      unlocked := array_append(unlocked, cosmetic_row.id);
    END IF;
  END IF;

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
  SELECT
    p_user_id,
    'level_reward',
    0,
    pp.level,
    pp.level,
    pp.total_xp,
    'level_reward',
    p_level::text,
    'level_reward_grant:' || p_user_id::text || ':' || p_level::text,
    jsonb_build_object(
      'level', p_level,
      'blaze_coins', catalog.blaze_coin_reward,
      'cosmetic_id', catalog.cosmetic_id,
      'cosmetic_id_secondary', catalog.cosmetic_id_secondary,
      'title', catalog.title,
      'cosmetics_unlocked', to_jsonb(unlocked)
    )
  FROM public.player_progression pp
  WHERE pp.user_id = p_user_id
  RETURNING id INTO tx_id;

  INSERT INTO public.player_level_rewards (user_id, level, claimed_at, transaction_id)
  VALUES (p_user_id, p_level, now(), tx_id)
  ON CONFLICT (user_id, level) DO NOTHING;

  RETURN jsonb_build_object(
    'level', p_level,
    'granted', true,
    'already_claimed', false,
    'blaze_coins', catalog.blaze_coin_reward,
    'cosmetic_id', catalog.cosmetic_id,
    'cosmetic_id_secondary', catalog.cosmetic_id_secondary,
    'title', catalog.title,
    'cosmetics_unlocked', to_jsonb(unlocked),
    'transaction_id', tx_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.grant_level_reward_secure(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.grant_level_reward_secure(uuid, integer) TO service_role;

-- ---------------------------------------------------------------------------
-- grant_player_xp — authoritative XP grant with level-up + rewards
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

REVOKE ALL ON FUNCTION public.grant_player_xp(uuid, integer, text, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.grant_player_xp(uuid, integer, text, text, text, jsonb) TO service_role;

COMMENT ON FUNCTION public.grant_player_xp(uuid, integer, text, text, text, jsonb) IS
  'Idempotent XP grant. Caps level at 50, preserves excess XP, grants crossed level rewards.';

-- ---------------------------------------------------------------------------
-- claim_daily_reward_secure — 20h gate, 48h streak window, 7-day cycle
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.claim_daily_reward_secure(
  p_user_id uuid,
  p_idempotency_key text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  prog public.player_progression;
  now_ts timestamptz := now();
  min_interval interval := interval '20 hours';
  streak_window interval := interval '48 hours';
  new_streak integer;
  streak_day integer;
  continues boolean := false;
  resets boolean := false;
  reward record;
  idem_key text;
  claim_row public.daily_reward_claims%ROWTYPE;
  existing public.daily_reward_claims%ROWTYPE;
  xp_result jsonb;
  cosmetic_row public.cosmetic_catalog%ROWTYPE;
  unlocked_cosmetic text := NULL;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'user_id is required';
  END IF;

  PERFORM public.ensure_player_wallet(p_user_id);
  prog := public.ensure_player_progression(p_user_id);

  IF p_idempotency_key IS NOT NULL AND length(trim(p_idempotency_key)) > 0 THEN
    SELECT * INTO existing
    FROM public.daily_reward_claims
    WHERE idempotency_key = p_idempotency_key;

    IF FOUND THEN
      SELECT * INTO prog FROM public.player_progression WHERE user_id = p_user_id;
      RETURN jsonb_build_object(
        'already_processed', true,
        'claim', to_jsonb(existing),
        'progression', to_jsonb(prog)
      );
    END IF;
  END IF;

  IF prog.last_daily_claim_at IS NOT NULL
     AND now_ts < prog.last_daily_claim_at + min_interval
  THEN
    RAISE EXCEPTION 'daily reward not available yet (too soon)'
      USING ERRCODE = 'P0001';
  END IF;

  IF prog.last_daily_claim_at IS NULL THEN
    new_streak := 1;
  ELSIF now_ts <= prog.last_daily_claim_at + streak_window THEN
    continues := true;
    new_streak := prog.daily_streak + 1;
  ELSE
    resets := true;
    new_streak := 1;
  END IF;

  streak_day := ((new_streak - 1) % 7) + 1;

  SELECT * INTO reward
  FROM public.daily_reward_for_streak_day(streak_day);

  idem_key := COALESCE(
    NULLIF(trim(p_idempotency_key), ''),
    'daily_reward:'
      || p_user_id::text
      || ':streak:'
      || new_streak::text
      || ':after:'
      || COALESCE(prog.last_daily_claim_at::text, 'none')
  );

  SELECT * INTO existing
  FROM public.daily_reward_claims
  WHERE idempotency_key = idem_key;

  IF FOUND THEN
    SELECT * INTO prog FROM public.player_progression WHERE user_id = p_user_id;
    RETURN jsonb_build_object(
      'already_processed', true,
      'claim', to_jsonb(existing),
      'progression', to_jsonb(prog)
    );
  END IF;

  UPDATE public.player_progression
  SET
    daily_streak = new_streak,
    longest_daily_streak = GREATEST(longest_daily_streak, new_streak),
    last_daily_claim_at = now_ts,
    next_daily_claim_at = now_ts + min_interval,
    updated_at = now_ts
  WHERE user_id = p_user_id
  RETURNING * INTO prog;

  INSERT INTO public.daily_reward_claims (
    user_id,
    streak_day,
    blaze_coin_reward,
    xp_reward,
    cosmetic_id,
    claimed_at,
    idempotency_key
  )
  VALUES (
    p_user_id,
    streak_day,
    reward.blaze_coins,
    reward.xp,
    reward.cosmetic_id,
    now_ts,
    idem_key
  )
  RETURNING * INTO claim_row;

  IF reward.blaze_coins > 0 THEN
    PERFORM public.apply_wallet_delta(
      p_user_id,
      reward.blaze_coins::bigint,
      'earn',
      'daily_reward:day:' || streak_day::text,
      'daily_reward_coins:' || idem_key,
      jsonb_build_object(
        'streak_day', streak_day,
        'daily_streak', new_streak,
        'blaze_coins', reward.blaze_coins
      )
    );
  END IF;

  IF reward.cosmetic_id IS NOT NULL THEN
    SELECT * INTO cosmetic_row
    FROM public.cosmetic_catalog
    WHERE id = reward.cosmetic_id;

    IF FOUND THEN
      PERFORM public.unlock_cosmetic(
        p_user_id,
        cosmetic_row.id,
        cosmetic_row.category,
        'daily_reward'
      );
      unlocked_cosmetic := cosmetic_row.id;
    END IF;
  END IF;

  IF reward.xp > 0 THEN
    xp_result := public.grant_player_xp(
      p_user_id,
      reward.xp,
      'daily_reward',
      claim_row.id::text,
      'daily_reward_xp:' || idem_key,
      jsonb_build_object(
        'streak_day', streak_day,
        'daily_streak', new_streak,
        'claim_id', claim_row.id
      )
    );
  ELSE
    xp_result := jsonb_build_object('xp_granted', 0, 'already_processed', false);
  END IF;

  SELECT * INTO prog FROM public.player_progression WHERE user_id = p_user_id;

  RETURN jsonb_build_object(
    'already_processed', false,
    'continues_streak', continues,
    'resets_streak', resets,
    'new_streak', new_streak,
    'streak_day', streak_day,
    'reward', jsonb_build_object(
      'day', streak_day,
      'blaze_coins', reward.blaze_coins,
      'xp', reward.xp,
      'cosmetic_id', reward.cosmetic_id
    ),
    'unlocked_cosmetic', unlocked_cosmetic,
    'claim', to_jsonb(claim_row),
    'xp_result', xp_result,
    'progression', to_jsonb(prog),
    'next_claim_at', prog.next_daily_claim_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.claim_daily_reward_secure(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_daily_reward_secure(uuid, text) TO service_role;

COMMENT ON FUNCTION public.claim_daily_reward_secure(uuid, text) IS
  'Claims the daily reward using server time. 20h min interval, 48h streak window, 7-day cycle.';

-- ---------------------------------------------------------------------------
-- assign_daily_missions_secure — 1 participation + 1 skill + 1 mode
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
  cat text;
  picked_id text;
  tmpl public.mission_templates%ROWTYPE;
  existing_count integer;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'user_id is required';
  END IF;

  mission_day := COALESCE(p_mission_date, (now() AT TIME ZONE 'utc')::date);

  PERFORM public.ensure_player_progression(p_user_id);

  SELECT count(*) INTO existing_count
  FROM public.player_daily_missions
  WHERE user_id = p_user_id
    AND mission_date = mission_day;

  IF existing_count >= 3 THEN
    RETURN QUERY
    SELECT *
    FROM public.player_daily_missions
    WHERE user_id = p_user_id
      AND mission_date = mission_day
    ORDER BY created_at ASC;
    RETURN;
  END IF;

  FOREACH cat IN ARRAY ARRAY['participation', 'skill', 'mode'] LOOP
    IF EXISTS (
      SELECT 1
      FROM public.player_daily_missions pdm
      JOIN public.mission_templates mt ON mt.id = pdm.mission_template_id
      WHERE pdm.user_id = p_user_id
        AND pdm.mission_date = mission_day
        AND mt.category = cat
    ) THEN
      CONTINUE;
    END IF;

    SELECT x.id INTO picked_id
    FROM (
      SELECT
        mt.id,
        row_number() OVER (ORDER BY mt.sort_order ASC, mt.id ASC) AS rn,
        count(*) OVER () AS cnt
      FROM public.mission_templates mt
      WHERE mt.category = cat
        AND mt.is_enabled = true
        AND (NOT mt.requires_live_duel OR COALESCE(p_allow_live_duel, false))
        AND (NOT mt.requires_ranked OR COALESCE(p_allow_ranked, false))
    ) x
    WHERE x.cnt > 0
      AND x.rn = (
        (mod(hashtext(p_user_id::text || ':' || mission_day::text || ':' || cat), x.cnt) + x.cnt)
          % x.cnt
      ) + 1;

    IF picked_id IS NULL THEN
      -- Fallback: any enabled template in category that does not require unavailable modes.
      SELECT mt.id INTO picked_id
      FROM public.mission_templates mt
      WHERE mt.category = cat
        AND mt.is_enabled = true
        AND (NOT mt.requires_live_duel OR COALESCE(p_allow_live_duel, false))
        AND (NOT mt.requires_ranked OR COALESCE(p_allow_ranked, false))
      ORDER BY mt.sort_order ASC, mt.id ASC
      LIMIT 1;
    END IF;

    IF picked_id IS NULL THEN
      CONTINUE;
    END IF;

    SELECT * INTO tmpl
    FROM public.mission_templates
    WHERE id = picked_id;

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

REVOKE ALL ON FUNCTION public.assign_daily_missions_secure(uuid, boolean, boolean, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assign_daily_missions_secure(uuid, boolean, boolean, date) TO service_role;

COMMENT ON FUNCTION public.assign_daily_missions_secure(uuid, boolean, boolean, date) IS
  'Assigns one participation, one skill, and one mode mission for the UTC mission day. Deterministic per user/day.';

-- ---------------------------------------------------------------------------
-- apply_mission_progress_from_match — verified match summary → mission progress
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
  p_allow_ranked boolean DEFAULT true
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
  uuid, uuid, text, integer, integer, integer, integer, boolean, boolean, boolean, boolean
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_mission_progress_from_match(
  uuid, uuid, text, integer, integer, integer, integer, boolean, boolean, boolean, boolean
) TO service_role;

COMMENT ON FUNCTION public.apply_mission_progress_from_match(
  uuid, uuid, text, integer, integer, integer, integer, boolean, boolean, boolean, boolean
) IS
  'Applies verified match summary progress to the player''s UTC daily missions. Idempotent per mission/match.';

-- ---------------------------------------------------------------------------
-- claim_daily_mission_secure — claim completed mission rewards once
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.claim_daily_mission_secure(
  p_user_id uuid,
  p_player_mission_id uuid,
  p_idempotency_key text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  mission_rec public.player_daily_missions%ROWTYPE;
  idem_key text;
  xp_result jsonb;
  wallet public.player_wallets%ROWTYPE;
  prog public.player_progression%ROWTYPE;
BEGIN
  IF p_user_id IS NULL OR p_player_mission_id IS NULL THEN
    RAISE EXCEPTION 'user_id and player_mission_id are required';
  END IF;

  PERFORM public.ensure_player_wallet(p_user_id);
  PERFORM public.ensure_player_progression(p_user_id);

  SELECT * INTO mission_rec
  FROM public.player_daily_missions
  WHERE id = p_player_mission_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'mission % not found', p_player_mission_id;
  END IF;

  IF mission_rec.user_id IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'mission % does not belong to user %', p_player_mission_id, p_user_id;
  END IF;

  idem_key := COALESCE(
    NULLIF(trim(p_idempotency_key), ''),
    'daily_mission_claim:' || p_player_mission_id::text
  );

  IF mission_rec.claimed_at IS NOT NULL THEN
    SELECT * INTO prog FROM public.player_progression WHERE user_id = p_user_id;
    SELECT * INTO wallet FROM public.player_wallets WHERE user_id = p_user_id;
    RETURN jsonb_build_object(
      'already_processed', true,
      'mission', to_jsonb(mission_rec),
      'progression', to_jsonb(prog),
      'wallet', to_jsonb(wallet)
    );
  END IF;

  IF mission_rec.completed_at IS NULL
     OR mission_rec.progress < mission_rec.target_value
  THEN
    RAISE EXCEPTION 'mission % is not complete', p_player_mission_id
      USING ERRCODE = 'P0001';
  END IF;

  IF mission_rec.xp_reward > 0 THEN
    xp_result := public.grant_player_xp(
      p_user_id,
      mission_rec.xp_reward,
      'daily_mission',
      mission_rec.id::text,
      'daily_mission_xp:' || idem_key,
      jsonb_build_object(
        'player_mission_id', mission_rec.id,
        'mission_template_id', mission_rec.mission_template_id
      )
    );
  ELSE
    xp_result := jsonb_build_object('xp_granted', 0, 'already_processed', false);
  END IF;

  IF mission_rec.blaze_coin_reward > 0 THEN
    wallet := public.apply_wallet_delta(
      p_user_id,
      mission_rec.blaze_coin_reward::bigint,
      'earn',
      'daily_mission:' || mission_rec.mission_template_id,
      'daily_mission_coins:' || idem_key,
      jsonb_build_object(
        'player_mission_id', mission_rec.id,
        'mission_template_id', mission_rec.mission_template_id,
        'blaze_coins', mission_rec.blaze_coin_reward
      )
    );
  ELSE
    SELECT * INTO wallet FROM public.player_wallets WHERE user_id = p_user_id;
  END IF;

  UPDATE public.player_daily_missions
  SET claimed_at = now()
  WHERE id = mission_rec.id
  RETURNING * INTO mission_rec;

  SELECT * INTO prog FROM public.player_progression WHERE user_id = p_user_id;

  RETURN jsonb_build_object(
    'already_processed', false,
    'mission', to_jsonb(mission_rec),
    'xp_result', xp_result,
    'wallet', to_jsonb(wallet),
    'progression', to_jsonb(prog)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.claim_daily_mission_secure(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_daily_mission_secure(uuid, uuid, text) TO service_role;

COMMENT ON FUNCTION public.claim_daily_mission_secure(uuid, uuid, text) IS
  'Claims XP and Blaze Coins for a completed daily mission. Idempotent.';

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.cosmetic_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_progression ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.progression_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_reward_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mission_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_daily_missions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mission_progress_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.level_reward_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_level_rewards ENABLE ROW LEVEL SECURITY;

-- Catalogs: authenticated may read
DROP POLICY IF EXISTS "cosmetic_catalog_select_authenticated" ON public.cosmetic_catalog;
CREATE POLICY "cosmetic_catalog_select_authenticated"
  ON public.cosmetic_catalog
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "mission_templates_select_authenticated" ON public.mission_templates;
CREATE POLICY "mission_templates_select_authenticated"
  ON public.mission_templates
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "level_reward_catalog_select_authenticated" ON public.level_reward_catalog;
CREATE POLICY "level_reward_catalog_select_authenticated"
  ON public.level_reward_catalog
  FOR SELECT
  TO authenticated
  USING (true);

-- Mutable progression tables: select own only; no client writes
DROP POLICY IF EXISTS "player_progression_select_own" ON public.player_progression;
CREATE POLICY "player_progression_select_own"
  ON public.player_progression
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "progression_transactions_select_own" ON public.progression_transactions;
CREATE POLICY "progression_transactions_select_own"
  ON public.progression_transactions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "daily_reward_claims_select_own" ON public.daily_reward_claims;
CREATE POLICY "daily_reward_claims_select_own"
  ON public.daily_reward_claims
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "player_daily_missions_select_own" ON public.player_daily_missions;
CREATE POLICY "player_daily_missions_select_own"
  ON public.player_daily_missions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "mission_progress_events_select_own" ON public.mission_progress_events;
CREATE POLICY "mission_progress_events_select_own"
  ON public.mission_progress_events
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "player_level_rewards_select_own" ON public.player_level_rewards;
CREATE POLICY "player_level_rewards_select_own"
  ON public.player_level_rewards
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Table grants
GRANT SELECT ON public.cosmetic_catalog TO authenticated;
GRANT SELECT ON public.mission_templates TO authenticated;
GRANT SELECT ON public.level_reward_catalog TO authenticated;
GRANT SELECT ON public.player_progression TO authenticated;
GRANT SELECT ON public.progression_transactions TO authenticated;
GRANT SELECT ON public.daily_reward_claims TO authenticated;
GRANT SELECT ON public.player_daily_missions TO authenticated;
GRANT SELECT ON public.mission_progress_events TO authenticated;
GRANT SELECT ON public.player_level_rewards TO authenticated;

REVOKE INSERT, UPDATE, DELETE ON public.cosmetic_catalog FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.mission_templates FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.level_reward_catalog FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.player_progression FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.progression_transactions FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.daily_reward_claims FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.player_daily_missions FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.mission_progress_events FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.player_level_rewards FROM authenticated, anon;

REVOKE ALL ON public.cosmetic_catalog FROM anon;
REVOKE ALL ON public.mission_templates FROM anon;
REVOKE ALL ON public.level_reward_catalog FROM anon;
REVOKE ALL ON public.player_progression FROM anon;
REVOKE ALL ON public.progression_transactions FROM anon;
REVOKE ALL ON public.daily_reward_claims FROM anon;
REVOKE ALL ON public.player_daily_missions FROM anon;
REVOKE ALL ON public.mission_progress_events FROM anon;
REVOKE ALL ON public.player_level_rewards FROM anon;

COMMENT ON TABLE public.cosmetic_catalog IS
  'Authoritative cosmetic definitions for progression and other unlocks.';
COMMENT ON TABLE public.player_progression IS
  'Player XP, level, and daily streak state. Mutations via SECURITY DEFINER RPCs only.';
COMMENT ON TABLE public.progression_transactions IS
  'Append-only progression ledger with global idempotency keys.';
COMMENT ON TABLE public.daily_reward_claims IS
  'Daily reward claim history (7-day cycle).';
COMMENT ON TABLE public.mission_templates IS
  'Seeded daily mission templates (participation / skill / mode).';
COMMENT ON TABLE public.player_daily_missions IS
  'Per-user daily mission assignments and claim state.';
COMMENT ON TABLE public.mission_progress_events IS
  'Idempotent per-match mission progress events.';
COMMENT ON TABLE public.level_reward_catalog IS
  'Free level-up reward catalog. Level 50 uses cosmetic_id_secondary.';
COMMENT ON TABLE public.player_level_rewards IS
  'Once-per-level reward grant ledger.';
