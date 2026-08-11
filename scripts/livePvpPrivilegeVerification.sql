-- Live PvP privilege verification queries (v1.5 exit gate)
-- Run against replayed database; outputs rows for each check.

SELECT 'anon_live_pvp_config' AS check,
  has_function_privilege('anon', 'public.live_pvp_config()', 'EXECUTE') AS actual,
  false AS expected;

SELECT 'anon_finalize_deadlines' AS check,
  has_function_privilege('anon', 'public.finalize_live_pvp_deadlines(integer)', 'EXECUTE') AS actual,
  false AS expected;

SELECT 'anon_get_snapshot' AS check,
  has_function_privilege('anon', 'public.get_live_pvp_snapshot(uuid)', 'EXECUTE') AS actual,
  false AS expected;

SELECT 'anon_enqueue_9' AS check,
  has_function_privilege(
    'anon',
    'public.enqueue_player_notification(uuid, text, uuid, text, text, jsonb, jsonb, boolean, uuid)',
    'EXECUTE'
  ) AS actual,
  false AS expected;

SELECT 'authenticated_finalize' AS check,
  has_function_privilege('authenticated', 'public.finalize_live_pvp_deadlines(integer)', 'EXECUTE') AS actual,
  false AS expected;

SELECT 'authenticated_settle' AS check,
  has_function_privilege('authenticated', 'public.live_pvp_settle_match(uuid)', 'EXECUTE') AS actual,
  false AS expected;

SELECT 'authenticated_enqueue_9' AS check,
  has_function_privilege(
    'authenticated',
    'public.enqueue_player_notification(uuid, text, uuid, text, text, jsonb, jsonb, boolean, uuid)',
    'EXECUTE'
  ) AS actual,
  false AS expected;

SELECT 'authenticated_get_snapshot' AS check,
  has_function_privilege('authenticated', 'public.get_live_pvp_snapshot(uuid)', 'EXECUTE') AS actual,
  true AS expected;

SELECT 'authenticated_is_participant' AS check,
  has_function_privilege('authenticated', 'public.is_live_pvp_participant(text)', 'EXECUTE') AS actual,
  true AS expected;

SELECT 'service_role_finalize' AS check,
  has_function_privilege('service_role', 'public.finalize_live_pvp_deadlines(integer)', 'EXECUTE') AS actual,
  true AS expected;

SELECT 'service_role_config' AS check,
  has_function_privilege('service_role', 'public.live_pvp_config()', 'EXECUTE') AS actual,
  true AS expected;

SELECT 'service_role_enqueue_9' AS check,
  has_function_privilege(
    'service_role',
    'public.enqueue_player_notification(uuid, text, uuid, text, text, jsonb, jsonb, boolean, uuid)',
    'EXECUTE'
  ) AS actual,
  true AS expected;

-- RLS enabled on live_pvp tables
SELECT 'rls_live_pvp_matches' AS check,
  c.relrowsecurity AS actual,
  true AS expected
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname = 'live_pvp_matches';

SELECT 'ext_pgcrypto' AS check,
  EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pgcrypto') AS actual,
  true AS expected;
