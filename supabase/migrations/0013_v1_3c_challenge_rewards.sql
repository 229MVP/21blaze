-- Version 1.3C — Daily Challenge rewards (participation, placement, weekly, streak)
-- Server-authoritative, idempotent grants. Depends on 0005–0012.

ALTER TABLE public.daily_challenges
  ADD COLUMN IF NOT EXISTS placement_rewards_granted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reward_rules_version integer NOT NULL DEFAULT 1;

-- Extend unlock_method for challenge-earned cosmetics
ALTER TABLE public.cosmetic_catalog DROP CONSTRAINT IF EXISTS cosmetic_catalog_unlock_method_check;
ALTER TABLE public.cosmetic_catalog
  ADD CONSTRAINT cosmetic_catalog_unlock_method_check CHECK (
    unlock_method IS NULL OR unlock_method IN ('free', 'blaze_coins', 'streak', 'level', 'challenge')
  );

-- Extend grant_player_xp source types (full body preserved from 0006)
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
    'daily_challenge',
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

CREATE TABLE IF NOT EXISTS public.challenge_reward_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  reward_type text NOT NULL,
  period_key text NOT NULL,
  tier text,
  blaze_coins integer NOT NULL DEFAULT 0,
  xp integer NOT NULL DEFAULT 0,
  cosmetic_id text,
  idempotency_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT challenge_reward_claims_type_check CHECK (
    reward_type IN ('participation', 'daily_placement', 'weekly_tier', 'streak_milestone')
  ),
  CONSTRAINT challenge_reward_claims_idempotency_unique UNIQUE (idempotency_key)
);

CREATE INDEX IF NOT EXISTS challenge_reward_claims_user_idx
  ON public.challenge_reward_claims (user_id, created_at DESC);

ALTER TABLE public.challenge_reward_claims ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS challenge_reward_claims_select_own ON public.challenge_reward_claims;
CREATE POLICY challenge_reward_claims_select_own ON public.challenge_reward_claims
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.weekly_challenge_finalization (
  week_start date PRIMARY KEY,
  finalized_at timestamptz,
  reward_rules_version integer NOT NULL DEFAULT 1
);

-- Challenge-earnable cosmetics (not purchasable)
INSERT INTO public.cosmetic_catalog (
  id, name, description, category, cosmetic_type, unlock_method, rarity, sort_order, metadata
)
VALUES
  ('elite_blazer_title', 'ELITE BLAZER', 'Weekly Challenge Elite Blazer tier.', 'title', 'player_title', 'challenge', 'epic', 200, '{"source":"challenge","tier":"elite_blazer"}'::jsonb),
  ('inferno_blazer_title', 'INFERNO BLAZER', 'Weekly Challenge Inferno Blazer tier.', 'title', 'player_title', 'challenge', 'legendary', 210, '{"source":"challenge","tier":"inferno_blazer"}'::jsonb),
  ('weekly_warrior_title', 'WEEKLY WARRIOR', 'Seven-day Challenge Streak.', 'title', 'player_title', 'challenge', 'rare', 180, '{"source":"challenge","streak":7}'::jsonb),
  ('daily_legend_title', 'DAILY LEGEND', 'Thirty-day Challenge Streak.', 'title', 'player_title', 'challenge', 'legendary', 190, '{"source":"challenge","streak":30}'::jsonb),
  ('inferno_challenge_badge', 'Inferno Challenge', 'Inferno Blazer weekly tier badge.', 'profile_frame', 'profile_frame', 'challenge', 'legendary', 220, '{"source":"challenge","tier":"inferno_blazer"}'::jsonb),
  ('challenge_flame_badge', 'Challenge Flame', 'Fourteen-day Challenge Streak badge.', 'profile_frame', 'profile_frame', 'challenge', 'epic', 170, '{"source":"challenge","streak":14}'::jsonb),
  ('daily_legend_badge', 'Daily Legend', 'Thirty-day Challenge Streak badge.', 'profile_frame', 'profile_frame', 'challenge', 'legendary', 195, '{"source":"challenge","streak":30}'::jsonb)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  cosmetic_type = EXCLUDED.cosmetic_type,
  unlock_method = EXCLUDED.unlock_method,
  rarity = EXCLUDED.rarity,
  sort_order = EXCLUDED.sort_order,
  metadata = EXCLUDED.metadata;

