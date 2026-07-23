-- RC 0.9.0 hardening
-- 1) Solo coin claims must use verified_scores.score (never client-chosen amounts).
-- 2) Founders pack grants ad_free + inferno_pack + neon_pack (+ founder cosmetics/coins).
-- Keeps existing claim_solo_match_coins(uuid, uuid, integer, text) signature for the Edge Function.

-- ---------------------------------------------------------------------------
-- claim_solo_match_coins — server score from verified_scores
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.claim_solo_match_coins(
  p_user_id uuid,
  p_match_id uuid,
  p_score integer,
  p_game_over_reason text
)
RETURNS public.player_wallets
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  match_row public.online_matches%ROWTYPE;
  score_row public.verified_scores%ROWTYPE;
  is_first_of_day boolean := false;
  coins integer := 0;
  source_key text;
  wallet public.player_wallets;
  idem_key text;
  verified_score integer;
  verified_reason text;
BEGIN
  IF p_user_id IS NULL OR p_match_id IS NULL THEN
    RAISE EXCEPTION 'user_id and match_id are required';
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

  -- Authoritative values from verified_scores. Client p_score / p_game_over_reason ignored.
  verified_score := score_row.score;
  verified_reason := score_row.game_over_reason;

  idem_key := 'solo_coins:' || p_match_id::text;

  IF verified_reason = 'quit' THEN
    wallet := public.apply_wallet_delta(
      p_user_id,
      0,
      'earn',
      'solo_coins',
      idem_key,
      jsonb_build_object(
        'match_id', p_match_id,
        'score', verified_score,
        'game_over_reason', verified_reason,
        'coins', 0,
        'client_score_ignored', p_score
      )
    );
    RETURN wallet;
  END IF;

  SELECT NOT EXISTS (
    SELECT 1
    FROM public.wallet_transactions wt
    WHERE wt.user_id = p_user_id
      AND wt.source_key LIKE 'solo_first_day%'
      AND (wt.created_at AT TIME ZONE 'utc')::date = (now() AT TIME ZONE 'utc')::date
  ) INTO is_first_of_day;

  coins := public.calculate_solo_match_coins(verified_score, is_first_of_day);
  source_key := CASE
    WHEN is_first_of_day THEN 'solo_first_day'
    ELSE 'solo_coins'
  END;

  wallet := public.apply_wallet_delta(
    p_user_id,
    coins::bigint,
    'earn',
    source_key,
    idem_key,
    jsonb_build_object(
      'match_id', p_match_id,
      'score', verified_score,
      'game_over_reason', verified_reason,
      'is_first_of_day', is_first_of_day,
      'coins', coins,
      'client_score_ignored', p_score
    )
  );

  RETURN wallet;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_solo_match_coins(uuid, uuid, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_solo_match_coins(uuid, uuid, integer, text) TO service_role;

COMMENT ON FUNCTION public.claim_solo_match_coins(uuid, uuid, integer, text) IS
  'RC 0.9.0: pays solo coins from verified_scores only. Client p_score is ignored. Idempotent via solo_coins:{match_id}.';

-- ---------------------------------------------------------------------------
-- grant_founders_bundle_benefits — RC Founders Pack entitlement set
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.grant_founders_bundle_benefits(p_user_id uuid)
RETURNS public.player_wallets
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  wallet public.player_wallets;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'user_id is required';
  END IF;

  PERFORM public.ensure_player_wallet(p_user_id);

  -- Cosmetics (neon pack replaces volcano for RC Founders mapping)
  PERFORM public.unlock_cosmetic(p_user_id, 'inferno_cards', 'card_theme', 'revenuecat');
  PERFORM public.unlock_cosmetic(p_user_id, 'blue_flame_cards', 'card_theme', 'revenuecat');
  PERFORM public.unlock_cosmetic(p_user_id, 'neon_casino_arena', 'arena', 'revenuecat');
  PERFORM public.unlock_cosmetic(p_user_id, 'founder_frame', 'profile_frame', 'revenuecat');
  PERFORM public.unlock_cosmetic(p_user_id, 'founder_title', 'title', 'revenuecat');

  -- Entitlements: founders_pack + ad_free + inferno_pack + neon_pack (+ legacy aliases)
  PERFORM public.grant_entitlement(p_user_id, 'founders_pack', 'revenuecat', NULL, '{"bundle":"founders"}'::jsonb);
  PERFORM public.grant_entitlement(p_user_id, 'ad_free', 'revenuecat', NULL, '{"bundle":"founders"}'::jsonb);
  PERFORM public.grant_entitlement(p_user_id, 'inferno_pack', 'revenuecat', NULL, '{"bundle":"founders"}'::jsonb);
  PERFORM public.grant_entitlement(p_user_id, 'neon_pack', 'revenuecat', NULL, '{"bundle":"founders"}'::jsonb);
  PERFORM public.grant_entitlement(p_user_id, 'founders_bundle', 'revenuecat', NULL, '{"bundle":"founders"}'::jsonb);
  PERFORM public.grant_entitlement(p_user_id, 'remove_ads', 'revenuecat', NULL, '{"bundle":"founders"}'::jsonb);
  PERFORM public.grant_entitlement(p_user_id, 'cards_inferno', 'revenuecat', NULL, '{"bundle":"founders"}'::jsonb);
  PERFORM public.grant_entitlement(p_user_id, 'cards_blue_flame', 'revenuecat', NULL, '{"bundle":"founders"}'::jsonb);
  PERFORM public.grant_entitlement(p_user_id, 'arena_neon_casino', 'revenuecat', NULL, '{"bundle":"founders"}'::jsonb);
  PERFORM public.grant_entitlement(p_user_id, 'founder_frame', 'revenuecat', NULL, '{"bundle":"founders"}'::jsonb);
  PERFORM public.grant_entitlement(p_user_id, 'founder_title', 'revenuecat', NULL, '{"bundle":"founders"}'::jsonb);

  wallet := public.apply_wallet_delta(
    p_user_id,
    2500,
    'grant',
    'founders_bundle',
    'founders_bundle_coin_grant:' || p_user_id::text,
    '{"bundle":"founders"}'::jsonb
  );

  RETURN wallet;
END;
$$;

REVOKE ALL ON FUNCTION public.grant_founders_bundle_benefits(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.grant_founders_bundle_benefits(uuid) TO service_role;

COMMENT ON FUNCTION public.grant_founders_bundle_benefits(uuid) IS
  'RC 0.9.0: Founders Pack → founders_pack + ad_free + inferno_pack + neon_pack + founder cosmetics + one-time 2500 coins.';
