-- 21 Blaze monetization beta
-- Safe to re-run where practical (IF NOT EXISTS, DROP POLICY IF EXISTS, OR REPLACE).
-- Tables, RLS, helpers, and SECURITY DEFINER RPCs for wallets, entitlements,
-- cosmetics, purchases, ad rewards, and remote feature flags.

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- ---------------------------------------------------------------------------
-- player_wallets — Blaze Coin balances (server-mutated only)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.player_wallets (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  blaze_coins bigint NOT NULL DEFAULT 0,
  lifetime_coins_earned bigint NOT NULL DEFAULT 0,
  lifetime_coins_spent bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT player_wallets_blaze_coins_check CHECK (blaze_coins >= 0),
  CONSTRAINT player_wallets_lifetime_earned_check CHECK (lifetime_coins_earned >= 0),
  CONSTRAINT player_wallets_lifetime_spent_check CHECK (lifetime_coins_spent >= 0)
);

CREATE INDEX IF NOT EXISTS player_wallets_updated_at_idx
  ON public.player_wallets (updated_at DESC);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'set_updated_at'
  ) THEN
    DROP TRIGGER IF EXISTS player_wallets_set_updated_at ON public.player_wallets;
    CREATE TRIGGER player_wallets_set_updated_at
      BEFORE UPDATE ON public.player_wallets
      FOR EACH ROW
      EXECUTE FUNCTION public.set_updated_at();
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- player_entitlements — durable unlocks (ads removal, packs, bundles, etc.)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.player_entitlements (
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  entitlement_key text NOT NULL,
  source text NOT NULL,
  revenuecat_product_id text,
  granted_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (user_id, entitlement_key),
  CONSTRAINT player_entitlements_source_check CHECK (
    source IN ('revenuecat', 'promotion', 'beta', 'admin', 'achievement')
  )
);

CREATE INDEX IF NOT EXISTS player_entitlements_user_id_idx
  ON public.player_entitlements (user_id);

CREATE INDEX IF NOT EXISTS player_entitlements_key_idx
  ON public.player_entitlements (entitlement_key);

CREATE INDEX IF NOT EXISTS player_entitlements_active_idx
  ON public.player_entitlements (user_id, entitlement_key)
  WHERE revoked_at IS NULL;

-- ---------------------------------------------------------------------------
-- player_cosmetics — owned cosmetic unlocks
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.player_cosmetics (
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  cosmetic_key text NOT NULL,
  category text NOT NULL,
  unlocked_at timestamptz NOT NULL DEFAULT now(),
  equipped_at timestamptz,
  source text NOT NULL,
  PRIMARY KEY (user_id, cosmetic_key),
  CONSTRAINT player_cosmetics_category_check CHECK (
    category IN (
      'card_theme',
      'arena',
      'profile_frame',
      'title',
      'emote',
      'victory_effect'
    )
  )
);

CREATE INDEX IF NOT EXISTS player_cosmetics_user_id_idx
  ON public.player_cosmetics (user_id);

CREATE INDEX IF NOT EXISTS player_cosmetics_user_category_idx
  ON public.player_cosmetics (user_id, category);