CREATE OR REPLACE FUNCTION public.daily_challenge_placement_coins(p_rank integer)
RETURNS integer
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_rank IS NULL OR p_rank < 1 THEN 0
    WHEN p_rank = 1 THEN 200
    WHEN p_rank <= 3 THEN 125
    WHEN p_rank <= 10 THEN 75
    WHEN p_rank <= 25 THEN 50
    WHEN p_rank <= 100 THEN 25
    ELSE 0
  END;
$$;

CREATE OR REPLACE FUNCTION public.daily_challenge_placement_tier(p_rank integer)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_rank IS NULL OR p_rank < 1 THEN NULL
    WHEN p_rank = 1 THEN 'first'
    WHEN p_rank <= 3 THEN 'top3'
    WHEN p_rank <= 10 THEN 'top10'
    WHEN p_rank <= 25 THEN 'top25'
    WHEN p_rank <= 100 THEN 'top100'
    ELSE NULL
  END;
$$;

CREATE OR REPLACE FUNCTION public.grant_daily_challenge_participation_reward(
  p_user_id uuid,
  p_challenge_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key text := 'daily_challenge_participation:' || p_challenge_id::text || ':' || p_user_id::text;
  v_existing public.challenge_reward_claims%ROWTYPE;
  v_wallet jsonb;
  v_xp jsonb;
BEGIN
  IF p_user_id IS NULL OR p_challenge_id IS NULL THEN
    RAISE EXCEPTION 'user_id and challenge_id are required';
  END IF;

  SELECT * INTO v_existing FROM public.challenge_reward_claims WHERE idempotency_key = v_key;
  IF FOUND THEN
    RETURN jsonb_build_object('granted', false, 'already_claimed', true, 'blaze_coins', v_existing.blaze_coins, 'xp', v_existing.xp);
  END IF;

  v_wallet := public.apply_wallet_delta(
    p_user_id, 20, 'earn', 'daily_challenge_participation', v_key,
    jsonb_build_object('challenge_id', p_challenge_id)
  );

  v_xp := public.grant_player_xp(
    p_user_id, 75, 'daily_challenge', p_challenge_id::text,
    'daily_challenge_participation_xp:' || p_challenge_id::text || ':' || p_user_id::text,
    jsonb_build_object('challenge_id', p_challenge_id)
  );

  INSERT INTO public.challenge_reward_claims (
    user_id, reward_type, period_key, tier, blaze_coins, xp, idempotency_key
  )
  VALUES (p_user_id, 'participation', p_challenge_id::text, NULL, 20, 75, v_key);

  RETURN jsonb_build_object(
    'granted', true,
    'already_claimed', false,
    'blaze_coins', 20,
    'xp', COALESCE((v_xp->>'xp_granted')::integer, 75),
    'balance', v_wallet->'balance'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.grant_daily_challenge_placement_reward(
  p_user_id uuid,
  p_challenge_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_challenge public.daily_challenges%ROWTYPE;
  v_rank integer;
  v_tier text;
  v_coins integer;
  v_key text;
  v_existing public.challenge_reward_claims%ROWTYPE;
  v_wallet jsonb;
BEGIN
  SELECT * INTO v_challenge FROM public.daily_challenges WHERE id = p_challenge_id;
  IF NOT FOUND OR v_challenge.finalized_at IS NULL THEN
    RETURN jsonb_build_object('granted', false, 'reason', 'challenge_not_finalized');
  END IF;

  SELECT a.daily_rank INTO v_rank
  FROM public.daily_challenge_attempts a
  WHERE a.challenge_id = p_challenge_id
    AND a.user_id = p_user_id
    AND a.attempt_type = 'ranked'
    AND a.status = 'completed'
    AND a.verification_status = 'verified';

  IF v_rank IS NULL THEN
    RETURN jsonb_build_object('granted', false, 'reason', 'no_verified_rank');
  END IF;

  v_tier := public.daily_challenge_placement_tier(v_rank);
  v_coins := public.daily_challenge_placement_coins(v_rank);
  IF v_coins <= 0 OR v_tier IS NULL THEN
    RETURN jsonb_build_object('granted', false, 'reason', 'no_placement_tier', 'rank', v_rank);
  END IF;

  v_key := 'daily_challenge_placement:' || p_challenge_id::text || ':' || p_user_id::text || ':' || v_tier;

  SELECT * INTO v_existing FROM public.challenge_reward_claims WHERE idempotency_key = v_key;
  IF FOUND THEN
    RETURN jsonb_build_object('granted', false, 'already_claimed', true, 'blaze_coins', v_existing.blaze_coins, 'tier', v_tier, 'rank', v_rank);
  END IF;

  v_wallet := public.apply_wallet_delta(
    p_user_id, v_coins, 'earn', 'daily_challenge_placement', v_key,
    jsonb_build_object('challenge_id', p_challenge_id, 'rank', v_rank, 'tier', v_tier)
  );

  INSERT INTO public.challenge_reward_claims (
    user_id, reward_type, period_key, tier, blaze_coins, xp, idempotency_key
  )
  VALUES (p_user_id, 'daily_placement', p_challenge_id::text, v_tier, v_coins, 0, v_key);

  RETURN jsonb_build_object(
    'granted', true,
    'already_claimed', false,
    'blaze_coins', v_coins,
    'tier', v_tier,
    'rank', v_rank,
    'balance', v_wallet->'balance'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.process_daily_challenge_placement_rewards(
  p_challenge_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT a.user_id
    FROM public.daily_challenge_attempts a
    WHERE a.challenge_id = p_challenge_id
      AND a.attempt_type = 'ranked'
      AND a.status = 'completed'
      AND a.verification_status = 'verified'
      AND a.daily_rank IS NOT NULL
  LOOP
    PERFORM public.grant_daily_challenge_placement_reward(rec.user_id, p_challenge_id);
  END LOOP;

  UPDATE public.daily_challenges
  SET placement_rewards_granted = true
  WHERE id = p_challenge_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.finalize_expired_daily_challenges()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT id
    FROM public.daily_challenges
    WHERE status <> 'closed'
      AND ends_at + interval '10 minutes' < now()
      AND finalized_at IS NULL
  LOOP
    UPDATE public.daily_challenges
    SET status = 'closed', finalized_at = COALESCE(finalized_at, now())
    WHERE id = rec.id;

    PERFORM public.process_daily_challenge_placement_rewards(rec.id);
  END LOOP;

  -- Placement for challenges finalized earlier but not yet processed
  FOR rec IN
    SELECT id FROM public.daily_challenges
    WHERE finalized_at IS NOT NULL AND placement_rewards_granted = false
  LOOP
    PERFORM public.process_daily_challenge_placement_rewards(rec.id);
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.weekly_challenge_tier_for_points(p_points integer)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_points >= 600 THEN 'inferno_blazer'
    WHEN p_points >= 450 THEN 'elite_blazer'
    WHEN p_points >= 300 THEN 'gold_blazer'
    WHEN p_points >= 175 THEN 'silver_blazer'
    WHEN p_points >= 75 THEN 'bronze_blazer'
    ELSE NULL
  END;
$$;

CREATE OR REPLACE FUNCTION public.weekly_challenge_coins_for_tier(p_tier text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = public
AS $$
  SELECT CASE p_tier
    WHEN 'inferno_blazer' THEN 600
    WHEN 'elite_blazer' THEN 400
    WHEN 'gold_blazer' THEN 250
    WHEN 'silver_blazer' THEN 150
    WHEN 'bronze_blazer' THEN 75
    ELSE 0
  END;
$$;

CREATE OR REPLACE FUNCTION public.finalize_weekly_challenge_if_ready(p_week_start date)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_week_end date := p_week_start + 7;
  v_last_day date := v_week_end - 1;
  v_ready boolean;
BEGIN
  IF p_week_start IS NULL THEN
    RETURN false;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.daily_challenges c
    WHERE c.challenge_date = v_last_day
      AND c.finalized_at IS NOT NULL
      AND c.finalized_at + interval '10 minutes' < now()
  ) INTO v_ready;

  IF NOT v_ready AND (v_week_end::timestamptz AT TIME ZONE 'UTC') + interval '10 minutes' >= now() THEN
    RETURN false;
  END IF;

  INSERT INTO public.weekly_challenge_finalization (week_start, finalized_at, reward_rules_version)
  VALUES (p_week_start, now(), 1)
  ON CONFLICT (week_start) DO UPDATE
  SET finalized_at = COALESCE(public.weekly_challenge_finalization.finalized_at, now());

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_weekly_challenge_reward(
  p_week_start date DEFAULT NULL,
  p_user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := COALESCE(p_user_id, auth.uid());
  v_week_start date := COALESCE(
    p_week_start,
    date_trunc('week', (now() AT TIME ZONE 'UTC')::date - interval '7 days')::date
  );
  v_points integer := 0;
  v_tier text;
  v_coins integer;
  v_key text;
  v_existing public.challenge_reward_claims%ROWTYPE;
  v_wallet jsonb;
  v_finalized boolean;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  v_finalized := public.finalize_weekly_challenge_if_ready(v_week_start);
  IF NOT v_finalized THEN
    RETURN jsonb_build_object('claimed', false, 'reason', 'week_not_finalized');
  END IF;

  SELECT COALESCE(SUM(lb.challenge_points), 0)::integer INTO v_points
  FROM public.daily_challenge_leaderboard lb
  WHERE lb.challenge_date >= v_week_start
    AND lb.challenge_date < v_week_start + 7
    AND lb.user_id = v_user_id;

  v_tier := public.weekly_challenge_tier_for_points(v_points);
  IF v_tier IS NULL THEN
    RETURN jsonb_build_object('claimed', false, 'reason', 'no_tier', 'challenge_points', v_points);
  END IF;

  v_coins := public.weekly_challenge_coins_for_tier(v_tier);
  v_key := 'weekly_challenge_reward:' || v_week_start::text || ':' || v_user_id::text || ':' || v_tier;

  SELECT * INTO v_existing FROM public.challenge_reward_claims WHERE idempotency_key = v_key;
  IF FOUND THEN
    RETURN jsonb_build_object(
      'claimed', false, 'already_claimed', true, 'tier', v_tier,
      'blaze_coins', v_existing.blaze_coins, 'challenge_points', v_points
    );
  END IF;

  IF v_coins > 0 THEN
    v_wallet := public.apply_wallet_delta(
      v_user_id, v_coins, 'earn', 'weekly_challenge_reward', v_key,
      jsonb_build_object('week_start', v_week_start, 'tier', v_tier, 'challenge_points', v_points)
    );
  END IF;

  IF v_tier IN ('elite_blazer', 'inferno_blazer') THEN
  PERFORM public.unlock_cosmetic(
    v_user_id,
    CASE v_tier WHEN 'elite_blazer' THEN 'elite_blazer_title' ELSE 'inferno_blazer_title' END,
    'title',
    'challenge'
  );
  END IF;

  IF v_tier = 'inferno_blazer' THEN
    PERFORM public.unlock_cosmetic(v_user_id, 'inferno_challenge_badge', 'profile_frame', 'challenge');
  END IF;

  INSERT INTO public.challenge_reward_claims (
    user_id, reward_type, period_key, tier, blaze_coins, xp, idempotency_key
  )
  VALUES (v_user_id, 'weekly_tier', v_week_start::text, v_tier, v_coins, 0, v_key);

  RETURN jsonb_build_object(
    'claimed', true,
    'already_claimed', false,
    'tier', v_tier,
    'blaze_coins', v_coins,
    'challenge_points', v_points,
    'balance', COALESCE(v_wallet->'balance', (SELECT blaze_coins FROM public.player_wallets WHERE user_id = v_user_id))
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.grant_challenge_streak_milestone(
  p_user_id uuid,
  p_milestone integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key text := 'challenge_streak_milestone:' || p_milestone::text || ':' || p_user_id::text;
  v_existing public.challenge_reward_claims%ROWTYPE;
  v_coins integer := 0;
  v_wallet jsonb;
  v_title text;
  v_badge text;
BEGIN
  IF p_user_id IS NULL OR p_milestone IS NULL THEN
    RAISE EXCEPTION 'user_id and milestone are required';
  END IF;

  SELECT * INTO v_existing FROM public.challenge_reward_claims WHERE idempotency_key = v_key;
  IF FOUND THEN
    RETURN jsonb_build_object('granted', false, 'already_claimed', true, 'milestone', p_milestone);
  END IF;

  v_coins := CASE p_milestone
    WHEN 3 THEN 50
    WHEN 7 THEN 125
    WHEN 14 THEN 250
    WHEN 30 THEN 500
    ELSE 0
  END;

  IF v_coins <= 0 THEN
    RETURN jsonb_build_object('granted', false, 'reason', 'invalid_milestone');
  END IF;

  v_wallet := public.apply_wallet_delta(
    p_user_id, v_coins, 'earn', 'challenge_streak_milestone', v_key,
    jsonb_build_object('milestone', p_milestone)
  );

  IF p_milestone = 7 THEN
    PERFORM public.unlock_cosmetic(p_user_id, 'weekly_warrior_title', 'title', 'challenge');
  ELSIF p_milestone = 14 THEN
    PERFORM public.unlock_cosmetic(p_user_id, 'challenge_flame_badge', 'profile_frame', 'challenge');
  ELSIF p_milestone = 30 THEN
    PERFORM public.unlock_cosmetic(p_user_id, 'daily_legend_title', 'title', 'challenge');
    PERFORM public.unlock_cosmetic(p_user_id, 'daily_legend_badge', 'profile_frame', 'challenge');
  END IF;

  INSERT INTO public.challenge_reward_claims (
    user_id, reward_type, period_key, tier, blaze_coins, xp, idempotency_key
  )
  VALUES (p_user_id, 'streak_milestone', p_milestone::text, p_milestone::text, v_coins, 0, v_key);

  RETURN jsonb_build_object(
    'granted', true,
    'milestone', p_milestone,
    'blaze_coins', v_coins,
    'balance', v_wallet->'balance'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_challenge_reward_status(
  p_challenge_date date DEFAULT NULL,
  p_user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := COALESCE(p_user_id, auth.uid());
  v_date date := COALESCE(p_challenge_date, (now() AT TIME ZONE 'UTC')::date);
  v_challenge_id uuid;
  v_finalized boolean;
  v_participation jsonb;
  v_placement jsonb;
  v_participation_granted boolean;
  v_placement_granted boolean;
  v_rank integer;
  v_week_start date := date_trunc('week', v_date::timestamptz)::date;
  v_week_points integer := 0;
  v_week_tier text;
  v_prev_week_start date;
  v_prev_week_points integer := 0;
  v_prev_week_tier text;
  v_week_finalized boolean;
  v_week_claimed boolean;
  v_streak public.daily_challenge_streaks%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  PERFORM public.finalize_expired_daily_challenges();

  SELECT id, (finalized_at IS NOT NULL) INTO v_challenge_id, v_finalized
  FROM public.daily_challenges WHERE challenge_date = v_date;

  SELECT * INTO v_streak FROM public.daily_challenge_streaks WHERE user_id = v_user_id;

  IF v_challenge_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.challenge_reward_claims
      WHERE user_id = v_user_id AND reward_type = 'participation' AND period_key = v_challenge_id::text
    ) INTO v_participation_granted;
    v_participation := jsonb_build_object('granted', v_participation_granted);

    SELECT a.daily_rank INTO v_rank
    FROM public.daily_challenge_attempts a
    WHERE a.challenge_id = v_challenge_id AND a.user_id = v_user_id
      AND a.attempt_type = 'ranked' AND a.verification_status = 'verified';

    SELECT EXISTS (
      SELECT 1 FROM public.challenge_reward_claims
      WHERE user_id = v_user_id AND reward_type = 'daily_placement' AND period_key = v_challenge_id::text
    ) INTO v_placement_granted;
    v_placement := jsonb_build_object(
      'finalized', v_finalized,
      'granted', v_placement_granted,
      'pending', NOT v_finalized AND v_rank IS NOT NULL,
      'rank', v_rank,
      'coins_if_finalized', public.daily_challenge_placement_coins(v_rank)
    );
  END IF;

  SELECT COALESCE(SUM(lb.challenge_points), 0)::integer INTO v_week_points
  FROM public.daily_challenge_leaderboard lb
  WHERE lb.user_id = v_user_id
    AND lb.challenge_date >= v_week_start
    AND lb.challenge_date < v_week_start + 7;

  v_week_tier := public.weekly_challenge_tier_for_points(v_week_points);
  v_prev_week_start := v_week_start - 7;
  SELECT COALESCE(SUM(lb.challenge_points), 0)::integer INTO v_prev_week_points
  FROM public.daily_challenge_leaderboard lb
  WHERE lb.user_id = v_user_id
    AND lb.challenge_date >= v_prev_week_start
    AND lb.challenge_date < v_week_start;
  v_prev_week_tier := public.weekly_challenge_tier_for_points(v_prev_week_points);
  v_week_finalized := public.finalize_weekly_challenge_if_ready(v_prev_week_start);

  SELECT EXISTS (
    SELECT 1 FROM public.challenge_reward_claims
    WHERE user_id = v_user_id AND reward_type = 'weekly_tier'
      AND period_key = v_prev_week_start::text
  ) INTO v_week_claimed;

  RETURN jsonb_build_object(
    'challengeDate', v_date,
    'participation', COALESCE(v_participation, jsonb_build_object('granted', false)),
    'placement', COALESCE(v_placement, jsonb_build_object('finalized', false, 'granted', false)),
    'weekly', jsonb_build_object(
      'weekStart', v_week_start,
      'challengePoints', v_week_points,
      'currentTier', v_week_tier,
      'coinsForTier', public.weekly_challenge_coins_for_tier(v_week_tier),
      'previousWeekStart', v_prev_week_start,
      'previousWeekPoints', v_prev_week_points,
      'previousWeekTier', v_prev_week_tier,
      'previousWeekFinalized', v_week_finalized,
      'previousWeekClaimable', v_week_finalized AND v_prev_week_tier IS NOT NULL AND NOT v_week_claimed,
      'previousWeekCoins', public.weekly_challenge_coins_for_tier(v_prev_week_tier)
    ),
    'streak', jsonb_build_object(
      'current', COALESCE(v_streak.current_streak, 0),
      'longest', COALESCE(v_streak.longest_streak, 0),
      'lastCompletedDate', v_streak.last_completed_date
    ),
    'serverTime', now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.grant_daily_challenge_participation_reward(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.grant_daily_challenge_placement_reward(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.process_daily_challenge_placement_rewards(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.grant_challenge_streak_milestone(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.grant_daily_challenge_participation_reward(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.grant_daily_challenge_placement_reward(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.process_daily_challenge_placement_rewards(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.grant_challenge_streak_milestone(uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.finalize_expired_daily_challenges() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.finalize_weekly_challenge_if_ready(date) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.claim_weekly_challenge_reward(date, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_challenge_reward_status(date, uuid) TO authenticated, service_role;
