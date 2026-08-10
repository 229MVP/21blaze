-- Version 1.4 Phase 2 — Async Duel player discovery + active list RPCs
-- No table writes from clients; SECURITY DEFINER reads only.

CREATE OR REPLACE FUNCTION public.search_async_duel_opponents(
  p_query text,
  p_limit integer DEFAULT 20,
  p_offset integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  safe_limit integer := LEAST(GREATEST(COALESCE(p_limit, 20), 1), 30);
  safe_offset integer := GREATEST(COALESCE(p_offset, 0), 0);
  q text := lower(trim(COALESCE(p_query, '')));
  items jsonb;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF length(q) < 2 THEN
    RETURN jsonb_build_object('items', '[]'::jsonb, 'limit', safe_limit, 'offset', safe_offset);
  END IF;

  -- Escape LIKE metacharacters in user query.
  q := replace(replace(replace(q, '\', '\\'), '%', '\%'), '_', '\_');

  SELECT COALESCE(jsonb_agg(row_to_json(x)::jsonb ORDER BY x."displayName"), '[]'::jsonb)
  INTO items
  FROM (
    SELECT
      p.id AS "userId",
      COALESCE(p.display_name::text, 'Blaze Player') AS "displayName",
      ec.profile_frame AS "profileFrameId",
      COALESCE(pp.level, 1) AS "level",
      true AS "eligible"
    FROM public.profiles p
    LEFT JOIN public.equipped_cosmetics ec ON ec.user_id = p.id
    LEFT JOIN public.player_progression pp ON pp.user_id = p.id
    WHERE p.id <> v_user
      AND p.display_name IS NOT NULL
      AND lower(p.display_name::text) LIKE '%' || q || '%' ESCAPE '\'
    ORDER BY p.display_name ASC
    LIMIT safe_limit
    OFFSET safe_offset
  ) x;

  RETURN jsonb_build_object(
    'items', items,
    'limit', safe_limit,
    'offset', safe_offset
  );
END;
$$;

REVOKE ALL ON FUNCTION public.search_async_duel_opponents(text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_async_duel_opponents(text, integer, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_async_duel_active(
  p_limit integer DEFAULT 20,
  p_offset integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  safe_limit integer := LEAST(GREATEST(COALESCE(p_limit, 20), 1), 50);
  safe_offset integer := GREATEST(COALESCE(p_offset, 0), 0);
  items jsonb;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  PERFORM public.expire_async_duels(now());

  SELECT COALESCE(jsonb_agg(row_to_json(x)::jsonb ORDER BY x."updatedAt" DESC), '[]'::jsonb)
  INTO items
  FROM (
    SELECT
      d.id AS "duelId",
      d.status,
      CASE
        WHEN d.challenger_id = v_user THEN 'challenger'
        ELSE 'opponent'
      END AS "participantRole",
      CASE
        WHEN d.challenger_id = v_user THEN public.async_duel_public_participant(d.opponent_id)
        ELSE public.async_duel_public_participant(d.challenger_id)
      END AS opponent,
      ca.score AS "challengerScore",
      oa.score AS "opponentScore",
      ca.status AS "challengerAttemptStatus",
      oa.status AS "opponentAttemptStatus",
      d.expires_at AS "expiresAt",
      d.created_at AS "createdAt",
      d.updated_at AS "updatedAt",
      d.target_score_visibility AS "targetScoreVisibility"
    FROM public.async_duels d
    LEFT JOIN public.async_duel_attempts ca
      ON ca.duel_id = d.id AND ca.participant_role = 'challenger'
    LEFT JOIN public.async_duel_attempts oa
      ON oa.duel_id = d.id AND oa.participant_role = 'opponent'
    WHERE (d.challenger_id = v_user OR d.opponent_id = v_user)
      AND d.status IN ('challenger_playing', 'awaiting_opponent', 'opponent_playing')
    ORDER BY d.updated_at DESC
    LIMIT safe_limit
    OFFSET safe_offset
  ) x;

  RETURN jsonb_build_object('items', items, 'limit', safe_limit, 'offset', safe_offset);
END;
$$;

REVOKE ALL ON FUNCTION public.get_async_duel_active(integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_async_duel_active(integer, integer) TO authenticated;

COMMENT ON FUNCTION public.search_async_duel_opponents IS
  'Bounded display-name search for Async Duel opponents. Excludes caller. Public fields only.';
COMMENT ON FUNCTION public.get_async_duel_active IS
  'Participant-safe active Async Duels (no seed).';