-- ---------------------------------------------------------------------------
-- equipped_cosmetics — currently equipped loadout (one row per player)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.equipped_cosmetics (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  card_theme text NOT NULL DEFAULT 'classic',
  arena text NOT NULL DEFAULT 'default',
  profile_frame text NOT NULL DEFAULT 'default',
  player_title text,
  victory_effect text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'set_updated_at'
  ) THEN
    DROP TRIGGER IF EXISTS equipped_cosmetics_set_updated_at ON public.equipped_cosmetics;
    CREATE TRIGGER equipped_cosmetics_set_updated_at
      BEFORE UPDATE ON public.equipped_cosmetics
      FOR EACH ROW
      EXECUTE FUNCTION public.set_updated_at();
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- wallet_transactions — append-only ledger with idempotency
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.wallet_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  transaction_type text NOT NULL,
  amount bigint NOT NULL,
  balance_after bigint NOT NULL,
  source_key text NOT NULL,
  idempotency_key text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT wallet_transactions_type_check CHECK (
    transaction_type IN ('earn', 'spend', 'grant', 'refund', 'adjustment')
  ),
  CONSTRAINT wallet_transactions_balance_after_check CHECK (balance_after >= 0),
  CONSTRAINT wallet_transactions_user_idempotency_unique UNIQUE (user_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS wallet_transactions_user_created_idx
  ON public.wallet_transactions (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS wallet_transactions_source_key_idx
  ON public.wallet_transactions (user_id, source_key, created_at DESC);

CREATE INDEX IF NOT EXISTS wallet_transactions_type_idx
  ON public.wallet_transactions (user_id, transaction_type, created_at DESC);

-- ---------------------------------------------------------------------------
-- purchase_events — RevenueCat / store webhook audit (server-only)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.purchase_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  revenuecat_event_id text NOT NULL,
  event_type text NOT NULL,
  product_id text,
  entitlement_ids text[] NOT NULL DEFAULT '{}'::text[],
  store text,
  environment text,
  event_timestamp timestamptz,
  raw_event jsonb NOT NULL DEFAULT '{}'::jsonb,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT purchase_events_revenuecat_event_id_unique UNIQUE (revenuecat_event_id)
);

CREATE INDEX IF NOT EXISTS purchase_events_user_id_idx
  ON public.purchase_events (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS purchase_events_event_type_idx
  ON public.purchase_events (event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS purchase_events_product_id_idx
  ON public.purchase_events (product_id);

-- ---------------------------------------------------------------------------
-- ad_reward_claims — rewarded-ad claim pipeline
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ad_reward_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  reward_type text NOT NULL,
  reward_amount bigint NOT NULL DEFAULT 0,
  match_id uuid,
  client_reward_id text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  ad_network text,
  created_at timestamptz NOT NULL DEFAULT now(),
  verified_at timestamptz,
  claimed_at timestamptz,
  CONSTRAINT ad_reward_claims_status_check CHECK (
    status IN ('pending', 'verified', 'granted', 'rejected', 'expired')
  ),
  CONSTRAINT ad_reward_claims_amount_check CHECK (reward_amount >= 0),
  CONSTRAINT ad_reward_claims_user_client_reward_unique UNIQUE (user_id, client_reward_id)
);

CREATE INDEX IF NOT EXISTS ad_reward_claims_user_id_idx
  ON public.ad_reward_claims (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS ad_reward_claims_status_idx
  ON public.ad_reward_claims (status, created_at DESC);

CREATE INDEX IF NOT EXISTS ad_reward_claims_match_id_idx
  ON public.ad_reward_claims (match_id)
  WHERE match_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- app_configuration — remote feature flags / config JSON
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.app_configuration (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'set_updated_at'
  ) THEN
    DROP TRIGGER IF EXISTS app_configuration_set_updated_at ON public.app_configuration;
    CREATE TRIGGER app_configuration_set_updated_at
      BEFORE UPDATE ON public.app_configuration
      FOR EACH ROW
      EXECUTE FUNCTION public.set_updated_at();
  END IF;
END;
$$;

-- Default monetization feature flags (upsert-safe).
INSERT INTO public.app_configuration (key, value)
VALUES
  ('monetization_enabled', 'true'::jsonb),
  ('rewarded_ads_enabled', 'true'::jsonb),
  ('interstitial_ads_enabled', 'true'::jsonb),
  ('store_purchases_enabled', 'true'::jsonb)
ON CONFLICT (key) DO UPDATE
SET
  value = EXCLUDED.value,
  updated_at = now();

-- ---------------------------------------------------------------------------
-- Helpers: free starter cosmetics for new / first-touch players
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.seed_free_player_cosmetics(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'user_id is required';
  END IF;

  -- Free defaults every player receives.
  INSERT INTO public.player_cosmetics (user_id, cosmetic_key, category, source)
  VALUES
    (p_user_id, 'classic', 'card_theme', 'beta'),
    (p_user_id, 'default', 'arena', 'beta'),
    (p_user_id, 'default', 'profile_frame', 'beta')
  ON CONFLICT (user_id, cosmetic_key) DO NOTHING;

  INSERT INTO public.equipped_cosmetics (user_id, card_theme, arena, profile_frame)
  VALUES (p_user_id, 'classic', 'default', 'default')
  ON CONFLICT (user_id) DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.seed_free_player_cosmetics(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.seed_free_player_cosmetics(uuid) TO service_role;

COMMENT ON FUNCTION public.seed_free_player_cosmetics(uuid) IS
  'Unlocks free default cosmetics (classic cards, default arena/frame) and ensures an equipped_cosmetics row.';

-- ---------------------------------------------------------------------------
-- 1) ensure_player_wallet — create wallet if missing, lock row FOR UPDATE
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ensure_player_wallet(p_user_id uuid)
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

  PERFORM public.seed_free_player_cosmetics(p_user_id);

  INSERT INTO public.player_wallets (user_id)
  VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT * INTO wallet
  FROM public.player_wallets
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'failed to ensure wallet for user %', p_user_id;
  END IF;

  RETURN wallet;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_player_wallet(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_player_wallet(uuid) TO service_role;

COMMENT ON FUNCTION public.ensure_player_wallet(uuid) IS
  'Inserts a player_wallets row if missing, seeds free cosmetics, and returns the row locked FOR UPDATE.';

-- ---------------------------------------------------------------------------
-- 2) apply_wallet_delta — idempotent balance mutation with ledger entry
--    p_amount is a signed delta (positive credit, negative debit).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.apply_wallet_delta(
  p_user_id uuid,
  p_amount bigint,
  p_type text,
  p_source_key text,
  p_idempotency_key text,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS public.player_wallets
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  wallet public.player_wallets;
  new_balance bigint;
  existing_id uuid;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'user_id is required';
  END IF;
  IF p_type IS NULL OR p_type NOT IN ('earn', 'spend', 'grant', 'refund', 'adjustment') THEN
    RAISE EXCEPTION 'invalid transaction_type: %', p_type;
  END IF;
  IF p_source_key IS NULL OR length(trim(p_source_key)) = 0 THEN
    RAISE EXCEPTION 'source_key is required';
  END IF;
  IF p_idempotency_key IS NULL OR length(trim(p_idempotency_key)) = 0 THEN
    RAISE EXCEPTION 'idempotency_key is required';
  END IF;

  -- Lock wallet first so concurrent idempotent calls serialize.
  wallet := public.ensure_player_wallet(p_user_id);

  SELECT id INTO existing_id
  FROM public.wallet_transactions
  WHERE user_id = p_user_id
    AND idempotency_key = p_idempotency_key;

  IF existing_id IS NOT NULL THEN
    RETURN wallet;
  END IF;

  new_balance := wallet.blaze_coins + p_amount;

  IF new_balance < 0 THEN
    RAISE EXCEPTION 'insufficient blaze coins: balance %, delta %', wallet.blaze_coins, p_amount;
  END IF;

  UPDATE public.player_wallets
  SET
    blaze_coins = new_balance,
    lifetime_coins_earned = lifetime_coins_earned
      + CASE WHEN p_amount > 0 THEN p_amount ELSE 0 END,
    lifetime_coins_spent = lifetime_coins_spent
      + CASE WHEN p_amount < 0 THEN -p_amount ELSE 0 END,
    updated_at = now()
  WHERE user_id = p_user_id
  RETURNING * INTO wallet;

  INSERT INTO public.wallet_transactions (
    user_id,
    transaction_type,
    amount,
    balance_after,
    source_key,
    idempotency_key,
    metadata
  )
  VALUES (
    p_user_id,
    p_type,
    p_amount,
    new_balance,
    p_source_key,
    p_idempotency_key,
    COALESCE(p_metadata, '{}'::jsonb)
  );

  RETURN wallet;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_wallet_delta(uuid, bigint, text, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_wallet_delta(uuid, bigint, text, text, text, jsonb) TO service_role;

COMMENT ON FUNCTION public.apply_wallet_delta(uuid, bigint, text, text, text, jsonb) IS
  'Applies a signed wallet delta with ledger + idempotency. Rejects negative resulting balances.';

-- ---------------------------------------------------------------------------
-- 3) grant_entitlement
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.grant_entitlement(
  p_user_id uuid,
  p_key text,
  p_source text,
  p_product_id text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS public.player_entitlements
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  row public.player_entitlements;
BEGIN
  IF p_user_id IS NULL OR p_key IS NULL OR length(trim(p_key)) = 0 THEN
    RAISE EXCEPTION 'user_id and entitlement key are required';
  END IF;
  IF p_source IS NULL OR p_source NOT IN ('revenuecat', 'promotion', 'beta', 'admin', 'achievement') THEN
    RAISE EXCEPTION 'invalid entitlement source: %', p_source;
  END IF;

  INSERT INTO public.player_entitlements (
    user_id,
    entitlement_key,
    source,
    revenuecat_product_id,
    granted_at,
    revoked_at,
    metadata
  )
  VALUES (
    p_user_id,
    p_key,
    p_source,
    p_product_id,
    now(),
    NULL,
    COALESCE(p_metadata, '{}'::jsonb)
  )
  ON CONFLICT (user_id, entitlement_key) DO UPDATE
  SET
    source = EXCLUDED.source,
    revenuecat_product_id = COALESCE(EXCLUDED.revenuecat_product_id, public.player_entitlements.revenuecat_product_id),
    granted_at = now(),
    revoked_at = NULL,
    metadata = public.player_entitlements.metadata || EXCLUDED.metadata
  RETURNING * INTO row;

  RETURN row;
END;
$$;

REVOKE ALL ON FUNCTION public.grant_entitlement(uuid, text, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.grant_entitlement(uuid, text, text, text, jsonb) TO service_role;

COMMENT ON FUNCTION public.grant_entitlement(uuid, text, text, text, jsonb) IS
  'Grants or re-activates an entitlement for a player (clears revoked_at).';

-- ---------------------------------------------------------------------------
-- 4) revoke_entitlement
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.revoke_entitlement(
  p_user_id uuid,
  p_key text,
  p_reason text DEFAULT NULL
)
RETURNS public.player_entitlements
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  row public.player_entitlements;
BEGIN
  IF p_user_id IS NULL OR p_key IS NULL OR length(trim(p_key)) = 0 THEN
    RAISE EXCEPTION 'user_id and entitlement key are required';
  END IF;

  UPDATE public.player_entitlements
  SET
    revoked_at = now(),
    metadata = CASE
      WHEN p_reason IS NULL THEN metadata
      ELSE metadata || jsonb_build_object('revoke_reason', p_reason, 'revoked_at', now())
    END
  WHERE user_id = p_user_id
    AND entitlement_key = p_key
  RETURNING * INTO row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'entitlement % not found for user %', p_key, p_user_id;
  END IF;

  RETURN row;
END;
$$;

REVOKE ALL ON FUNCTION public.revoke_entitlement(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.revoke_entitlement(uuid, text, text) TO service_role;

COMMENT ON FUNCTION public.revoke_entitlement(uuid, text, text) IS
  'Marks an entitlement as revoked and optionally records a reason in metadata.';

-- ---------------------------------------------------------------------------
-- 5) unlock_cosmetic
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.unlock_cosmetic(
  p_user_id uuid,
  p_cosmetic_key text,
  p_category text,
  p_source text
)
RETURNS public.player_cosmetics
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  row public.player_cosmetics;
BEGIN
  IF p_user_id IS NULL
     OR p_cosmetic_key IS NULL OR length(trim(p_cosmetic_key)) = 0
     OR p_category IS NULL
     OR p_source IS NULL OR length(trim(p_source)) = 0
  THEN
    RAISE EXCEPTION 'user_id, cosmetic_key, category, and source are required';
  END IF;

  IF p_category NOT IN (
    'card_theme', 'arena', 'profile_frame', 'title', 'emote', 'victory_effect'
  ) THEN
    RAISE EXCEPTION 'invalid cosmetic category: %', p_category;
  END IF;

  INSERT INTO public.player_cosmetics (
    user_id,
    cosmetic_key,
    category,
    source
  )
  VALUES (
    p_user_id,
    p_cosmetic_key,
    p_category,
    p_source
  )
  ON CONFLICT (user_id, cosmetic_key) DO UPDATE
  SET
    category = EXCLUDED.category
    -- Keep original unlocked_at / source on conflict (ownership is sticky).
  RETURNING * INTO row;

  RETURN row;
END;
$$;

REVOKE ALL ON FUNCTION public.unlock_cosmetic(uuid, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.unlock_cosmetic(uuid, text, text, text) TO service_role;

COMMENT ON FUNCTION public.unlock_cosmetic(uuid, text, text, text) IS
  'Unlocks a cosmetic for a player. Idempotent on (user_id, cosmetic_key).';

-- ---------------------------------------------------------------------------
-- 6) equip_cosmetic_secure — ownership or free-default check; client-callable
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.equip_cosmetic_secure(
  p_user_id uuid,
  p_cosmetic_key text,
  p_category text
)
RETURNS public.equipped_cosmetics
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  owns boolean := false;
  is_free_default boolean := false;
  row public.equipped_cosmetics;
  caller uuid := auth.uid();
BEGIN
  IF p_user_id IS NULL
     OR p_cosmetic_key IS NULL OR length(trim(p_cosmetic_key)) = 0
     OR p_category IS NULL
  THEN
    RAISE EXCEPTION 'user_id, cosmetic_key, and category are required';
  END IF;

  -- Authenticated callers may only equip for themselves; service_role may act for any user.
  IF caller IS NOT NULL AND caller IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'not allowed to equip cosmetics for another user';
  END IF;

  IF p_category NOT IN (
    'card_theme', 'arena', 'profile_frame', 'title', 'emote', 'victory_effect'
  ) THEN
    RAISE EXCEPTION 'invalid cosmetic category: %', p_category;
  END IF;

  -- Free defaults that do not require a prior unlock row.
  is_free_default := (
    (p_category = 'card_theme' AND p_cosmetic_key = 'classic')
    OR (p_category = 'arena' AND p_cosmetic_key = 'default')
    OR (p_category = 'profile_frame' AND p_cosmetic_key = 'default')
  );

  SELECT EXISTS (
    SELECT 1
    FROM public.player_cosmetics
    WHERE user_id = p_user_id
      AND cosmetic_key = p_cosmetic_key
      AND category = p_category
  ) INTO owns;

  IF NOT owns AND NOT is_free_default THEN
    RAISE EXCEPTION 'cosmetic % (%) is not owned', p_cosmetic_key, p_category;
  END IF;

  -- Ensure free defaults + equipped row exist.
  PERFORM public.seed_free_player_cosmetics(p_user_id);

  IF is_free_default AND NOT owns THEN
    PERFORM public.unlock_cosmetic(p_user_id, p_cosmetic_key, p_category, 'beta');
  END IF;

  -- Mark equipped timestamp on ownership row when present.
  UPDATE public.player_cosmetics
  SET equipped_at = now()
  WHERE user_id = p_user_id
    AND cosmetic_key = p_cosmetic_key;

  INSERT INTO public.equipped_cosmetics (user_id)
  VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  IF p_category = 'card_theme' THEN
    UPDATE public.equipped_cosmetics
    SET card_theme = p_cosmetic_key, updated_at = now()
    WHERE user_id = p_user_id
    RETURNING * INTO row;
  ELSIF p_category = 'arena' THEN
    UPDATE public.equipped_cosmetics
    SET arena = p_cosmetic_key, updated_at = now()
    WHERE user_id = p_user_id
    RETURNING * INTO row;
  ELSIF p_category = 'profile_frame' THEN
    UPDATE public.equipped_cosmetics
    SET profile_frame = p_cosmetic_key, updated_at = now()
    WHERE user_id = p_user_id
    RETURNING * INTO row;
  ELSIF p_category = 'title' THEN
    UPDATE public.equipped_cosmetics
    SET player_title = p_cosmetic_key, updated_at = now()
    WHERE user_id = p_user_id
    RETURNING * INTO row;
  ELSIF p_category = 'victory_effect' THEN
    UPDATE public.equipped_cosmetics
    SET victory_effect = p_cosmetic_key, updated_at = now()
    WHERE user_id = p_user_id
    RETURNING * INTO row;
  ELSIF p_category = 'emote' THEN
    -- Emotes are owned via player_cosmetics; no dedicated equipped column yet.
    SELECT * INTO row
    FROM public.equipped_cosmetics
    WHERE user_id = p_user_id;
  ELSE
    RAISE EXCEPTION 'unsupported equip category: %', p_category;
  END IF;

  RETURN row;
END;
$$;

REVOKE ALL ON FUNCTION public.equip_cosmetic_secure(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.equip_cosmetic_secure(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.equip_cosmetic_secure(uuid, text, text) TO service_role;

COMMENT ON FUNCTION public.equip_cosmetic_secure(uuid, text, text) IS
  'Equips a cosmetic after verifying ownership or free defaults (classic/default). Callable by authenticated + service_role.';

-- ---------------------------------------------------------------------------
-- 7) grant_founders_bundle_benefits
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

  -- Cosmetics
  PERFORM public.unlock_cosmetic(p_user_id, 'inferno_cards', 'card_theme', 'revenuecat');
  PERFORM public.unlock_cosmetic(p_user_id, 'volcano_arena', 'arena', 'revenuecat');
  PERFORM public.unlock_cosmetic(p_user_id, 'founder_frame', 'profile_frame', 'revenuecat');
  PERFORM public.unlock_cosmetic(p_user_id, 'founder_title', 'title', 'revenuecat');

  -- Entitlements
  PERFORM public.grant_entitlement(p_user_id, 'remove_ads', 'revenuecat', NULL, '{"bundle":"founders"}'::jsonb);
  PERFORM public.grant_entitlement(p_user_id, 'cards_inferno', 'revenuecat', NULL, '{"bundle":"founders"}'::jsonb);
  PERFORM public.grant_entitlement(p_user_id, 'arena_volcano', 'revenuecat', NULL, '{"bundle":"founders"}'::jsonb);
  PERFORM public.grant_entitlement(p_user_id, 'founder_frame', 'revenuecat', NULL, '{"bundle":"founders"}'::jsonb);
  PERFORM public.grant_entitlement(p_user_id, 'founder_title', 'revenuecat', NULL, '{"bundle":"founders"}'::jsonb);
  PERFORM public.grant_entitlement(p_user_id, 'founders_bundle', 'revenuecat', NULL, '{"bundle":"founders"}'::jsonb);

  -- One-time coin grant (idempotent).
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
  'Grants Founders Bundle cosmetics, entitlements, and a one-time 2500 coin grant.';

-- ---------------------------------------------------------------------------
-- 8) calculate_solo_match_coins — pure reward formula
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.calculate_solo_match_coins(
  p_score integer,
  p_is_first_of_day boolean
)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT
    25
    + CASE WHEN COALESCE(p_score, 0) >= 1000 THEN 10 ELSE 0 END
    + CASE WHEN COALESCE(p_score, 0) >= 2000 THEN 15 ELSE 0 END
    + CASE WHEN COALESCE(p_score, 0) >= 3000 THEN 25 ELSE 0 END
    + CASE WHEN COALESCE(p_is_first_of_day, false) THEN 50 ELSE 0 END;
$$;

REVOKE ALL ON FUNCTION public.calculate_solo_match_coins(integer, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.calculate_solo_match_coins(integer, boolean) TO service_role;

COMMENT ON FUNCTION public.calculate_solo_match_coins(integer, boolean) IS
  'Pure coin formula: base 25 + score thresholds (1000/2000/3000) + optional first-of-day 50.';

-- ---------------------------------------------------------------------------
-- 9) claim_solo_match_coins — verified online_matches payout
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
  is_first_of_day boolean := false;
  coins integer := 0;
  source_key text;
  wallet public.player_wallets;
  idem_key text;
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

  idem_key := 'solo_coins:' || p_match_id::text;

  -- Quit earns nothing (still ledgered for idempotency).
  IF p_game_over_reason = 'quit' THEN
    wallet := public.apply_wallet_delta(
      p_user_id,
      0,
      'earn',
      'solo_coins',
      idem_key,
      jsonb_build_object(
        'match_id', p_match_id,
        'score', p_score,
        'game_over_reason', p_game_over_reason,
        'coins', 0
      )
    );
    RETURN wallet;
  END IF;

  -- First solo claim of the UTC day that used the first-day bonus.
  SELECT NOT EXISTS (
    SELECT 1
    FROM public.wallet_transactions wt
    WHERE wt.user_id = p_user_id
      AND wt.source_key LIKE 'solo_first_day%'
      AND (wt.created_at AT TIME ZONE 'utc')::date = (now() AT TIME ZONE 'utc')::date
  ) INTO is_first_of_day;

  coins := public.calculate_solo_match_coins(p_score, is_first_of_day);
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
      'score', p_score,
      'game_over_reason', p_game_over_reason,
      'is_first_of_day', is_first_of_day,
      'coins', coins
    )
  );

  RETURN wallet;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_solo_match_coins(uuid, uuid, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_solo_match_coins(uuid, uuid, integer, text) TO service_role;

COMMENT ON FUNCTION public.claim_solo_match_coins(uuid, uuid, integer, text) IS
  'Pays solo online_matches coin rewards. Quit=0. Idempotent via solo_coins:{match_id}. Tracks first-of-day via source_key solo_first_day.';

-- ---------------------------------------------------------------------------
-- 10) purchase_cosmetic_with_coins — server catalog prices, atomic buy
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.purchase_cosmetic_with_coins(
  p_user_id uuid,
  p_cosmetic_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  price bigint;
  category text;
  already public.player_cosmetics%ROWTYPE;
  wallet public.player_wallets;
  unlocked public.player_cosmetics%ROWTYPE;
  equipped public.equipped_cosmetics%ROWTYPE;
BEGIN
  IF p_user_id IS NULL OR p_cosmetic_key IS NULL OR length(trim(p_cosmetic_key)) = 0 THEN
    RAISE EXCEPTION 'user_id and cosmetic_key are required';
  END IF;

  -- Hardcoded beta catalog.
  CASE p_cosmetic_key
    WHEN 'midnight_cards' THEN
      price := 3000;
      category := 'card_theme';
    WHEN 'ember_arena' THEN
      price := 5000;
      category := 'arena';
    WHEN 'hot_streak_title' THEN
      price := 2000;
      category := 'title';
    WHEN 'flame_profile_frame' THEN
      price := 2500;
      category := 'profile_frame';
    ELSE
      RAISE EXCEPTION 'cosmetic % is not available for coin purchase', p_cosmetic_key;
  END CASE;

  PERFORM public.ensure_player_wallet(p_user_id);

  SELECT * INTO already
  FROM public.player_cosmetics
  WHERE user_id = p_user_id
    AND cosmetic_key = p_cosmetic_key;

  IF FOUND THEN
    SELECT * INTO wallet FROM public.player_wallets WHERE user_id = p_user_id;
    SELECT * INTO equipped FROM public.equipped_cosmetics WHERE user_id = p_user_id;
    RETURN jsonb_build_object(
      'already_owned', true,
      'cosmetic', to_jsonb(already),
      'wallet', to_jsonb(wallet),
      'equipped', to_jsonb(equipped)
    );
  END IF;

  wallet := public.apply_wallet_delta(
    p_user_id,
    -price,
    'spend',
    'cosmetic_purchase:' || p_cosmetic_key,
    'cosmetic_purchase:' || p_user_id::text || ':' || p_cosmetic_key,
    jsonb_build_object(
      'cosmetic_key', p_cosmetic_key,
      'category', category,
      'price', price
    )
  );

  -- If a concurrent purchase unlocked first, avoid double-unlock side effects;
  -- spend is already idempotent via the key above.
  unlocked := public.unlock_cosmetic(p_user_id, p_cosmetic_key, category, 'purchase');

  SELECT * INTO equipped FROM public.equipped_cosmetics WHERE user_id = p_user_id;

  RETURN jsonb_build_object(
    'already_owned', false,
    'cosmetic', to_jsonb(unlocked),
    'wallet', to_jsonb(wallet),
    'equipped', to_jsonb(equipped)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.purchase_cosmetic_with_coins(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.purchase_cosmetic_with_coins(uuid, text) TO service_role;

COMMENT ON FUNCTION public.purchase_cosmetic_with_coins(uuid, text) IS
  'Atomically spends Blaze Coins for a catalog cosmetic. Idempotent if already owned (no double charge).';

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.player_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_cosmetics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipped_cosmetics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ad_reward_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_configuration ENABLE ROW LEVEL SECURITY;

-- wallets: select own only; no client write
DROP POLICY IF EXISTS "player_wallets_select_own" ON public.player_wallets;
CREATE POLICY "player_wallets_select_own"
  ON public.player_wallets
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- entitlements: select own; no client write
DROP POLICY IF EXISTS "player_entitlements_select_own" ON public.player_entitlements;
CREATE POLICY "player_entitlements_select_own"
  ON public.player_entitlements
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- cosmetics: select own; no client write
DROP POLICY IF EXISTS "player_cosmetics_select_own" ON public.player_cosmetics;
CREATE POLICY "player_cosmetics_select_own"
  ON public.player_cosmetics
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- equipped: select own; writes only via equip_cosmetic_secure
DROP POLICY IF EXISTS "equipped_cosmetics_select_own" ON public.equipped_cosmetics;
CREATE POLICY "equipped_cosmetics_select_own"
  ON public.equipped_cosmetics
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- wallet_transactions: select own; no write
DROP POLICY IF EXISTS "wallet_transactions_select_own" ON public.wallet_transactions;
CREATE POLICY "wallet_transactions_select_own"
  ON public.wallet_transactions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- ad_reward_claims: select own; no write
DROP POLICY IF EXISTS "ad_reward_claims_select_own" ON public.ad_reward_claims;
CREATE POLICY "ad_reward_claims_select_own"
  ON public.ad_reward_claims
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- app_configuration: authenticated may SELECT
DROP POLICY IF EXISTS "app_configuration_select_authenticated" ON public.app_configuration;
CREATE POLICY "app_configuration_select_authenticated"
  ON public.app_configuration
  FOR SELECT
  TO authenticated
  USING (true);

-- purchase_events: no client policies (service_role bypasses RLS)

-- Table grants
GRANT SELECT ON public.player_wallets TO authenticated;
GRANT SELECT ON public.player_entitlements TO authenticated;
GRANT SELECT ON public.player_cosmetics TO authenticated;
GRANT SELECT ON public.equipped_cosmetics TO authenticated;
GRANT SELECT ON public.wallet_transactions TO authenticated;
GRANT SELECT ON public.ad_reward_claims TO authenticated;
GRANT SELECT ON public.app_configuration TO authenticated;

REVOKE INSERT, UPDATE, DELETE ON public.player_wallets FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.player_entitlements FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.player_cosmetics FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.equipped_cosmetics FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.wallet_transactions FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.ad_reward_claims FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.app_configuration FROM authenticated, anon;

REVOKE ALL ON public.purchase_events FROM authenticated, anon;
REVOKE ALL ON public.player_wallets FROM anon;
REVOKE ALL ON public.player_entitlements FROM anon;
REVOKE ALL ON public.player_cosmetics FROM anon;
REVOKE ALL ON public.equipped_cosmetics FROM anon;
REVOKE ALL ON public.wallet_transactions FROM anon;
REVOKE ALL ON public.ad_reward_claims FROM anon;
REVOKE ALL ON public.app_configuration FROM anon;

COMMENT ON TABLE public.player_wallets IS
  'Blaze Coin balances. Mutations via ensure_player_wallet / apply_wallet_delta only.';
COMMENT ON TABLE public.player_entitlements IS
  'Durable player entitlements (ads, packs, bundles). Server-granted only.';
COMMENT ON TABLE public.player_cosmetics IS
  'Owned cosmetics unlocked via beta, purchase, RevenueCat, or admin.';
COMMENT ON TABLE public.equipped_cosmetics IS
  'Currently equipped cosmetic loadout. Client updates via equip_cosmetic_secure.';
COMMENT ON TABLE public.wallet_transactions IS
  'Append-only wallet ledger with per-user idempotency keys.';
COMMENT ON TABLE public.purchase_events IS
  'RevenueCat/store webhook audit trail. No client access.';
COMMENT ON TABLE public.ad_reward_claims IS
  'Rewarded ad claim lifecycle (pending → verified → granted).';
COMMENT ON TABLE public.app_configuration IS
  'Remote feature flags and configuration JSON blobs.';
