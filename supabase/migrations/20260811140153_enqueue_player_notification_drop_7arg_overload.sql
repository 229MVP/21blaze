-- v1.5 shared staging: remove obsolete 7-arg enqueue_player_notification overload.
-- Phase 2 Live PvP added a 9-arg variant (p_match_id DEFAULT NULL). Both overloads
-- remained callable, causing PostgreSQL ambiguity for 8-argument PERFORM sites.
-- The 9-arg function is a strict superset; async-duel callers omit p_match_id.

DROP FUNCTION IF EXISTS public.enqueue_player_notification(
  uuid, text, uuid, text, text, jsonb, jsonb, boolean
);

REVOKE ALL ON FUNCTION public.enqueue_player_notification(
  uuid, text, uuid, text, text, jsonb, jsonb, boolean, uuid
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.enqueue_player_notification(
  uuid, text, uuid, text, text, jsonb, jsonb, boolean, uuid
) TO service_role;

COMMENT ON FUNCTION public.enqueue_player_notification(
  uuid, text, uuid, text, text, jsonb, jsonb, boolean, uuid
) IS
  'Server-only notification enqueue (async duel + Live PvP). Single 9-arg overload after v1.5 overload cleanup.';
