-- 21 Blaze Version 1.1C — rewarded-ad Server-Side Verification (SSV)
-- scaffolding for the new flat "25 Blaze Coins" reward.
--
-- This is intentionally separate from the pre-existing
-- `claim-ad-reward` / `ad_reward_claims` flow (the "double the match
-- reward" placement on Results), which is untouched by this migration.
-- That flow trusts the client's local EARNED_REWARD callback and is
-- already permanently gated off in production via
-- EXPO_PUBLIC_ENABLE_REWARDED_CURRENCY=false (see
-- docs/V1_1C_REWARDED_SSV.md) — nothing here changes that.
--
-- Flow implemented here:
--   1. Client calls request_rewarded_ad() BEFORE loading the ad. This
--      enforces the daily cap server-side (so we never waste an ad
--      impression the player couldn't be paid for) and returns an opaque
--      request id.
--   2. The client passes that id as `serverSideVerificationOptions.customData`
--      when creating the rewarded ad request, so AdMob echoes it back in
--      its SSV postback.
--   3. Google's ad servers call the verify-rewarded-ad Edge Function
--      directly (never the client). That function verifies Google's
--      ECDSA signature, then calls verify_and_grant_rewarded_ad(), which
--      is the only path that ever credits the wallet for this reward.
--   4. The client polls rewarded_ad_requests (RLS: select own rows only)
--      to learn when its pending request became verified.
--
-- Production currency is granted ONLY by step 3, using this table's own
-- `reward_amount` (fixed at request time), never a client- or
-- Google-echoed amount for the credited value.

CREATE TABLE IF NOT EXISTS public.rewarded_ad_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  reward_amount integer NOT NULL DEFAULT 25,
  transaction_id text,
  requested_at timestamptz NOT NULL DEFAULT now(),
  verified_at timestamptz,
  expires_at timestamptz NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT rewarded_ad_requests_status_check CHECK (
    status IN ('pending', 'verified', 'expired', 'failed')
  ),
  CONSTRAINT rewarded_ad_requests_reward_amount_check CHECK (reward_amount > 0),
  CONSTRAINT rewarded_ad_requests_transaction_id_unique UNIQUE (transaction_id)
);

CREATE INDEX IF NOT EXISTS rewarded_ad_requests_user_requested_idx
  ON public.rewarded_ad_requests (user_id, requested_at DESC);

CREATE INDEX IF NOT EXISTS rewarded_ad_requests_user_verified_idx
  ON public.rewarded_ad_requests (user_id, verified_at DESC)
  WHERE status = 'verified';

-- ---------------------------------------------------------------------------
-- request_rewarded_ad — pre-registers intent, enforces the daily cap before
-- any ad impression is shown.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.request_rewarded_ad(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller uuid := auth.uid();
  verified_today integer;
  new_row public.rewarded_ad_requests;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'user_id is required';
  END IF;
  IF caller IS NOT NULL AND caller IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'not allowed to request a rewarded ad for another user';
  END IF;

  SELECT count(*) INTO verified_today
  FROM public.rewarded_ad_requests
  WHERE user_id = p_user_id
    AND status = 'verified'
    AND (verified_at AT TIME ZONE 'utc')::date = (now() AT TIME ZONE 'utc')::date;

  IF verified_today >= 3 THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'daily_limit_reached',
      'dailyRemaining', 0
    );
  END IF;

  -- Expire any stale pending requests for this user so they never linger
  -- and can never be double-fulfilled by a delayed/replayed callback.
  UPDATE public.rewarded_ad_requests
  SET status = 'expired'
  WHERE user_id = p_user_id
    AND status = 'pending'
    AND expires_at < now();

  INSERT INTO public.rewarded_ad_requests (user_id, reward_amount, expires_at)
  VALUES (p_user_id, 25, now() + interval '10 minutes')
  RETURNING * INTO new_row;

  RETURN jsonb_build_object(
    'allowed', true,
    'requestId', new_row.id,
    'rewardAmount', new_row.reward_amount,
    'dailyRemaining', 3 - verified_today - 1
  );
END;
$$;

REVOKE ALL ON FUNCTION public.request_rewarded_ad(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_rewarded_ad(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_rewarded_ad(uuid) TO service_role;

COMMENT ON FUNCTION public.request_rewarded_ad(uuid) IS
  'Version 1.1C — pre-registers a rewarded-ad reward intent and enforces the 3-per-UTC-day cap before any ad impression is requested.';

-- ---------------------------------------------------------------------------
-- verify_and_grant_rewarded_ad — the ONLY path that credits Blaze Coins for
-- this reward. Callable exclusively by service_role from the
-- verify-rewarded-ad Edge Function, after that function has independently
-- verified Google's ECDSA signature on the SSV callback.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.verify_and_grant_rewarded_ad(
  p_request_id uuid,
  p_transaction_id text,
  p_callback_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  req public.rewarded_ad_requests%ROWTYPE;
  verified_today integer;
  wallet public.player_wallets;
BEGIN
  IF p_request_id IS NULL OR p_transaction_id IS NULL OR length(trim(p_transaction_id)) = 0 THEN
    RAISE EXCEPTION 'request_id and transaction_id are required';
  END IF;

  SELECT * INTO req
  FROM public.rewarded_ad_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'rewarded ad request % not found', p_request_id;
  END IF;

  -- Already verified — idempotent duplicate-callback / replay protection.
  IF req.status = 'verified' THEN
    SELECT * INTO wallet FROM public.player_wallets WHERE user_id = req.user_id;
    RETURN jsonb_build_object(
      'already_verified', true,
      'balance', COALESCE(wallet.blaze_coins, 0),
      'granted', req.reward_amount
    );
  END IF;

  IF req.status <> 'pending' THEN
    RAISE EXCEPTION 'rewarded ad request % is % and cannot be verified', p_request_id, req.status;
  END IF;

  IF req.expires_at < now() THEN
    UPDATE public.rewarded_ad_requests SET status = 'expired' WHERE id = p_request_id;
    RAISE EXCEPTION 'rewarded ad request % has expired', p_request_id;
  END IF;

  SELECT count(*) INTO verified_today
  FROM public.rewarded_ad_requests
  WHERE user_id = req.user_id
    AND status = 'verified'
    AND (verified_at AT TIME ZONE 'utc')::date = (now() AT TIME ZONE 'utc')::date;

  IF verified_today >= 3 THEN
    UPDATE public.rewarded_ad_requests SET status = 'failed' WHERE id = p_request_id;
    RAISE EXCEPTION 'daily rewarded-ad limit already reached for user %', req.user_id;
  END IF;

  PERFORM public.ensure_player_wallet(req.user_id);

  -- The credited amount always comes from our own request row (fixed at
  -- request_rewarded_ad time), never from a client- or Google-echoed
  -- reward_amount in the callback — p_callback_metadata is stored only
  -- for audit, never used to determine the grant.
  wallet := public.apply_wallet_delta(
    req.user_id,
    req.reward_amount::bigint,
    'earn',
    'rewarded_ad',
    'rewarded_ad:' || p_request_id::text,
    jsonb_build_object(
      'request_id', p_request_id,
      'transaction_id', p_transaction_id,
      'reward_amount', req.reward_amount
    )
  );

  UPDATE public.rewarded_ad_requests
  SET
    status = 'verified',
    transaction_id = p_transaction_id,
    verified_at = now(),
    metadata = metadata || p_callback_metadata
  WHERE id = p_request_id;

  RETURN jsonb_build_object(
    'already_verified', false,
    'balance', wallet.blaze_coins,
    'granted', req.reward_amount
  );
END;
$$;

REVOKE ALL ON FUNCTION public.verify_and_grant_rewarded_ad(uuid, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_and_grant_rewarded_ad(uuid, text, jsonb) TO service_role;

COMMENT ON FUNCTION public.verify_and_grant_rewarded_ad(uuid, text, jsonb) IS
  'Version 1.1C — the only function that credits Blaze Coins for the flat rewarded-ad reward. Idempotent per transaction_id; enforces the 3/UTC-day cap a second time server-side.';

-- ---------------------------------------------------------------------------
-- RLS — a player may read (poll) only their own requests; no client writes.
-- ---------------------------------------------------------------------------
ALTER TABLE public.rewarded_ad_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rewarded_ad_requests_select_own" ON public.rewarded_ad_requests;
CREATE POLICY "rewarded_ad_requests_select_own"
  ON public.rewarded_ad_requests
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

GRANT SELECT ON public.rewarded_ad_requests TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.rewarded_ad_requests FROM authenticated, anon;
REVOKE ALL ON public.rewarded_ad_requests FROM anon;

COMMENT ON TABLE public.rewarded_ad_requests IS
  'Version 1.1C — one row per rewarded-ad reward attempt for the flat 25-coin reward. Client may only SELECT its own rows to poll verification status.';
