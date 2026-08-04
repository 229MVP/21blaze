-- 21 Blaze Version 1.1B — Blaze Locker and free cosmetics.
-- Safe to re-run where practical (IF NOT EXISTS, DROP CONSTRAINT/POLICY IF
-- EXISTS, OR REPLACE, ON CONFLICT upserts).
--
-- Extends the existing `cosmetic_catalog` (introduced in
-- 0006_progression_beta.sql) with the fields required for a real,
-- server-driven catalog (cosmetic_type, unlock_method, blaze_coin_cost,
-- sort_order) instead of adding a second catalog table. Extends
-- `equipped_cosmetics` with three new independent slots (card_face,
-- card_back, lane_effect) alongside the existing arena / profile_frame /
-- player_title columns, which are reused as-is. Adds two new
-- SECURITY DEFINER RPCs, `purchase_cosmetic` and `equip_cosmetic`, that
-- read prices and types from the catalog instead of a hardcoded CASE
-- statement. Reuses `player_wallets`, `apply_wallet_delta`,
-- `player_cosmetics`, and `unlock_cosmetic` from 0005 — no wallet or
-- ownership tables are duplicated.
--
-- Does not enable paid purchases, initialize RevenueCat, or change
-- scoring/timer/XP/wallet-reward amounts. Purely additive to existing
-- gameplay and progression systems.

-- ---------------------------------------------------------------------------
-- 1) cosmetic_catalog — add Version 1.1B columns
-- ---------------------------------------------------------------------------
ALTER TABLE public.cosmetic_catalog
  ADD COLUMN IF NOT EXISTS cosmetic_type text,
  ADD COLUMN IF NOT EXISTS unlock_method text,
  ADD COLUMN IF NOT EXISTS blaze_coin_cost integer,
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

-- `category` remains for existing (pre-1.1B) rows and callers
-- (unlock_cosmetic, equip_cosmetic_secure, grant_founders_bundle_benefits).
-- New Version 1.1B rows use `cosmetic_type` as their source of truth and
-- leave `category` NULL — a NULL value always satisfies the existing
-- `cosmetic_catalog_category_check`, so that constraint does not need to be
-- widened.
ALTER TABLE public.cosmetic_catalog
  ALTER COLUMN category DROP NOT NULL;

-- Backfill cosmetic_type for pre-existing rows so every catalog row has a
-- value regardless of when it was created.
UPDATE public.cosmetic_catalog
SET cosmetic_type = category
WHERE cosmetic_type IS NULL
  AND category IS NOT NULL;

UPDATE public.cosmetic_catalog
SET unlock_method = CASE
  WHEN metadata->>'source' = 'level_reward' THEN 'level'
  WHEN metadata->>'source' = 'daily_reward' THEN 'streak'
  ELSE 'free'
END
WHERE unlock_method IS NULL;

-- seven_day_blaze_title already exists (0006) as a daily-streak reward.
-- Re-point its cosmetic_type at the new player_title taxonomy used by
-- equip_cosmetic's slot matching, without touching its legacy `category`
-- (still 'title', still read dynamically by claim_daily_reward_secure).
UPDATE public.cosmetic_catalog
SET
  name = 'Seven Day Blaze',
  cosmetic_type = 'player_title',
  unlock_method = 'streak',
  sort_order = 60
WHERE id = 'seven_day_blaze_title';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'cosmetic_catalog_cosmetic_type_check'
  ) THEN
    ALTER TABLE public.cosmetic_catalog
      ADD CONSTRAINT cosmetic_catalog_cosmetic_type_check CHECK (
        cosmetic_type IS NULL OR cosmetic_type IN (
          'card_theme',
          'card_face',
          'card_back',
          'arena',
          'profile_frame',
          'title',
          'player_title',
          'emote',
          'victory_effect',
          'lane_effect'
        )
      );
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'cosmetic_catalog_unlock_method_check'
  ) THEN
    ALTER TABLE public.cosmetic_catalog
      ADD CONSTRAINT cosmetic_catalog_unlock_method_check CHECK (
        unlock_method IS NULL OR unlock_method IN ('free', 'blaze_coins', 'streak', 'level')
      );
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'cosmetic_catalog_blaze_coin_cost_check'
  ) THEN
    ALTER TABLE public.cosmetic_catalog
      ADD CONSTRAINT cosmetic_catalog_blaze_coin_cost_check CHECK (
        blaze_coin_cost IS NULL OR blaze_coin_cost >= 0
      );
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'cosmetic_catalog_coin_cost_requires_method_check'
  ) THEN
    ALTER TABLE public.cosmetic_catalog
      ADD CONSTRAINT cosmetic_catalog_coin_cost_requires_method_check CHECK (
        (unlock_method = 'blaze_coins') = (blaze_coin_cost IS NOT NULL)
      );
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS cosmetic_catalog_cosmetic_type_idx
  ON public.cosmetic_catalog (cosmetic_type);

