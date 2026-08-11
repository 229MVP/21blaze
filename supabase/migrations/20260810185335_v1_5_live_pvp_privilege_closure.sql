-- v1.5 release freeze — Live PvP privileged function closure
-- Forward-only. Closes client execution on internal SECURITY DEFINER helpers.

-- ---------------------------------------------------------------------------
-- Client-callable Live PvP RPC allowlist (authenticated only)
-- ---------------------------------------------------------------------------
-- get_live_pvp_ops_status()
-- get_live_pvp_hub(text, integer, integer)
-- create_live_pvp_invite(uuid)
-- accept_live_pvp_match(uuid)
-- decline_live_pvp_match(uuid)
-- cancel_live_pvp_match(uuid)
-- set_live_pvp_ready(uuid)
-- get_live_pvp_snapshot(uuid)
-- get_live_pvp_server_time()
-- submit_live_pvp_progress(uuid, bigint, integer, integer, integer, integer, integer, integer, integer)
-- complete_live_pvp_attempt(uuid, integer, integer, integer, integer, integer, integer, integer, text, text, text)
-- forfeit_live_pvp_match(uuid)
-- create_live_pvp_rematch(uuid)
-- get_live_pvp_player_record()
-- get_live_pvp_head_to_head_record(uuid)
-- is_live_pvp_participant(text) — Realtime RLS helper (authenticated + service_role)

-- ---------------------------------------------------------------------------
-- Internal / worker-only (service_role or trigger; never authenticated)
-- ---------------------------------------------------------------------------

REVOKE ALL ON FUNCTION public.live_pvp_config() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.live_pvp_config() TO service_role;

REVOKE ALL ON FUNCTION public.live_pvp_creation_enabled() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.live_pvp_creation_enabled() TO service_role;

