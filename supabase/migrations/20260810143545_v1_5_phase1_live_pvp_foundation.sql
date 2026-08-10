-- Version 1.5 Phase 1 — Live PvP Realtime backend & protocol foundation
-- Uses live_pvp_* tables to avoid colliding with legacy live_matches (friend/quick/ranked beta).
-- Private Realtime topic: live-pvp:{matchId}
-- Clients cannot INSERT broadcast; Presence-only client writes; server emits via realtime.send.

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- ---------------------------------------------------------------------------
-- Configuration registry
-- ---------------------------------------------------------------------------
INSERT INTO public.app_configuration (key, value)
VALUES
  (
    'live_pvp_config',
    jsonb_build_object(
      'enabled', true,
      'protocolVersion', '1',
      'rulesVersion', '1',
      'deckVersion', '1',
      'durationSeconds', 120,
      'bustLimit', 3,
      'invitationLifetimeSeconds', 300,
      'lobbyLifetimeSeconds', 300,
      'readyTimeoutSeconds', 120,
      'countdownLeadSeconds', 5,
      'completionGraceSeconds', 15,
      'progressMinimumIntervalMs', 1000,
      'progressMaximumSilenceSeconds', 45,
      'maximumActiveMatchesPerPlayer', 1,
      'maximumPendingInvitesPerPlayer', 3,
      'maximumPendingInvitesBetweenPlayers', 1,
      'presenceEnabled', true,
      'liveProgressEnabled', true
    )
  ),
  ('live_pvp_creation_enabled', 'true'::jsonb)
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.live_pvp_config()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT value FROM public.app_configuration WHERE key = 'live_pvp_config'),
    '{}'::jsonb
  );
$$;

CREATE OR REPLACE FUNCTION public.live_pvp_creation_enabled()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT (value = 'true'::jsonb OR value = to_jsonb(true))
      FROM public.app_configuration
      WHERE key = 'live_pvp_creation_enabled'
    ),
    true
  )
  AND COALESCE((public.live_pvp_config()->>'enabled')::boolean, true);
$$;

