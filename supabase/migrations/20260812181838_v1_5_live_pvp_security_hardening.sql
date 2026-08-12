-- Version 1.5.1 Live PvP security hardening.
--
-- The transition validator is an internal immutable helper. Pinning its
-- search_path removes the mutable-path advisor finding without changing its
-- behavior or widening client privileges.

ALTER FUNCTION public.assert_live_pvp_transition(text, text)
  SET search_path = pg_catalog, public;

REVOKE ALL ON FUNCTION public.assert_live_pvp_transition(text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assert_live_pvp_transition(text, text)
  TO service_role;