CREATE INDEX IF NOT EXISTS cosmetic_catalog_sort_order_idx
  ON public.cosmetic_catalog (sort_order);

-- ---------------------------------------------------------------------------
-- 2) Seed Version 1.1B catalog rows (idempotent upsert, no duplicates)
-- ---------------------------------------------------------------------------
INSERT INTO public.cosmetic_catalog (
  id, name, description, category, cosmetic_type, rarity,
  unlock_method, blaze_coin_cost, is_enabled, sort_order, metadata
)
VALUES
  (
    'classic_card_face', 'Classic Card Face', 'The original 21 Blaze card face.',
    NULL, 'card_face', 'common', 'free', NULL, true, 0,
    '{"source":"free_default"}'::jsonb
  ),
  (
    'classic_card_back', 'Classic Card Back', 'The original 21 Blaze card back.',
    NULL, 'card_back', 'common', 'free', NULL, true, 0,
    '{"source":"free_default"}'::jsonb
  ),
  (
    'classic_arena', 'Classic Arena', 'Standard inferno backdrop.',
    NULL, 'arena', 'common', 'free', NULL, true, 0,
    '{"source":"free_default"}'::jsonb
  ),
  (
    'default_profile_frame', 'Default Frame', 'Simple profile frame.',
    NULL, 'profile_frame', 'common', 'free', NULL, true, 0,
    '{"source":"free_default"}'::jsonb
  ),
  (
    'no_title', 'No Title', 'No player title displayed.',
    NULL, 'player_title', 'common', 'free', NULL, true, 0,
    '{"source":"free_default"}'::jsonb
  ),
  (
    'ember_card_back', 'Ember Card Back',
    'Deep charcoal and ember-red gradient with a thin orange border and a centered flame mark.',
    NULL, 'card_back', 'uncommon', 'blaze_coins', 150, true, 10,
    '{"source":"v1_1b_locker"}'::jsonb
  ),
  (
    'gold_lane_glow', 'Gold Lane Glow',
    'A controlled gold-orange lane border with a small pulse when a card is placed.',
    NULL, 'lane_effect', 'rare', 'blaze_coins', 250, true, 20,
    '{"source":"v1_1b_locker"}'::jsonb
  ),
  (
    'midnight_card_style', 'Midnight Card Style',
    'Near-black card face with warm ivory ranks and bright, high-contrast suit colors.',
    NULL, 'card_face', 'rare', 'blaze_coins', 350, true, 30,
    '{"source":"v1_1b_locker"}'::jsonb
  ),
  (
    'flame_profile_frame', 'Flame Profile Frame',
    'Orange-to-gold profile frame with small flame accents at the top corners.',
    NULL, 'profile_frame', 'epic', 'blaze_coins', 400, true, 40,
    '{"source":"v1_1b_locker"}'::jsonb
  ),
  (
    'lava_arena_tint', 'Lava Arena',
    'Near-black background with a controlled lava glow near the bottom.',
    NULL, 'arena', 'epic', 'blaze_coins', 500, true, 50,
    '{"source":"v1_1b_locker"}'::jsonb
  )
ON CONFLICT (id) DO UPDATE
SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  cosmetic_type = EXCLUDED.cosmetic_type,
  rarity = EXCLUDED.rarity,
  unlock_method = EXCLUDED.unlock_method,
  blaze_coin_cost = EXCLUDED.blaze_coin_cost,
  is_enabled = EXCLUDED.is_enabled,
  sort_order = EXCLUDED.sort_order,
  metadata = public.cosmetic_catalog.metadata || EXCLUDED.metadata;