REVOKE ALL ON FUNCTION public.assert_live_pvp_transition(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assert_live_pvp_transition(text, text) TO service_role;

REVOKE ALL ON FUNCTION public.live_pvp_record_and_broadcast(
  public.live_pvp_matches, text, jsonb
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.live_pvp_record_and_broadcast(
  public.live_pvp_matches, text, jsonb
) TO service_role;

REVOKE ALL ON FUNCTION public.live_pvp_public_participant(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.live_pvp_public_participant(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.live_pvp_try_schedule_countdown(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.live_pvp_try_schedule_countdown(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.ensure_live_pvp_active(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_live_pvp_active(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.live_pvp_settle_match(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.live_pvp_settle_match(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.finalize_live_pvp_deadlines(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_live_pvp_deadlines(integer) TO service_role;

REVOKE ALL ON FUNCTION public.reconcile_live_pvp_active_slots(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reconcile_live_pvp_active_slots(integer) TO service_role;

-- Trigger helpers (no direct EXECUTE grants)
REVOKE ALL ON FUNCTION public.live_pvp_enforce_participant_identity() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.live_pvp_enforce_attempt_identity() FROM PUBLIC, anon, authenticated;

-- Realtime participant check — required for private channel RLS policies
REVOKE ALL ON FUNCTION public.is_live_pvp_participant(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_live_pvp_participant(text) TO authenticated, service_role;

-- Notification enqueue overloads — internal only (SECURITY DEFINER from Phase 2 lacked explicit REVOKE)
REVOKE ALL ON FUNCTION public.enqueue_player_notification(
  uuid, text, uuid, text, text, jsonb, jsonb, boolean
) FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.enqueue_player_notification(
  uuid, text, uuid, text, text, jsonb, jsonb, boolean, uuid
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.enqueue_player_notification(
  uuid, text, uuid, text, text, jsonb, jsonb, boolean
) TO service_role;

GRANT EXECUTE ON FUNCTION public.enqueue_player_notification(
  uuid, text, uuid, text, text, jsonb, jsonb, boolean, uuid
) TO service_role;

-- Belt-and-suspenders: client RPCs explicit (Phase 3 may have already set these)
REVOKE ALL ON FUNCTION public.create_live_pvp_invite(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_live_pvp_invite(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.accept_live_pvp_match(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_live_pvp_match(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.decline_live_pvp_match(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.decline_live_pvp_match(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.cancel_live_pvp_match(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_live_pvp_match(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.set_live_pvp_ready(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_live_pvp_ready(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.get_live_pvp_snapshot(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_live_pvp_snapshot(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.get_live_pvp_server_time() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_live_pvp_server_time() TO authenticated;

REVOKE ALL ON FUNCTION public.submit_live_pvp_progress(
  uuid, bigint, integer, integer, integer, integer, integer, integer, integer
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_live_pvp_progress(
  uuid, bigint, integer, integer, integer, integer, integer, integer, integer
) TO authenticated;

REVOKE ALL ON FUNCTION public.complete_live_pvp_attempt(
  uuid, integer, integer, integer, integer, integer, integer, integer, text, text, text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_live_pvp_attempt(
  uuid, integer, integer, integer, integer, integer, integer, integer, text, text, text
) TO authenticated;

REVOKE ALL ON FUNCTION public.forfeit_live_pvp_match(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.forfeit_live_pvp_match(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.get_live_pvp_ops_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_live_pvp_ops_status() TO authenticated;

REVOKE ALL ON FUNCTION public.get_live_pvp_hub(text, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_live_pvp_hub(text, integer, integer) TO authenticated;

REVOKE ALL ON FUNCTION public.create_live_pvp_rematch(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_live_pvp_rematch(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.get_live_pvp_player_record() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_live_pvp_player_record() TO authenticated;

REVOKE ALL ON FUNCTION public.get_live_pvp_head_to_head_record(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_live_pvp_head_to_head_record(uuid) TO authenticated;

COMMENT ON FUNCTION public.enqueue_player_notification(
  uuid, text, uuid, text, text, jsonb, jsonb, boolean, uuid
) IS 'Internal notification enqueue — service_role only; not client-callable.';

-- ---------------------------------------------------------------------------
-- Privilege assertions (fail migration if grants are wrong)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF has_function_privilege('authenticated', 'public.live_pvp_config()', 'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated must not execute live_pvp_config';
  END IF;
  IF has_function_privilege('anon', 'public.live_pvp_config()', 'EXECUTE') THEN
    RAISE EXCEPTION 'anon must not execute live_pvp_config';
  END IF;
  IF NOT has_function_privilege('service_role', 'public.live_pvp_config()', 'EXECUTE') THEN
    RAISE EXCEPTION 'service_role must execute live_pvp_config';
  END IF;

  IF has_function_privilege('authenticated', 'public.finalize_live_pvp_deadlines(integer)', 'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated must not execute finalize_live_pvp_deadlines';
  END IF;
  IF NOT has_function_privilege('service_role', 'public.finalize_live_pvp_deadlines(integer)', 'EXECUTE') THEN
    RAISE EXCEPTION 'service_role must execute finalize_live_pvp_deadlines';
  END IF;

  IF has_function_privilege('authenticated', 'public.enqueue_player_notification(uuid, text, uuid, text, text, jsonb, jsonb, boolean)', 'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated must not execute enqueue_player_notification (7-arg)';
  END IF;
  IF has_function_privilege('authenticated', 'public.enqueue_player_notification(uuid, text, uuid, text, text, jsonb, jsonb, boolean, uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated must not execute enqueue_player_notification (9-arg)';
  END IF;
  IF NOT has_function_privilege('service_role', 'public.enqueue_player_notification(uuid, text, uuid, text, text, jsonb, jsonb, boolean, uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'service_role must execute enqueue_player_notification (9-arg)';
  END IF;

  IF NOT has_function_privilege('authenticated', 'public.is_live_pvp_participant(text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated must execute is_live_pvp_participant for Realtime RLS';
  END IF;
  IF has_function_privilege('anon', 'public.is_live_pvp_participant(text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'anon must not execute is_live_pvp_participant';
  END IF;

  IF NOT has_function_privilege('authenticated', 'public.get_live_pvp_snapshot(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated must execute get_live_pvp_snapshot';
  END IF;
  IF has_function_privilege('anon', 'public.get_live_pvp_snapshot(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'anon must not execute get_live_pvp_snapshot';
  END IF;

  IF has_function_privilege('authenticated', 'public.live_pvp_settle_match(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated must not execute live_pvp_settle_match';
  END IF;
END $$;