REVOKE ALL ON FUNCTION public.live_pvp_config() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.live_pvp_creation_enabled() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.live_pvp_config() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.live_pvp_creation_enabled() TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.live_pvp_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenger_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  opponent_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  realtime_topic text NOT NULL,
  status text NOT NULL,
  protocol_version text NOT NULL,
  rules_version text,
  deck_version text,
  seed text,
  duration_seconds integer,
  bust_limit integer,
  state_version bigint NOT NULL DEFAULT 0,
  scheduled_start_at timestamptz,
  gameplay_deadline_at timestamptz,
  submission_grace_until timestamptz,
  expires_at timestamptz NOT NULL,
  winner_user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  outcome text,
  deciding_field text,
  completion_reason text,
  accepted_at timestamptz,
  countdown_started_at timestamptz,
  completed_at timestamptz,
  settled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT live_pvp_matches_participants_distinct CHECK (challenger_id <> opponent_id),
  CONSTRAINT live_pvp_matches_topic_format CHECK (realtime_topic ~ '^live-pvp:[0-9a-f-]{36}$'),
  CONSTRAINT live_pvp_matches_status_check CHECK (
    status IN (
      'invited', 'lobby', 'countdown', 'active', 'settling',
      'completed', 'declined', 'cancelled', 'expired', 'invalid'
    )
  ),
  CONSTRAINT live_pvp_matches_outcome_check CHECK (
    outcome IS NULL OR outcome IN ('challenger_win', 'opponent_win', 'tie', 'no_contest')
  ),
  CONSTRAINT live_pvp_matches_completion_reason_check CHECK (
    completion_reason IS NULL
    OR completion_reason IN ('normal', 'forfeit', 'timeout', 'invalid')
  ),
  CONSTRAINT live_pvp_matches_winner_participant_check CHECK (
    winner_user_id IS NULL
    OR winner_user_id = challenger_id
    OR winner_user_id = opponent_id
  ),
  CONSTRAINT live_pvp_matches_duration_check CHECK (
    duration_seconds IS NULL OR (duration_seconds > 0 AND duration_seconds <= 600)
  ),
  CONSTRAINT live_pvp_matches_bust_check CHECK (
    bust_limit IS NULL OR (bust_limit >= 0 AND bust_limit <= 20)
  ),
  CONSTRAINT live_pvp_matches_seed_phase_check CHECK (
    (status IN ('invited', 'lobby', 'declined', 'cancelled', 'expired') AND seed IS NULL)
    OR (status IN ('countdown', 'active', 'settling', 'completed', 'invalid'))
  ),
  CONSTRAINT live_pvp_matches_deadline_order_check CHECK (
    gameplay_deadline_at IS NULL
    OR scheduled_start_at IS NULL
    OR gameplay_deadline_at >= scheduled_start_at
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS live_pvp_matches_realtime_topic_uidx
  ON public.live_pvp_matches (realtime_topic);
CREATE INDEX IF NOT EXISTS live_pvp_matches_challenger_status_idx
  ON public.live_pvp_matches (challenger_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS live_pvp_matches_opponent_status_idx
  ON public.live_pvp_matches (opponent_id, status, expires_at);
CREATE INDEX IF NOT EXISTS live_pvp_matches_expires_active_idx
  ON public.live_pvp_matches (expires_at)
  WHERE status IN ('invited', 'lobby', 'countdown', 'active', 'settling');
CREATE INDEX IF NOT EXISTS live_pvp_matches_deadline_finalizer_idx
  ON public.live_pvp_matches (submission_grace_until, status)
  WHERE status IN ('countdown', 'active', 'settling');
CREATE INDEX IF NOT EXISTS live_pvp_matches_pair_pending_idx
  ON public.live_pvp_matches (challenger_id, opponent_id, status);

CREATE TABLE IF NOT EXISTS public.live_pvp_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES public.live_pvp_matches (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  participant_role text NOT NULL,
  active_slot boolean NOT NULL DEFAULT false,
  joined_at timestamptz,
  ready_at timestamptz,
  last_progress_at timestamptz,
  finished_at timestamptz,
  forfeited_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT live_pvp_participants_role_check CHECK (participant_role IN ('challenger', 'opponent')),
  CONSTRAINT live_pvp_participants_match_user_unique UNIQUE (match_id, user_id),
  CONSTRAINT live_pvp_participants_match_role_unique UNIQUE (match_id, participant_role)
);

CREATE INDEX IF NOT EXISTS live_pvp_participants_user_active_idx
  ON public.live_pvp_participants (user_id)
  WHERE active_slot = true;
CREATE INDEX IF NOT EXISTS live_pvp_participants_match_user_idx
  ON public.live_pvp_participants (match_id, user_id);
CREATE INDEX IF NOT EXISTS live_pvp_participants_user_match_idx
  ON public.live_pvp_participants (user_id, match_id);

-- Exactly one active live PvP match slot per player when limited to 1.
CREATE UNIQUE INDEX IF NOT EXISTS live_pvp_participants_one_active_slot_uidx
  ON public.live_pvp_participants (user_id)
  WHERE active_slot = true;

CREATE TABLE IF NOT EXISTS public.live_pvp_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES public.live_pvp_matches (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  participant_role text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  started_at timestamptz,
  completed_at timestamptz,
  score integer,
  exact_21_count integer,
  five_card_clear_count integer,
  bust_count integer,
  cards_played integer,
  lanes_cleared integer,
  completion_ms integer,
  rules_version text,
  deck_version text,
  submission_version text,
  result_hash text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT live_pvp_attempts_role_check CHECK (participant_role IN ('challenger', 'opponent')),
  CONSTRAINT live_pvp_attempts_status_check CHECK (
    status IN ('pending', 'active', 'completed', 'forfeited', 'timed_out', 'invalid')
  ),
  CONSTRAINT live_pvp_attempts_match_user_unique UNIQUE (match_id, user_id),
  CONSTRAINT live_pvp_attempts_match_role_unique UNIQUE (match_id, participant_role),
  CONSTRAINT live_pvp_attempts_nonneg_check CHECK (
    COALESCE(score, 0) >= 0
    AND COALESCE(exact_21_count, 0) >= 0
    AND COALESCE(five_card_clear_count, 0) >= 0
    AND COALESCE(bust_count, 0) >= 0
    AND COALESCE(cards_played, 0) >= 0
    AND COALESCE(lanes_cleared, 0) >= 0
    AND COALESCE(completion_ms, 0) >= 0
  )
);

CREATE INDEX IF NOT EXISTS live_pvp_attempts_user_status_idx
  ON public.live_pvp_attempts (user_id, status);
CREATE INDEX IF NOT EXISTS live_pvp_attempts_match_idx
  ON public.live_pvp_attempts (match_id);

CREATE TABLE IF NOT EXISTS public.live_pvp_progress (
  match_id uuid NOT NULL REFERENCES public.live_pvp_matches (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  sequence bigint NOT NULL,
  score integer NOT NULL DEFAULT 0,
  exact_21_count integer NOT NULL DEFAULT 0,
  five_card_clear_count integer NOT NULL DEFAULT 0,
  bust_count integer NOT NULL DEFAULT 0,
  cards_played integer NOT NULL DEFAULT 0,
  lanes_cleared integer NOT NULL DEFAULT 0,
  client_elapsed_ms integer NOT NULL DEFAULT 0,
  server_received_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (match_id, user_id),
  CONSTRAINT live_pvp_progress_sequence_positive CHECK (sequence > 0),
  CONSTRAINT live_pvp_progress_nonneg_check CHECK (
    score >= 0 AND exact_21_count >= 0 AND five_card_clear_count >= 0
    AND bust_count >= 0 AND cards_played >= 0 AND lanes_cleared >= 0
    AND client_elapsed_ms >= 0 AND cards_played <= 52 AND lanes_cleared <= 20
  )
);

CREATE TABLE IF NOT EXISTS public.live_pvp_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES public.live_pvp_matches (id) ON DELETE CASCADE,
  state_version bigint NOT NULL,
  event_type text NOT NULL,
  server_occurred_at timestamptz NOT NULL DEFAULT now(),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT live_pvp_events_type_check CHECK (
    event_type IN (
      'invite_created', 'invite_accepted', 'participant_joined', 'participant_ready',
      'countdown_scheduled', 'match_active', 'participant_finished', 'participant_forfeited',
      'participant_timed_out', 'match_settled', 'match_cancelled', 'match_expired',
      'match_invalidated', 'progress_accepted'
    )
  )
);

CREATE INDEX IF NOT EXISTS live_pvp_events_match_version_idx
  ON public.live_pvp_events (match_id, state_version DESC, created_at DESC);

-- Identity alignment: participant role must match parent challenger/opponent
CREATE OR REPLACE FUNCTION public.live_pvp_enforce_participant_identity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  m public.live_pvp_matches%ROWTYPE;
BEGIN
  SELECT * INTO m FROM public.live_pvp_matches WHERE id = NEW.match_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'MATCH_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;
  IF NEW.participant_role = 'challenger' AND NEW.user_id IS DISTINCT FROM m.challenger_id THEN
    RAISE EXCEPTION 'NOT_PARTICIPANT' USING ERRCODE = 'P0001';
  END IF;
  IF NEW.participant_role = 'opponent' AND NEW.user_id IS DISTINCT FROM m.opponent_id THEN
    RAISE EXCEPTION 'NOT_PARTICIPANT' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS live_pvp_participants_identity_trg ON public.live_pvp_participants;
CREATE TRIGGER live_pvp_participants_identity_trg
  BEFORE INSERT OR UPDATE OF user_id, participant_role, match_id
  ON public.live_pvp_participants
  FOR EACH ROW EXECUTE FUNCTION public.live_pvp_enforce_participant_identity();

CREATE OR REPLACE FUNCTION public.live_pvp_enforce_attempt_identity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p public.live_pvp_participants%ROWTYPE;
  m public.live_pvp_matches%ROWTYPE;
BEGIN
  SELECT * INTO m FROM public.live_pvp_matches WHERE id = NEW.match_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'MATCH_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;
  SELECT * INTO p FROM public.live_pvp_participants
  WHERE match_id = NEW.match_id AND user_id = NEW.user_id;
  IF NOT FOUND OR p.participant_role IS DISTINCT FROM NEW.participant_role THEN
    RAISE EXCEPTION 'NOT_PARTICIPANT' USING ERRCODE = 'P0001';
  END IF;
  IF NEW.rules_version IS NOT NULL AND m.rules_version IS NOT NULL
     AND NEW.rules_version IS DISTINCT FROM m.rules_version THEN
    RAISE EXCEPTION 'INVALID_RESULT' USING ERRCODE = 'P0001';
  END IF;
  IF NEW.deck_version IS NOT NULL AND m.deck_version IS NOT NULL
     AND NEW.deck_version IS DISTINCT FROM m.deck_version THEN
    RAISE EXCEPTION 'INVALID_RESULT' USING ERRCODE = 'P0001';
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'completed' AND (
    NEW.score IS DISTINCT FROM OLD.score
    OR NEW.exact_21_count IS DISTINCT FROM OLD.exact_21_count
    OR NEW.five_card_clear_count IS DISTINCT FROM OLD.five_card_clear_count
    OR NEW.bust_count IS DISTINCT FROM OLD.bust_count
    OR NEW.completion_ms IS DISTINCT FROM OLD.completion_ms
    OR NEW.status IS DISTINCT FROM OLD.status
  ) THEN
    RAISE EXCEPTION 'ATTEMPT_ALREADY_COMPLETED' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS live_pvp_attempts_identity_trg ON public.live_pvp_attempts;
CREATE TRIGGER live_pvp_attempts_identity_trg
  BEFORE INSERT OR UPDATE
  ON public.live_pvp_attempts
  FOR EACH ROW EXECUTE FUNCTION public.live_pvp_enforce_attempt_identity();

-- ---------------------------------------------------------------------------
-- State machine
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.assert_live_pvp_transition(p_from text, p_to text)
RETURNS void
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF p_from = p_to THEN
    RETURN;
  END IF;
  IF (p_from = 'invited' AND p_to IN ('lobby', 'declined', 'cancelled', 'expired', 'invalid'))
     OR (p_from = 'lobby' AND p_to IN ('countdown', 'cancelled', 'expired', 'invalid'))
     OR (p_from = 'countdown' AND p_to IN ('active', 'settling', 'invalid'))
     OR (p_from = 'active' AND p_to IN ('settling', 'invalid'))
     OR (p_from = 'settling' AND p_to IN ('completed', 'invalid'))
     OR (p_from IN ('completed', 'declined', 'cancelled', 'expired', 'invalid') AND FALSE)
  THEN
    RETURN;
  END IF;
  RAISE EXCEPTION 'INVALID_MATCH_STATE'
    USING ERRCODE = 'P0001', DETAIL = format('illegal transition %s -> %s', p_from, p_to);
END;
$$;

-- ---------------------------------------------------------------------------
-- Membership / Realtime auth helper
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_live_pvp_participant(p_topic text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.live_pvp_matches m
    JOIN public.live_pvp_participants p ON p.match_id = m.id
    WHERE m.realtime_topic = p_topic
      AND p.user_id = (SELECT auth.uid())
  );
$$;

REVOKE ALL ON FUNCTION public.is_live_pvp_participant(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_live_pvp_participant(text) TO authenticated, service_role;

-- Realtime authorization: receive broadcast+presence; publish presence ONLY (no client broadcast)
DROP POLICY IF EXISTS "live_pvp_realtime_select" ON realtime.messages;
CREATE POLICY "live_pvp_realtime_select"
  ON realtime.messages
  FOR SELECT
  TO authenticated
  USING (
    public.is_live_pvp_participant((SELECT realtime.topic()))
    AND realtime.messages.extension IN ('broadcast', 'presence')
  );

DROP POLICY IF EXISTS "live_pvp_realtime_presence_insert" ON realtime.messages;
CREATE POLICY "live_pvp_realtime_presence_insert"
  ON realtime.messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_live_pvp_participant((SELECT realtime.topic()))
    AND realtime.messages.extension = 'presence'
  );

-- ---------------------------------------------------------------------------
-- Event + broadcast helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.live_pvp_record_and_broadcast(
  p_match public.live_pvp_matches,
  p_event_type text,
  p_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  eid uuid;
  envelope jsonb;
  broadcast_name text;
BEGIN
  INSERT INTO public.live_pvp_events (match_id, state_version, event_type, payload)
  VALUES (p_match.id, p_match.state_version, p_event_type, COALESCE(p_payload, '{}'::jsonb))
  RETURNING id INTO eid;

  broadcast_name := CASE p_event_type
    WHEN 'invite_accepted' THEN 'PARTICIPANT_JOINED'
    WHEN 'participant_ready' THEN 'PARTICIPANT_READY'
    WHEN 'countdown_scheduled' THEN 'COUNTDOWN_SCHEDULED'
    WHEN 'match_active' THEN 'MATCH_ACTIVE'
    WHEN 'progress_accepted' THEN 'PROGRESS_ACCEPTED'
    WHEN 'participant_finished' THEN 'PARTICIPANT_FINISHED'
    WHEN 'participant_forfeited' THEN 'PARTICIPANT_FORFEITED'
    WHEN 'participant_timed_out' THEN 'PARTICIPANT_TIMED_OUT'
    WHEN 'match_settled' THEN 'MATCH_SETTLED'
    WHEN 'match_cancelled' THEN 'MATCH_CANCELLED'
    WHEN 'match_expired' THEN 'MATCH_EXPIRED'
    WHEN 'match_invalidated' THEN 'MATCH_INVALIDATED'
    ELSE 'MATCH_SNAPSHOT_CHANGED'
  END;

  envelope := jsonb_build_object(
    'protocolVersion', p_match.protocol_version,
    'eventId', eid,
    'matchId', p_match.id,
    'stateVersion', p_match.state_version,
    'eventType', broadcast_name,
    'serverOccurredAt', now(),
    'payload', COALESCE(p_payload, '{}'::jsonb)
  );

  -- Private broadcast; clients subscribe with config.private = true
  PERFORM realtime.send(envelope, broadcast_name, p_match.realtime_topic, true);

  RETURN eid;
EXCEPTION
  WHEN undefined_function THEN
    -- Environments without realtime.send still persist the durable event.
    RETURN eid;
END;
$$;

CREATE OR REPLACE FUNCTION public.live_pvp_public_participant(p_user_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'userId', p.id,
    'displayName', COALESCE(p.display_name::text, 'Blaze Player'),
    'profileFrameId', ec.profile_frame
  )
  FROM public.profiles p
  LEFT JOIN public.equipped_cosmetics ec ON ec.user_id = p.id
  WHERE p.id = p_user_id;
$$;

-- ---------------------------------------------------------------------------
-- RLS: enable, revoke direct writes
-- ---------------------------------------------------------------------------
ALTER TABLE public.live_pvp_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_pvp_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_pvp_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_pvp_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_pvp_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.live_pvp_matches FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.live_pvp_participants FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.live_pvp_attempts FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.live_pvp_progress FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.live_pvp_events FROM PUBLIC, anon, authenticated;

-- No client policies for SELECT/INSERT/UPDATE — RPC-only access.


-- ---------------------------------------------------------------------------
-- Create invite
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_live_pvp_invite(p_opponent_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  cfg jsonb;
  invite_seconds integer;
  pending_count integer;
  pair_count integer;
  match public.live_pvp_matches%ROWTYPE;
  topic text;
  new_id uuid;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF NOT public.live_pvp_creation_enabled() THEN
    RAISE EXCEPTION 'LIVE_PVP_DISABLED' USING ERRCODE = 'P0001';
  END IF;
  IF p_opponent_id IS NULL OR p_opponent_id = v_user THEN
    RAISE EXCEPTION 'SELF_INVITE' USING ERRCODE = 'P0001';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_opponent_id) THEN
    RAISE EXCEPTION 'PLAYER_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_opponent_id) THEN
    RAISE EXCEPTION 'PLAYER_NOT_ELIGIBLE' USING ERRCODE = 'P0001';
  END IF;

  PERFORM public.finalize_live_pvp_deadlines(20);

  cfg := public.live_pvp_config();
  invite_seconds := COALESCE((cfg->>'invitationLifetimeSeconds')::integer, 300);

  IF EXISTS (
    SELECT 1 FROM public.live_pvp_participants WHERE user_id = v_user AND active_slot = true
  ) THEN
    RAISE EXCEPTION 'ACTIVE_MATCH_LIMIT' USING ERRCODE = 'P0001';
  END IF;

  SELECT count(*) INTO pending_count
  FROM public.live_pvp_matches
  WHERE challenger_id = v_user AND status = 'invited';
  IF pending_count >= COALESCE((cfg->>'maximumPendingInvitesPerPlayer')::integer, 3) THEN
    RAISE EXCEPTION 'INVITE_LIMIT' USING ERRCODE = 'P0001';
  END IF;

  SELECT count(*) INTO pair_count
  FROM public.live_pvp_matches
  WHERE status IN ('invited', 'lobby', 'countdown', 'active', 'settling')
    AND (
      (challenger_id = v_user AND opponent_id = p_opponent_id)
      OR (challenger_id = p_opponent_id AND opponent_id = v_user)
    );
  IF pair_count >= COALESCE((cfg->>'maximumPendingInvitesBetweenPlayers')::integer, 1) THEN
    RAISE EXCEPTION 'DUPLICATE_INVITE' USING ERRCODE = 'P0001';
  END IF;

  new_id := gen_random_uuid();
  topic := 'live-pvp:' || new_id::text;

  INSERT INTO public.live_pvp_matches (
    id, challenger_id, opponent_id, realtime_topic, status, protocol_version, expires_at, state_version
  )
  VALUES (
    new_id, v_user, p_opponent_id, topic,
    'invited', COALESCE(cfg->>'protocolVersion', '1'),
    now() + make_interval(secs => invite_seconds), 1
  )
  RETURNING * INTO match;

  INSERT INTO public.live_pvp_participants (match_id, user_id, participant_role, active_slot)
  VALUES
    (match.id, v_user, 'challenger', true),
    (match.id, p_opponent_id, 'opponent', false);

  PERFORM public.live_pvp_record_and_broadcast(
    match, 'invite_created', jsonb_build_object('challengerId', v_user)
  );

  RETURN jsonb_build_object(
    'matchId', match.id,
    'status', match.status,
    'realtimeTopic', match.realtime_topic,
    'protocolVersion', match.protocol_version,
    'stateVersion', match.state_version,
    'expiresAt', match.expires_at,
    'participantRole', 'challenger',
    'opponent', public.live_pvp_public_participant(p_opponent_id),
    'serverNow', now()
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- Accept / decline / cancel
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.accept_live_pvp_match(p_match_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  match public.live_pvp_matches%ROWTYPE;
  cfg jsonb;
  lobby_seconds integer;
  opp public.live_pvp_participants%ROWTYPE;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT * INTO match FROM public.live_pvp_matches WHERE id = p_match_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'MATCH_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
  IF match.opponent_id IS DISTINCT FROM v_user THEN
    RAISE EXCEPTION 'NOT_PARTICIPANT' USING ERRCODE = 'P0001';
  END IF;

  IF match.status = 'lobby' THEN
    RETURN public.get_live_pvp_snapshot(match.id);
  END IF;
  IF match.status <> 'invited' THEN
    RAISE EXCEPTION 'INVALID_MATCH_STATE' USING ERRCODE = 'P0001';
  END IF;
  IF match.expires_at <= now() THEN
    PERFORM public.assert_live_pvp_transition(match.status, 'expired');
    UPDATE public.live_pvp_matches
    SET status = 'expired', state_version = state_version + 1, updated_at = now()
    WHERE id = match.id RETURNING * INTO match;
    UPDATE public.live_pvp_participants SET active_slot = false, updated_at = now()
    WHERE match_id = match.id;
    RAISE EXCEPTION 'INVITE_EXPIRED' USING ERRCODE = 'P0001';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.live_pvp_participants
    WHERE user_id = v_user AND active_slot = true AND match_id <> match.id
  ) THEN
    RAISE EXCEPTION 'ACTIVE_MATCH_LIMIT' USING ERRCODE = 'P0001';
  END IF;

  cfg := public.live_pvp_config();
  lobby_seconds := COALESCE((cfg->>'lobbyLifetimeSeconds')::integer, 300);

  PERFORM public.assert_live_pvp_transition(match.status, 'lobby');

  UPDATE public.live_pvp_matches
  SET status = 'lobby',
      accepted_at = now(),
      expires_at = now() + make_interval(secs => lobby_seconds),
      state_version = state_version + 1,
      updated_at = now()
  WHERE id = match.id
  RETURNING * INTO match;

  UPDATE public.live_pvp_participants
  SET active_slot = true, joined_at = COALESCE(joined_at, now()), updated_at = now()
  WHERE match_id = match.id AND user_id = v_user
  RETURNING * INTO opp;

  UPDATE public.live_pvp_participants
  SET joined_at = COALESCE(joined_at, now()), updated_at = now()
  WHERE match_id = match.id AND participant_role = 'challenger';

  PERFORM public.live_pvp_record_and_broadcast(
    match, 'invite_accepted', jsonb_build_object('opponentId', v_user)
  );

  RETURN public.get_live_pvp_snapshot(match.id);
END;
$$;

CREATE OR REPLACE FUNCTION public.decline_live_pvp_match(p_match_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  match public.live_pvp_matches%ROWTYPE;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT * INTO match FROM public.live_pvp_matches WHERE id = p_match_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'MATCH_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
  IF match.opponent_id IS DISTINCT FROM v_user THEN
    RAISE EXCEPTION 'NOT_PARTICIPANT' USING ERRCODE = 'P0001';
  END IF;
  IF match.status = 'declined' THEN
    RETURN jsonb_build_object('matchId', match.id, 'status', 'declined', 'alreadyDeclined', true);
  END IF;
  IF match.status <> 'invited' THEN
    RAISE EXCEPTION 'INVALID_MATCH_STATE' USING ERRCODE = 'P0001';
  END IF;
  PERFORM public.assert_live_pvp_transition(match.status, 'declined');
  UPDATE public.live_pvp_matches
  SET status = 'declined', state_version = state_version + 1, updated_at = now()
  WHERE id = match.id RETURNING * INTO match;
  UPDATE public.live_pvp_participants SET active_slot = false, updated_at = now()
  WHERE match_id = match.id;
  PERFORM public.live_pvp_record_and_broadcast(match, 'match_cancelled', jsonb_build_object('reason', 'declined'));
  RETURN jsonb_build_object('matchId', match.id, 'status', 'declined', 'alreadyDeclined', false);
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_live_pvp_match(p_match_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  match public.live_pvp_matches%ROWTYPE;
  next_status text;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT * INTO match FROM public.live_pvp_matches WHERE id = p_match_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'MATCH_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
  IF match.challenger_id IS DISTINCT FROM v_user THEN
    RAISE EXCEPTION 'NOT_PARTICIPANT' USING ERRCODE = 'P0001';
  END IF;
  IF match.status IN ('cancelled', 'declined', 'expired', 'completed', 'invalid') THEN
    RETURN jsonb_build_object('matchId', match.id, 'status', match.status, 'alreadyTerminal', true);
  END IF;
  IF match.status = 'invited' THEN
    next_status := 'cancelled';
  ELSIF match.status = 'lobby' THEN
    next_status := 'cancelled';
  ELSE
    RAISE EXCEPTION 'INVALID_MATCH_STATE' USING ERRCODE = 'P0001';
  END IF;
  PERFORM public.assert_live_pvp_transition(match.status, next_status);
  UPDATE public.live_pvp_matches
  SET status = next_status, state_version = state_version + 1, updated_at = now()
  WHERE id = match.id RETURNING * INTO match;
  UPDATE public.live_pvp_participants SET active_slot = false, updated_at = now()
  WHERE match_id = match.id;
  PERFORM public.live_pvp_record_and_broadcast(match, 'match_cancelled', jsonb_build_object('by', 'challenger'));
  RETURN jsonb_build_object('matchId', match.id, 'status', match.status, 'alreadyTerminal', false);
END;
$$;

-- ---------------------------------------------------------------------------
-- Snapshot + server time
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_live_pvp_server_time()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  RETURN jsonb_build_object('serverNow', now());
END;
$$;

CREATE OR REPLACE FUNCTION public.get_live_pvp_snapshot(p_match_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  match public.live_pvp_matches%ROWTYPE;
  role text;
  include_seed boolean;
  my_attempt public.live_pvp_attempts%ROWTYPE;
  ch_ready boolean;
  op_ready boolean;
  progress jsonb;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT * INTO match FROM public.live_pvp_matches WHERE id = p_match_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'MATCH_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
  IF match.challenger_id IS DISTINCT FROM v_user AND match.opponent_id IS DISTINCT FROM v_user THEN
    RAISE EXCEPTION 'NOT_PARTICIPANT' USING ERRCODE = 'P0001';
  END IF;

  role := CASE WHEN match.challenger_id = v_user THEN 'challenger' ELSE 'opponent' END;
  include_seed := match.status IN ('countdown', 'active', 'settling', 'completed')
    AND match.seed IS NOT NULL;

  SELECT ready_at IS NOT NULL INTO ch_ready
  FROM public.live_pvp_participants
  WHERE match_id = match.id AND participant_role = 'challenger';
  SELECT ready_at IS NOT NULL INTO op_ready
  FROM public.live_pvp_participants
  WHERE match_id = match.id AND participant_role = 'opponent';

  SELECT * INTO my_attempt FROM public.live_pvp_attempts
  WHERE match_id = match.id AND user_id = v_user;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'userId', pr.user_id,
    'sequence', pr.sequence,
    'score', pr.score,
    'exact21Count', pr.exact_21_count,
    'fiveCardClearCount', pr.five_card_clear_count,
    'bustCount', pr.bust_count,
    'cardsPlayed', pr.cards_played,
    'lanesCleared', pr.lanes_cleared,
    'clientElapsedMs', pr.client_elapsed_ms,
    'serverReceivedAt', pr.server_received_at
  )), '[]'::jsonb)
  INTO progress
  FROM public.live_pvp_progress pr
  WHERE pr.match_id = match.id;

  RETURN jsonb_build_object(
    'matchId', match.id,
    'status', match.status,
    'stateVersion', match.state_version,
    'protocolVersion', match.protocol_version,
    'realtimeTopic', match.realtime_topic,
    'participantRole', role,
    'challenger', public.live_pvp_public_participant(match.challenger_id),
    'opponent', public.live_pvp_public_participant(match.opponent_id),
    'challengerReady', COALESCE(ch_ready, false),
    'opponentReady', COALESCE(op_ready, false),
    'scheduledStartAt', match.scheduled_start_at,
    'gameplayDeadlineAt', match.gameplay_deadline_at,
    'submissionGraceUntil', match.submission_grace_until,
    'expiresAt', match.expires_at,
    'rulesVersion', match.rules_version,
    'deckVersion', match.deck_version,
    'durationSeconds', match.duration_seconds,
    'bustLimit', match.bust_limit,
    'seed', CASE WHEN include_seed THEN match.seed ELSE NULL END,
    'seedAvailable', include_seed,
    'outcome', match.outcome,
    'winnerUserId', match.winner_user_id,
    'decidingField', match.deciding_field,
    'completionReason', match.completion_reason,
    'settledAt', match.settled_at,
    'myAttempt', CASE WHEN my_attempt.id IS NULL THEN NULL ELSE jsonb_build_object(
      'attemptId', my_attempt.id,
      'status', my_attempt.status,
      'score', my_attempt.score,
      'completedAt', my_attempt.completed_at
    ) END,
    'progress', progress,
    'serverNow', now(),
    'gameplayEligible', (
      match.scheduled_start_at IS NOT NULL
      AND now() >= match.scheduled_start_at
      AND match.status IN ('countdown', 'active', 'settling')
    )
  );
END;
$$;


-- ---------------------------------------------------------------------------
-- Ready + countdown (exactly once)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.live_pvp_try_schedule_countdown(p_match_id uuid)
RETURNS public.live_pvp_matches
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  match public.live_pvp_matches%ROWTYPE;
  cfg jsonb;
  ready_count integer;
  lead_secs integer;
  duration_secs integer;
  grace_secs integer;
  seed_text text;
BEGIN
  SELECT * INTO match FROM public.live_pvp_matches WHERE id = p_match_id FOR UPDATE;
  IF NOT FOUND OR match.status <> 'lobby' THEN
    RETURN match;
  END IF;

  SELECT count(*) INTO ready_count
  FROM public.live_pvp_participants
  WHERE match_id = match.id AND ready_at IS NOT NULL;
  IF ready_count < 2 THEN
    RETURN match;
  END IF;

  cfg := public.live_pvp_config();
  lead_secs := GREATEST(COALESCE((cfg->>'countdownLeadSeconds')::integer, 5), 3);
  duration_secs := COALESCE((cfg->>'durationSeconds')::integer, 120);
  grace_secs := COALESCE((cfg->>'completionGraceSeconds')::integer, 15);
  seed_text := '21blaze-live-pvp-v1:' || gen_random_uuid()::text || ':' || encode(gen_random_bytes(16), 'hex');

  PERFORM public.assert_live_pvp_transition(match.status, 'countdown');

  UPDATE public.live_pvp_matches
  SET
    status = 'countdown',
    protocol_version = COALESCE(cfg->>'protocolVersion', protocol_version),
    rules_version = COALESCE(cfg->>'rulesVersion', '1'),
    deck_version = COALESCE(cfg->>'deckVersion', '1'),
    seed = seed_text,
    duration_seconds = duration_secs,
    bust_limit = COALESCE((cfg->>'bustLimit')::integer, 3),
    scheduled_start_at = now() + make_interval(secs => lead_secs),
    gameplay_deadline_at = now() + make_interval(secs => lead_secs + duration_secs),
    submission_grace_until = now() + make_interval(secs => lead_secs + duration_secs + grace_secs),
    countdown_started_at = now(),
    expires_at = now() + make_interval(secs => lead_secs + duration_secs + grace_secs + 60),
    state_version = state_version + 1,
    updated_at = now()
  WHERE id = match.id AND status = 'lobby'
  RETURNING * INTO match;

  IF NOT FOUND THEN
    SELECT * INTO match FROM public.live_pvp_matches WHERE id = p_match_id;
    RETURN match;
  END IF;

  INSERT INTO public.live_pvp_attempts (
    match_id, user_id, participant_role, status, started_at, rules_version, deck_version
  )
  SELECT
    match.id, p.user_id, p.participant_role, 'pending', NULL, match.rules_version, match.deck_version
  FROM public.live_pvp_participants p
  WHERE p.match_id = match.id
  ON CONFLICT (match_id, user_id) DO NOTHING;

  PERFORM public.live_pvp_record_and_broadcast(
    match,
    'countdown_scheduled',
    jsonb_build_object(
      'scheduledStartAt', match.scheduled_start_at,
      'gameplayDeadlineAt', match.gameplay_deadline_at,
      'submissionGraceUntil', match.submission_grace_until,
      'durationSeconds', match.duration_seconds,
      'bustLimit', match.bust_limit,
      'rulesVersion', match.rules_version,
      'deckVersion', match.deck_version
      -- seed intentionally omitted from broadcast; clients fetch via snapshot
    )
  );

  RETURN match;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_live_pvp_ready(p_match_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  match public.live_pvp_matches%ROWTYPE;
  part public.live_pvp_participants%ROWTYPE;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT * INTO match FROM public.live_pvp_matches WHERE id = p_match_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'MATCH_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
  IF match.challenger_id IS DISTINCT FROM v_user AND match.opponent_id IS DISTINCT FROM v_user THEN
    RAISE EXCEPTION 'NOT_PARTICIPANT' USING ERRCODE = 'P0001';
  END IF;
  IF match.status <> 'lobby' THEN
    IF match.status IN ('countdown', 'active') THEN
      RETURN public.get_live_pvp_snapshot(match.id);
    END IF;
    RAISE EXCEPTION 'INVALID_MATCH_STATE' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.live_pvp_participants
  SET ready_at = COALESCE(ready_at, now()), updated_at = now()
  WHERE match_id = match.id AND user_id = v_user
  RETURNING * INTO part;

  UPDATE public.live_pvp_matches
  SET state_version = state_version + 1, updated_at = now()
  WHERE id = match.id
  RETURNING * INTO match;

  PERFORM public.live_pvp_record_and_broadcast(
    match, 'participant_ready', jsonb_build_object('userId', v_user, 'role', part.participant_role)
  );

  match := public.live_pvp_try_schedule_countdown(match.id);
  RETURN public.get_live_pvp_snapshot(match.id);
END;
$$;

CREATE OR REPLACE FUNCTION public.ensure_live_pvp_active(p_match_id uuid)
RETURNS public.live_pvp_matches
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  match public.live_pvp_matches%ROWTYPE;
BEGIN
  SELECT * INTO match FROM public.live_pvp_matches WHERE id = p_match_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN match;
  END IF;
  IF match.status = 'countdown'
     AND match.scheduled_start_at IS NOT NULL
     AND now() >= match.scheduled_start_at THEN
    PERFORM public.assert_live_pvp_transition(match.status, 'active');
    UPDATE public.live_pvp_matches
    SET status = 'active', state_version = state_version + 1, updated_at = now()
    WHERE id = match.id
    RETURNING * INTO match;

    UPDATE public.live_pvp_attempts
    SET status = 'active', started_at = COALESCE(started_at, match.scheduled_start_at), updated_at = now()
    WHERE match_id = match.id AND status = 'pending';

    PERFORM public.live_pvp_record_and_broadcast(match, 'match_active', '{}'::jsonb);
  END IF;
  RETURN match;
END;
$$;

-- ---------------------------------------------------------------------------
-- Progress
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_live_pvp_progress(
  p_match_id uuid,
  p_sequence bigint,
  p_score integer,
  p_exact_21_count integer,
  p_five_card_clear_count integer,
  p_bust_count integer,
  p_cards_played integer,
  p_lanes_cleared integer,
  p_client_elapsed_ms integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  match public.live_pvp_matches%ROWTYPE;
  attempt public.live_pvp_attempts%ROWTYPE;
  cfg jsonb;
  min_interval integer;
  existing public.live_pvp_progress%ROWTYPE;
  accepted boolean := false;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT COALESCE((public.live_pvp_config()->>'liveProgressEnabled')::boolean, true) THEN
    RAISE EXCEPTION 'LIVE_PVP_DISABLED' USING ERRCODE = 'P0001';
  END IF;

  match := public.ensure_live_pvp_active(p_match_id);
  SELECT * INTO match FROM public.live_pvp_matches WHERE id = p_match_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'MATCH_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
  IF match.challenger_id IS DISTINCT FROM v_user AND match.opponent_id IS DISTINCT FROM v_user THEN
    RAISE EXCEPTION 'NOT_PARTICIPANT' USING ERRCODE = 'P0001';
  END IF;

  IF match.scheduled_start_at IS NULL OR now() < match.scheduled_start_at
     OR match.status NOT IN ('countdown', 'active') THEN
    RAISE EXCEPTION 'MATCH_NOT_ACTIVE' USING ERRCODE = 'P0001';
  END IF;
  IF match.submission_grace_until IS NOT NULL AND now() > match.submission_grace_until THEN
    RAISE EXCEPTION 'SUBMISSION_TOO_LATE' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO attempt FROM public.live_pvp_attempts
  WHERE match_id = match.id AND user_id = v_user FOR UPDATE;
  IF NOT FOUND OR attempt.status NOT IN ('pending', 'active') THEN
    RAISE EXCEPTION 'INVALID_MATCH_STATE' USING ERRCODE = 'P0001';
  END IF;

  IF p_sequence IS NULL OR p_sequence <= 0
     OR COALESCE(p_score, -1) < 0
     OR COALESCE(p_exact_21_count, -1) < 0
     OR COALESCE(p_five_card_clear_count, -1) < 0
     OR COALESCE(p_bust_count, -1) < 0
     OR COALESCE(p_cards_played, -1) < 0 OR COALESCE(p_cards_played, 0) > 52
     OR COALESCE(p_lanes_cleared, -1) < 0 OR COALESCE(p_lanes_cleared, 0) > 20
     OR COALESCE(p_client_elapsed_ms, -1) < 0 THEN
    RAISE EXCEPTION 'INVALID_RESULT' USING ERRCODE = 'P0001';
  END IF;

  cfg := public.live_pvp_config();
  min_interval := COALESCE((cfg->>'progressMinimumIntervalMs')::integer, 1000);

  SELECT * INTO existing FROM public.live_pvp_progress
  WHERE match_id = match.id AND user_id = v_user FOR UPDATE;

  IF FOUND THEN
    IF p_sequence < existing.sequence THEN
      RAISE EXCEPTION 'STALE_PROGRESS_SEQUENCE' USING ERRCODE = 'P0001';
    END IF;
    IF p_sequence = existing.sequence THEN
      RETURN jsonb_build_object(
        'accepted', true, 'idempotent', true, 'sequence', existing.sequence, 'serverNow', now()
      );
    END IF;
    IF existing.server_received_at > now() - make_interval(secs => min_interval / 1000.0) THEN
      RAISE EXCEPTION 'PROGRESS_RATE_LIMITED' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  INSERT INTO public.live_pvp_progress AS pr (
    match_id, user_id, sequence, score, exact_21_count, five_card_clear_count,
    bust_count, cards_played, lanes_cleared, client_elapsed_ms, server_received_at, updated_at
  ) VALUES (
    match.id, v_user, p_sequence, p_score, COALESCE(p_exact_21_count, 0),
    COALESCE(p_five_card_clear_count, 0), COALESCE(p_bust_count, 0),
    COALESCE(p_cards_played, 0), COALESCE(p_lanes_cleared, 0),
    COALESCE(p_client_elapsed_ms, 0), now(), now()
  )
  ON CONFLICT (match_id, user_id) DO UPDATE
  SET sequence = EXCLUDED.sequence,
      score = EXCLUDED.score,
      exact_21_count = EXCLUDED.exact_21_count,
      five_card_clear_count = EXCLUDED.five_card_clear_count,
      bust_count = EXCLUDED.bust_count,
      cards_played = EXCLUDED.cards_played,
      lanes_cleared = EXCLUDED.lanes_cleared,
      client_elapsed_ms = EXCLUDED.client_elapsed_ms,
      server_received_at = now(),
      updated_at = now()
  WHERE pr.sequence < EXCLUDED.sequence;

  IF NOT FOUND AND existing.sequence IS NOT NULL AND existing.sequence >= p_sequence THEN
    RETURN jsonb_build_object('accepted', false, 'sequence', existing.sequence, 'serverNow', now());
  END IF;

  UPDATE public.live_pvp_participants
  SET last_progress_at = now(), updated_at = now()
  WHERE match_id = match.id AND user_id = v_user;

  UPDATE public.live_pvp_matches
  SET state_version = state_version + 1, updated_at = now()
  WHERE id = match.id
  RETURNING * INTO match;

  PERFORM public.live_pvp_record_and_broadcast(
    match,
    'progress_accepted',
    jsonb_build_object(
      'userId', v_user,
      'sequence', p_sequence,
      'score', p_score,
      'exact21Count', COALESCE(p_exact_21_count, 0),
      'fiveCardClearCount', COALESCE(p_five_card_clear_count, 0),
      'bustCount', COALESCE(p_bust_count, 0),
      'cardsPlayed', COALESCE(p_cards_played, 0)
    )
  );

  RETURN jsonb_build_object(
    'accepted', true,
    'idempotent', false,
    'sequence', p_sequence,
    'stateVersion', match.state_version,
    'serverNow', now()
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- Settlement helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.live_pvp_settle_match(p_match_id uuid)
RETURNS public.live_pvp_matches
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  match public.live_pvp_matches%ROWTYPE;
  ca public.live_pvp_attempts%ROWTYPE;
  oa public.live_pvp_attempts%ROWTYPE;
  comparison jsonb;
  outcome_text text;
  deciding text;
  winner uuid;
  reason text := 'normal';
BEGIN
  SELECT * INTO match FROM public.live_pvp_matches WHERE id = p_match_id FOR UPDATE;
  IF NOT FOUND THEN RETURN match; END IF;
  IF match.status = 'completed' AND match.settled_at IS NOT NULL THEN
    RETURN match;
  END IF;

  SELECT * INTO ca FROM public.live_pvp_attempts
  WHERE match_id = match.id AND participant_role = 'challenger' FOR UPDATE;
  SELECT * INTO oa FROM public.live_pvp_attempts
  WHERE match_id = match.id AND participant_role = 'opponent' FOR UPDATE;

  IF ca.status = 'completed' AND oa.status = 'completed' THEN
    comparison := public.compare_async_duel_results(
      ca.score, ca.exact_21_count, ca.five_card_clear_count, ca.bust_count, ca.completion_ms,
      oa.score, oa.exact_21_count, oa.five_card_clear_count, oa.bust_count, oa.completion_ms
    );
    outcome_text := comparison->>'outcome';
    deciding := comparison->>'decidingField';
    winner := CASE outcome_text
      WHEN 'challenger_win' THEN match.challenger_id
      WHEN 'opponent_win' THEN match.opponent_id
      ELSE NULL
    END;
    reason := 'normal';
  ELSIF ca.status = 'completed' AND oa.status IN ('forfeited', 'timed_out') THEN
    outcome_text := 'challenger_win'; winner := match.challenger_id; deciding := 'forfeit';
    reason := CASE WHEN oa.status = 'forfeited' THEN 'forfeit' ELSE 'timeout' END;
  ELSIF oa.status = 'completed' AND ca.status IN ('forfeited', 'timed_out') THEN
    outcome_text := 'opponent_win'; winner := match.opponent_id; deciding := 'forfeit';
    reason := CASE WHEN ca.status = 'forfeited' THEN 'forfeit' ELSE 'timeout' END;
  ELSIF ca.status IN ('forfeited', 'timed_out') AND oa.status IN ('forfeited', 'timed_out') THEN
    outcome_text := 'no_contest'; winner := NULL; deciding := NULL; reason := 'timeout';
  ELSE
    -- Not yet settleable
    RETURN match;
  END IF;

  IF match.status NOT IN ('settling', 'completed') THEN
    IF match.status IN ('countdown', 'active') THEN
      PERFORM public.assert_live_pvp_transition(match.status, 'settling');
      UPDATE public.live_pvp_matches
      SET status = 'settling', state_version = state_version + 1, updated_at = now()
      WHERE id = match.id RETURNING * INTO match;
    END IF;
  END IF;

  PERFORM public.assert_live_pvp_transition(match.status, 'completed');

  UPDATE public.live_pvp_matches
  SET status = 'completed',
      outcome = outcome_text,
      winner_user_id = winner,
      deciding_field = deciding,
      completion_reason = reason,
      completed_at = COALESCE(completed_at, now()),
      settled_at = now(),
      state_version = state_version + 1,
      updated_at = now()
  WHERE id = match.id
  RETURNING * INTO match;

  UPDATE public.live_pvp_participants
  SET active_slot = false, updated_at = now()
  WHERE match_id = match.id;

  PERFORM public.live_pvp_record_and_broadcast(
    match,
    'match_settled',
    jsonb_build_object(
      'outcome', match.outcome,
      'winnerUserId', match.winner_user_id,
      'decidingField', match.deciding_field,
      'completionReason', match.completion_reason
    )
  );

  -- No XP / Blaze Coins / public Live PvP records in Phase 1.
  RETURN match;
END;
$$;


-- ---------------------------------------------------------------------------
-- Complete / forfeit
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.complete_live_pvp_attempt(
  p_match_id uuid,
  p_score integer,
  p_exact_21_count integer,
  p_five_card_clear_count integer,
  p_bust_count integer,
  p_cards_played integer,
  p_lanes_cleared integer,
  p_completion_ms integer,
  p_rules_version text,
  p_deck_version text,
  p_submission_version text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  match public.live_pvp_matches%ROWTYPE;
  attempt public.live_pvp_attempts%ROWTYPE;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  match := public.ensure_live_pvp_active(p_match_id);
  SELECT * INTO match FROM public.live_pvp_matches WHERE id = p_match_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'MATCH_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
  IF match.challenger_id IS DISTINCT FROM v_user AND match.opponent_id IS DISTINCT FROM v_user THEN
    RAISE EXCEPTION 'NOT_PARTICIPANT' USING ERRCODE = 'P0001';
  END IF;

  IF match.status = 'completed' THEN
    RETURN public.get_live_pvp_snapshot(match.id);
  END IF;

  IF match.scheduled_start_at IS NULL OR now() < match.scheduled_start_at THEN
    RAISE EXCEPTION 'MATCH_NOT_ACTIVE' USING ERRCODE = 'P0001';
  END IF;
  IF match.submission_grace_until IS NOT NULL AND now() > match.submission_grace_until THEN
    RAISE EXCEPTION 'SUBMISSION_TOO_LATE' USING ERRCODE = 'P0001';
  END IF;
  IF match.status NOT IN ('countdown', 'active', 'settling') THEN
    RAISE EXCEPTION 'INVALID_MATCH_STATE' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO attempt FROM public.live_pvp_attempts
  WHERE match_id = match.id AND user_id = v_user FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'MATCH_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;

  IF attempt.status = 'completed' THEN
    RETURN public.get_live_pvp_snapshot(match.id);
  END IF;
  IF attempt.status NOT IN ('pending', 'active') THEN
    RAISE EXCEPTION 'INVALID_MATCH_STATE' USING ERRCODE = 'P0001';
  END IF;

  IF p_rules_version IS DISTINCT FROM match.rules_version
     OR p_deck_version IS DISTINCT FROM match.deck_version THEN
    RAISE EXCEPTION 'INVALID_RESULT' USING ERRCODE = 'P0001';
  END IF;

  PERFORM public.validate_async_duel_result_fields(
    p_score, p_exact_21_count, p_five_card_clear_count, p_bust_count,
    p_cards_played, p_lanes_cleared, p_completion_ms, match.duration_seconds
  );

  UPDATE public.live_pvp_attempts
  SET status = 'completed',
      completed_at = now(),
      score = p_score,
      exact_21_count = COALESCE(p_exact_21_count, 0),
      five_card_clear_count = COALESCE(p_five_card_clear_count, 0),
      bust_count = COALESCE(p_bust_count, 0),
      cards_played = COALESCE(p_cards_played, 0),
      lanes_cleared = COALESCE(p_lanes_cleared, 0),
      completion_ms = COALESCE(p_completion_ms, 0),
      rules_version = p_rules_version,
      deck_version = p_deck_version,
      submission_version = p_submission_version,
      updated_at = now()
  WHERE id = attempt.id
  RETURNING * INTO attempt;

  UPDATE public.live_pvp_participants
  SET finished_at = now(), updated_at = now()
  WHERE match_id = match.id AND user_id = v_user;

  IF match.status IN ('countdown', 'active') THEN
    PERFORM public.assert_live_pvp_transition(match.status, 'settling');
    UPDATE public.live_pvp_matches
    SET status = 'settling', state_version = state_version + 1, updated_at = now()
    WHERE id = match.id
    RETURNING * INTO match;
  ELSE
    UPDATE public.live_pvp_matches
    SET state_version = state_version + 1, updated_at = now()
    WHERE id = match.id
    RETURNING * INTO match;
  END IF;

  PERFORM public.live_pvp_record_and_broadcast(
    match,
    'participant_finished',
    jsonb_build_object('userId', v_user, 'score', attempt.score)
  );

  match := public.live_pvp_settle_match(match.id);
  RETURN public.get_live_pvp_snapshot(match.id);
END;
$$;

CREATE OR REPLACE FUNCTION public.forfeit_live_pvp_match(p_match_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  match public.live_pvp_matches%ROWTYPE;
  attempt public.live_pvp_attempts%ROWTYPE;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT * INTO match FROM public.live_pvp_matches WHERE id = p_match_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'MATCH_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
  IF match.challenger_id IS DISTINCT FROM v_user AND match.opponent_id IS DISTINCT FROM v_user THEN
    RAISE EXCEPTION 'NOT_PARTICIPANT' USING ERRCODE = 'P0001';
  END IF;

  IF match.status IN ('completed', 'declined', 'cancelled', 'expired', 'invalid') THEN
    RETURN public.get_live_pvp_snapshot(match.id);
  END IF;

  -- Lobby leave before countdown = cancel/decline style release for the leaving player path:
  -- Phase 1: forfeit only after countdown begins; before that challenger cancels / opponent declines.
  IF match.status IN ('invited', 'lobby') THEN
    RAISE EXCEPTION 'INVALID_MATCH_STATE' USING ERRCODE = 'P0001', DETAIL = 'use_cancel_or_decline';
  END IF;

  SELECT * INTO attempt FROM public.live_pvp_attempts
  WHERE match_id = match.id AND user_id = v_user FOR UPDATE;

  IF attempt.status IN ('forfeited', 'completed', 'timed_out') THEN
    RETURN public.get_live_pvp_snapshot(match.id);
  END IF;

  UPDATE public.live_pvp_attempts
  SET status = 'forfeited', completed_at = COALESCE(completed_at, now()), updated_at = now()
  WHERE id = attempt.id;

  UPDATE public.live_pvp_participants
  SET forfeited_at = now(), finished_at = COALESCE(finished_at, now()), updated_at = now()
  WHERE match_id = match.id AND user_id = v_user;

  IF match.status IN ('countdown', 'active') THEN
    PERFORM public.assert_live_pvp_transition(match.status, 'settling');
    UPDATE public.live_pvp_matches
    SET status = 'settling', state_version = state_version + 1, updated_at = now()
    WHERE id = match.id RETURNING * INTO match;
  ELSE
    UPDATE public.live_pvp_matches
    SET state_version = state_version + 1, updated_at = now()
    WHERE id = match.id RETURNING * INTO match;
  END IF;

  PERFORM public.live_pvp_record_and_broadcast(
    match, 'participant_forfeited', jsonb_build_object('userId', v_user)
  );

  match := public.live_pvp_settle_match(match.id);
  RETURN public.get_live_pvp_snapshot(match.id);
END;
$$;

-- ---------------------------------------------------------------------------
-- Deadline finalizer (bounded, idempotent, skip-locked)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.finalize_live_pvp_deadlines(p_limit integer DEFAULT 20)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  safe_limit integer := LEAST(GREATEST(COALESCE(p_limit, 20), 1), 50);
  processed integer := 0;
  r record;
  match public.live_pvp_matches%ROWTYPE;
BEGIN
  -- Expire invites / lobbies
  FOR r IN
    SELECT id FROM public.live_pvp_matches
    WHERE status IN ('invited', 'lobby')
      AND expires_at <= now()
    ORDER BY expires_at
    LIMIT safe_limit
    FOR UPDATE SKIP LOCKED
  LOOP
    SELECT * INTO match FROM public.live_pvp_matches WHERE id = r.id FOR UPDATE;
    PERFORM public.assert_live_pvp_transition(match.status, 'expired');
    UPDATE public.live_pvp_matches
    SET status = 'expired', state_version = state_version + 1, updated_at = now()
    WHERE id = match.id RETURNING * INTO match;
    UPDATE public.live_pvp_participants SET active_slot = false, updated_at = now()
    WHERE match_id = match.id;
    PERFORM public.live_pvp_record_and_broadcast(match, 'match_expired', '{}'::jsonb);
    processed := processed + 1;
  END LOOP;

  -- Timeout incomplete attempts past grace
  FOR r IN
    SELECT id FROM public.live_pvp_matches
    WHERE status IN ('countdown', 'active', 'settling')
      AND submission_grace_until IS NOT NULL
      AND submission_grace_until <= now()
      AND settled_at IS NULL
    ORDER BY submission_grace_until
    LIMIT safe_limit
    FOR UPDATE SKIP LOCKED
  LOOP
    SELECT * INTO match FROM public.live_pvp_matches WHERE id = r.id FOR UPDATE;
    UPDATE public.live_pvp_attempts
    SET status = 'timed_out', completed_at = COALESCE(completed_at, now()), updated_at = now()
    WHERE match_id = match.id AND status IN ('pending', 'active');

    IF match.status IN ('countdown', 'active') THEN
      PERFORM public.assert_live_pvp_transition(match.status, 'settling');
      UPDATE public.live_pvp_matches
      SET status = 'settling', state_version = state_version + 1, updated_at = now()
      WHERE id = match.id RETURNING * INTO match;
    END IF;

    PERFORM public.live_pvp_record_and_broadcast(
      match, 'participant_timed_out', jsonb_build_object('reason', 'grace_elapsed')
    );
    PERFORM public.live_pvp_settle_match(match.id);
    processed := processed + 1;
  END LOOP;

  RETURN jsonb_build_object('processed', processed, 'serverNow', now());
END;
$$;

CREATE OR REPLACE FUNCTION public.reconcile_live_pvp_active_slots(p_limit integer DEFAULT 50)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  released integer := 0;
BEGIN
  WITH stale AS (
    SELECT p.id
    FROM public.live_pvp_participants p
    JOIN public.live_pvp_matches m ON m.id = p.match_id
    WHERE p.active_slot = true
      AND m.status IN ('completed', 'declined', 'cancelled', 'expired', 'invalid')
    LIMIT LEAST(GREATEST(COALESCE(p_limit, 50), 1), 200)
  )
  UPDATE public.live_pvp_participants p
  SET active_slot = false, updated_at = now()
  FROM stale
  WHERE p.id = stale.id;

  GET DIAGNOSTICS released = ROW_COUNT;
  RETURN jsonb_build_object('released', released);
END;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.create_live_pvp_invite(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.accept_live_pvp_match(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.decline_live_pvp_match(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cancel_live_pvp_match(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_live_pvp_ready(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_live_pvp_snapshot(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_live_pvp_server_time() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.submit_live_pvp_progress(uuid, bigint, integer, integer, integer, integer, integer, integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.complete_live_pvp_attempt(uuid, integer, integer, integer, integer, integer, integer, integer, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.forfeit_live_pvp_match(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finalize_live_pvp_deadlines(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reconcile_live_pvp_active_slots(integer) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.create_live_pvp_invite(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_live_pvp_match(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decline_live_pvp_match(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_live_pvp_match(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_live_pvp_ready(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_live_pvp_snapshot(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_live_pvp_server_time() TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_live_pvp_progress(uuid, bigint, integer, integer, integer, integer, integer, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_live_pvp_attempt(uuid, integer, integer, integer, integer, integer, integer, integer, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.forfeit_live_pvp_match(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_live_pvp_deadlines(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.reconcile_live_pvp_active_slots(integer) TO service_role;

-- Authenticated may also call finalizer opportunistically (bounded); still safe.
GRANT EXECUTE ON FUNCTION public.finalize_live_pvp_deadlines(integer) TO authenticated;

COMMENT ON TABLE public.live_pvp_matches IS
  'v1.5 Live PvP matches. Distinct from legacy public.live_matches (friend/quick/ranked beta).';
COMMENT ON FUNCTION public.is_live_pvp_participant(text) IS
  'Realtime membership for topic live-pvp:{matchId}. Authz cached per connection.';