-- ---------------------------------------------------------------------------
-- 3) Resolve the ember_card_back naming collision with the pre-existing
--    (unreached — progression stays behind a disabled flag) level-5 free
--    reward. Version 1.1B redefines ember_card_back as a 150-coin card
--    back; the level-5 slot no longer grants a cosmetic.
-- ---------------------------------------------------------------------------
UPDATE public.level_reward_catalog
SET cosmetic_id = NULL
WHERE level = 5
  AND cosmetic_id = 'ember_card_back';

-- ---------------------------------------------------------------------------
-- 4) player_cosmetics — widen category CHECK to accept the new taxonomy
-- ---------------------------------------------------------------------------
ALTER TABLE public.player_cosmetics
  DROP CONSTRAINT IF EXISTS player_cosmetics_category_check;

ALTER TABLE public.player_cosmetics
  ADD CONSTRAINT player_cosmetics_category_check CHECK (
    category IN (
      'card_theme',
      'card_face',
      'card_back',
      'arena',
      'profile_frame',
      'title',
      'player_title',
      'emote',
      'victory_effect',
      'lane_effect'
    )
  );

-- ---------------------------------------------------------------------------
-- 5) equipped_cosmetics — add the three new independent slots
-- ---------------------------------------------------------------------------
ALTER TABLE public.equipped_cosmetics
  ADD COLUMN IF NOT EXISTS card_face text NOT NULL DEFAULT 'classic_card_face',
  ADD COLUMN IF NOT EXISTS card_back text NOT NULL DEFAULT 'classic_card_back',
  ADD COLUMN IF NOT EXISTS lane_effect text;

-- Move the shared arena / profile_frame free-default sentinel from the
-- legacy short key ('default') to the new catalog ids so the same physical
-- slot presents consistent ids to both the legacy Store and the new Locker.
UPDATE public.equipped_cosmetics SET arena = 'classic_arena' WHERE arena = 'default';
UPDATE public.equipped_cosmetics SET profile_frame = 'default_profile_frame' WHERE profile_frame = 'default';

ALTER TABLE public.equipped_cosmetics
  ALTER COLUMN arena SET DEFAULT 'classic_arena',
  ALTER COLUMN profile_frame SET DEFAULT 'default_profile_frame';

-- ---------------------------------------------------------------------------
-- 6) purchase_cosmetic — server-authoritative coin purchase (Version 1.1B)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.purchase_cosmetic(
  p_user_id uuid,
  p_cosmetic_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller uuid := auth.uid();
  item public.cosmetic_catalog%ROWTYPE;
  already public.player_cosmetics%ROWTYPE;
  wallet public.player_wallets;
BEGIN
  IF p_user_id IS NULL OR p_cosmetic_id IS NULL OR length(trim(p_cosmetic_id)) = 0 THEN
    RAISE EXCEPTION 'user_id and cosmetic_id are required';
  END IF;

  -- Authenticated callers may only purchase for themselves; service_role
  -- (invoked from the purchase-cosmetic Edge Function after verifying the
  -- caller's JWT) may act on behalf of the validated user.
  IF caller IS NOT NULL AND caller IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'not allowed to purchase cosmetics for another user';
  END IF;

  SELECT * INTO item FROM public.cosmetic_catalog WHERE id = p_cosmetic_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'cosmetic % not found', p_cosmetic_id;
  END IF;

  IF NOT item.is_enabled THEN
    RAISE EXCEPTION 'cosmetic % is not available', p_cosmetic_id;
  END IF;

  -- The server never trusts a client-provided price, discount, or unlock
  -- source — the only price used below is item.blaze_coin_cost, read fresh
  -- from the catalog inside this same transaction.
  IF item.unlock_method IS DISTINCT FROM 'blaze_coins' OR item.blaze_coin_cost IS NULL THEN
    RAISE EXCEPTION 'cosmetic % is not purchasable with blaze coins', p_cosmetic_id;
  END IF;

  PERFORM public.ensure_player_wallet(p_user_id);

  SELECT * INTO already
  FROM public.player_cosmetics
  WHERE user_id = p_user_id
    AND cosmetic_key = p_cosmetic_id;

  IF FOUND THEN
    SELECT * INTO wallet FROM public.player_wallets WHERE user_id = p_user_id;
    RETURN jsonb_build_object(
      'already_owned', true,
      'cosmetic_id', p_cosmetic_id,
      'balance', wallet.blaze_coins,
      'owned', true
    );
  END IF;

  -- apply_wallet_delta locks the wallet row (via ensure_player_wallet
  -- FOR UPDATE), rejects a resulting negative balance, and is idempotent
  -- per (user_id, idempotency_key) — a retried/duplicate request for the
  -- same cosmetic never deducts twice.
  wallet := public.apply_wallet_delta(
    p_user_id,
    -(item.blaze_coin_cost)::bigint,
    'spend',
    'cosmetic_purchase:' || p_cosmetic_id,
    'cosmetic_purchase:' || p_user_id::text || ':' || p_cosmetic_id,
    jsonb_build_object(
      'cosmetic_id', p_cosmetic_id,
      'price', item.blaze_coin_cost,
      'cosmetic_type', item.cosmetic_type
    )
  );

  PERFORM public.unlock_cosmetic(
    p_user_id,
    p_cosmetic_id,
    COALESCE(item.cosmetic_type, item.category, 'card_face'),
    'purchase'
  );

  RETURN jsonb_build_object(
    'already_owned', false,
    'cosmetic_id', p_cosmetic_id,
    'balance', wallet.blaze_coins,
    'owned', true
  );
END;
$$;

-- Only the Edge Function (using the service-role key, after independently
-- verifying the caller's JWT) may invoke this — the client never calls it
-- directly, so a compromised/forged client price can never reach it.
REVOKE ALL ON FUNCTION public.purchase_cosmetic(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.purchase_cosmetic(uuid, text) TO service_role;

COMMENT ON FUNCTION public.purchase_cosmetic(uuid, text) IS
  'Version 1.1B — atomically spends Blaze Coins for a cosmetic_catalog item using the server-side price. Idempotent; wallet balance can never go negative.';

-- ---------------------------------------------------------------------------
-- 7) equip_cosmetic — server-authoritative slot equip (Version 1.1B)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.equip_cosmetic(
  p_user_id uuid,
  p_slot text,
  p_cosmetic_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller uuid := auth.uid();
  item public.cosmetic_catalog%ROWTYPE;
  expected_type text;
  owns boolean := false;
  loadout public.equipped_cosmetics%ROWTYPE;
BEGIN
  IF p_user_id IS NULL
     OR p_slot IS NULL OR length(trim(p_slot)) = 0
     OR p_cosmetic_id IS NULL OR length(trim(p_cosmetic_id)) = 0
  THEN
    RAISE EXCEPTION 'user_id, slot, and cosmetic_id are required';
  END IF;

  IF caller IS NOT NULL AND caller IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'not allowed to equip cosmetics for another user';
  END IF;

  expected_type := CASE p_slot
    WHEN 'cardFaceId' THEN 'card_face'
    WHEN 'cardBackId' THEN 'card_back'
    WHEN 'arenaId' THEN 'arena'
    WHEN 'profileFrameId' THEN 'profile_frame'
    WHEN 'playerTitleId' THEN 'player_title'
    WHEN 'laneEffectId' THEN 'lane_effect'
    ELSE NULL
  END;

  IF expected_type IS NULL THEN
    RAISE EXCEPTION 'invalid equipment slot: %', p_slot;
  END IF;

  SELECT * INTO item FROM public.cosmetic_catalog WHERE id = p_cosmetic_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'cosmetic % not found', p_cosmetic_id;
  END IF;

  IF item.cosmetic_type IS DISTINCT FROM expected_type THEN
    RAISE EXCEPTION 'cosmetic % (%) does not match slot % (%)',
      p_cosmetic_id, item.cosmetic_type, p_slot, expected_type;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.player_cosmetics
    WHERE user_id = p_user_id AND cosmetic_key = p_cosmetic_id
  ) INTO owns;

  IF NOT owns AND item.unlock_method IS DISTINCT FROM 'free' THEN
    RAISE EXCEPTION 'cosmetic % is not owned', p_cosmetic_id;
  END IF;

  PERFORM public.ensure_player_wallet(p_user_id);

  IF NOT owns AND item.unlock_method = 'free' THEN
    PERFORM public.unlock_cosmetic(p_user_id, p_cosmetic_id, expected_type, 'free');
  END IF;

  INSERT INTO public.equipped_cosmetics (user_id)
  VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  UPDATE public.player_cosmetics
  SET equipped_at = now()
  WHERE user_id = p_user_id
    AND cosmetic_key = p_cosmetic_id;

  IF p_slot = 'cardFaceId' THEN
    UPDATE public.equipped_cosmetics SET card_face = p_cosmetic_id, updated_at = now()
    WHERE user_id = p_user_id RETURNING * INTO loadout;
  ELSIF p_slot = 'cardBackId' THEN
    UPDATE public.equipped_cosmetics SET card_back = p_cosmetic_id, updated_at = now()
    WHERE user_id = p_user_id RETURNING * INTO loadout;
  ELSIF p_slot = 'arenaId' THEN
    UPDATE public.equipped_cosmetics SET arena = p_cosmetic_id, updated_at = now()
    WHERE user_id = p_user_id RETURNING * INTO loadout;
  ELSIF p_slot = 'profileFrameId' THEN
    UPDATE public.equipped_cosmetics SET profile_frame = p_cosmetic_id, updated_at = now()
    WHERE user_id = p_user_id RETURNING * INTO loadout;
  ELSIF p_slot = 'playerTitleId' THEN
    UPDATE public.equipped_cosmetics SET player_title = p_cosmetic_id, updated_at = now()
    WHERE user_id = p_user_id RETURNING * INTO loadout;
  ELSIF p_slot = 'laneEffectId' THEN
    UPDATE public.equipped_cosmetics SET lane_effect = p_cosmetic_id, updated_at = now()
    WHERE user_id = p_user_id RETURNING * INTO loadout;
  END IF;

  RETURN jsonb_build_object(
    'cardFaceId', loadout.card_face,
    'cardBackId', loadout.card_back,
    'arenaId', loadout.arena,
    'profileFrameId', loadout.profile_frame,
    'playerTitleId', loadout.player_title,
    'laneEffectId', loadout.lane_effect
  );
END;
$$;

REVOKE ALL ON FUNCTION public.equip_cosmetic(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.equip_cosmetic(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.equip_cosmetic(uuid, text, text) TO service_role;

COMMENT ON FUNCTION public.equip_cosmetic(uuid, text, text) IS
  'Version 1.1B — equips a cosmetic into one of six slots after verifying ownership (or a free default) and that its cosmetic_type matches the slot. Never alters gameplay values.';

-- ---------------------------------------------------------------------------
-- 8) Migrate the pre-existing beta coin cosmetics into the unified catalog
--    so purchase_cosmetic / equip_cosmetic become the single coin-purchase
--    path (existing owners keep ownership — player_cosmetics rows are keyed
--    by cosmetic_key and are untouched by this migration).
-- ---------------------------------------------------------------------------
INSERT INTO public.cosmetic_catalog (
  id, name, description, category, cosmetic_type, rarity,
  unlock_method, blaze_coin_cost, is_enabled, sort_order, metadata
)
VALUES
  (
    'midnight_cards', 'Midnight Cards', 'Unlock with Blaze Coins. Cosmetics only.',
    NULL, 'card_face', 'rare', 'blaze_coins', 3000, true, 31,
    '{"source":"monetization_beta"}'::jsonb
  ),
  (
    'ember_arena', 'Ember Arena', 'Soft ember glow arena. Decorative only.',
    NULL, 'arena', 'rare', 'blaze_coins', 5000, true, 51,
    '{"source":"monetization_beta"}'::jsonb
  ),
  (
    'hot_streak_title', 'Hot Streak', 'Show off your heat with a coin-earned title.',
    NULL, 'player_title', 'rare', 'blaze_coins', 2000, true, 61,
    '{"source":"monetization_beta"}'::jsonb
  )
ON CONFLICT (id) DO UPDATE
SET
  cosmetic_type = EXCLUDED.cosmetic_type,
  unlock_method = EXCLUDED.unlock_method,
  blaze_coin_cost = EXCLUDED.blaze_coin_cost,
  sort_order = EXCLUDED.sort_order,
  metadata = public.cosmetic_catalog.metadata || EXCLUDED.metadata;
