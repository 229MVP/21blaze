-- Version 1.4 Phase 3 — Async Duel notifications, push outbox, records, rematches
-- No client-direct inserts into notifications, outbox, or stats.
-- Push delivery is out-of-band; settlement never depends on push success.

-- ---------------------------------------------------------------------------
-- Rematch lineage on async_duels
-- ---------------------------------------------------------------------------
ALTER TABLE public.async_duels
  ADD COLUMN IF NOT EXISTS rematch_of_duel_id uuid REFERENCES public.async_duels(id),
  ADD COLUMN IF NOT EXISTS series_root_duel_id uuid REFERENCES public.async_duels(id);

CREATE UNIQUE INDEX IF NOT EXISTS async_duels_one_rematch_child_idx
  ON public.async_duels (rematch_of_duel_id)
  WHERE rematch_of_duel_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS async_duels_series_root_idx
  ON public.async_duels (series_root_duel_id)
  WHERE series_root_duel_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- player_notifications
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.player_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notification_type text NOT NULL
    CHECK (notification_type IN (
      'DUEL_CHALLENGE_RECEIVED',
      'DUEL_COMPLETED',
      'DUEL_DECLINED',
      'DUEL_EXPIRED'
    )),
  duel_id uuid REFERENCES public.async_duels(id) ON DELETE SET NULL,
  dedupe_key text NOT NULL,
  title_key text NOT NULL,
  body_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  deep_link_data jsonb,
  push_eligible boolean NOT NULL DEFAULT true,
  push_status text
    CHECK (push_status IS NULL OR push_status IN (
      'pending', 'processing', 'submitted', 'delivered', 'failed', 'suppressed'
    )),
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT player_notifications_user_dedupe UNIQUE (user_id, dedupe_key)
);

CREATE INDEX IF NOT EXISTS player_notifications_user_created_idx
  ON public.player_notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS player_notifications_user_unread_idx
  ON public.player_notifications (user_id)
  WHERE read_at IS NULL;

ALTER TABLE public.player_notifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.player_notifications FROM PUBLIC, anon, authenticated;
GRANT SELECT, UPDATE ON public.player_notifications TO authenticated;

DROP POLICY IF EXISTS player_notifications_select_own ON public.player_notifications;
CREATE POLICY player_notifications_select_own
  ON public.player_notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS player_notifications_update_own ON public.player_notifications;
CREATE POLICY player_notifications_update_own
  ON public.player_notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- notification_preferences
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  duel_challenges_in_app boolean NOT NULL DEFAULT true,
  duel_challenges_push boolean NOT NULL DEFAULT true,
  duel_results_in_app boolean NOT NULL DEFAULT true,
  duel_results_push boolean NOT NULL DEFAULT true,
  duel_status_in_app boolean NOT NULL DEFAULT true,
  duel_status_push boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.notification_preferences FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.notification_preferences TO authenticated;

DROP POLICY IF EXISTS notification_preferences_select_own ON public.notification_preferences;
CREATE POLICY notification_preferences_select_own
  ON public.notification_preferences FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS notification_preferences_insert_own ON public.notification_preferences;
CREATE POLICY notification_preferences_insert_own
  ON public.notification_preferences FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS notification_preferences_update_own ON public.notification_preferences;
CREATE POLICY notification_preferences_update_own
  ON public.notification_preferences FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- device_push_tokens
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.device_push_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  push_token text NOT NULL,
  platform text NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
  app_environment text NOT NULL CHECK (app_environment IN ('development', 'preview', 'production')),
  active boolean NOT NULL DEFAULT true,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  CONSTRAINT device_push_tokens_token_unique UNIQUE (push_token),
  CONSTRAINT device_push_tokens_token_len CHECK (char_length(push_token) BETWEEN 16 AND 512)
);

CREATE INDEX IF NOT EXISTS device_push_tokens_user_active_idx
  ON public.device_push_tokens (user_id)
  WHERE active = true AND revoked_at IS NULL;

ALTER TABLE public.device_push_tokens ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.device_push_tokens FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.device_push_tokens TO authenticated;

DROP POLICY IF EXISTS device_push_tokens_select_own ON public.device_push_tokens;
CREATE POLICY device_push_tokens_select_own
  ON public.device_push_tokens FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS device_push_tokens_insert_own ON public.device_push_tokens;
CREATE POLICY device_push_tokens_insert_own
  ON public.device_push_tokens FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS device_push_tokens_update_own ON public.device_push_tokens;
CREATE POLICY device_push_tokens_update_own
  ON public.device_push_tokens FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- notification_push_outbox (no client access)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notification_push_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id uuid NOT NULL REFERENCES public.player_notifications(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'submitted', 'delivered', 'failed', 'suppressed')),
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  provider_message_id text,
  last_error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  delivered_at timestamptz,
  CONSTRAINT notification_push_outbox_one_job UNIQUE (notification_id)
);

CREATE INDEX IF NOT EXISTS notification_push_outbox_dispatch_idx
  ON public.notification_push_outbox (status, next_attempt_at)
  WHERE status IN ('pending', 'processing', 'failed');

ALTER TABLE public.notification_push_outbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.notification_push_outbox FROM PUBLIC, anon, authenticated;
-- service_role retains access for the dispatcher.

-- ---------------------------------------------------------------------------
-- player_duel_stats + duel_stat_events
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.player_duel_stats (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  completed_duels integer NOT NULL DEFAULT 0 CHECK (completed_duels >= 0),
  wins integer NOT NULL DEFAULT 0 CHECK (wins >= 0),
  losses integer NOT NULL DEFAULT 0 CHECK (losses >= 0),
  ties integer NOT NULL DEFAULT 0 CHECK (ties >= 0),
  highest_duel_score integer NOT NULL DEFAULT 0 CHECK (highest_duel_score >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT player_duel_stats_totals_match CHECK (completed_duels = wins + losses + ties)
);

CREATE TABLE IF NOT EXISTS public.duel_stat_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  duel_id uuid NOT NULL REFERENCES public.async_duels(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  outcome text NOT NULL CHECK (outcome IN ('win', 'loss', 'tie')),
  score integer NOT NULL CHECK (score >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT duel_stat_events_one_per_user UNIQUE (duel_id, user_id)
);

CREATE INDEX IF NOT EXISTS duel_stat_events_user_idx
  ON public.duel_stat_events (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS duel_stat_events_pair_idx
  ON public.duel_stat_events (duel_id);

ALTER TABLE public.player_duel_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.duel_stat_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.player_duel_stats FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.duel_stat_events FROM PUBLIC, anon, authenticated;
-- Reads via SECURITY DEFINER RPCs only (approved aggregates).

-- ---------------------------------------------------------------------------
-- Preference helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ensure_notification_preferences(p_user uuid)
RETURNS public.notification_preferences
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  row public.notification_preferences%ROWTYPE;
BEGIN
  INSERT INTO public.notification_preferences (user_id)
  VALUES (p_user)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT * INTO row FROM public.notification_preferences WHERE user_id = p_user;
  RETURN row;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_notification_preferences(uuid) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.enqueue_player_notification(
  p_user_id uuid,
  p_type text,
  p_duel_id uuid,
  p_dedupe_key text,
  p_title_key text,
  p_body_data jsonb,
  p_deep_link_data jsonb,
  p_push_eligible boolean DEFAULT true
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  prefs public.notification_preferences%ROWTYPE;
  notif_id uuid;
  allow_in_app boolean := true;
  allow_push boolean := true;
  push_ok boolean;
BEGIN
  prefs := public.ensure_notification_preferences(p_user_id);

  IF p_type = 'DUEL_CHALLENGE_RECEIVED' THEN
    allow_in_app := prefs.duel_challenges_in_app;
    allow_push := prefs.duel_challenges_push;
  ELSIF p_type = 'DUEL_COMPLETED' THEN
    allow_in_app := prefs.duel_results_in_app;
    allow_push := prefs.duel_results_push;
  ELSE
    allow_in_app := prefs.duel_status_in_app;
    allow_push := prefs.duel_status_push;
  END IF;

  -- In-app record always persisted when category allows (expired is in-app only).
  IF NOT allow_in_app AND p_type <> 'DUEL_EXPIRED' THEN
    RETURN NULL;
  END IF;

  -- DUEL_EXPIRED is in-app only.
  push_ok := p_push_eligible AND allow_push AND p_type <> 'DUEL_EXPIRED';

  INSERT INTO public.player_notifications (
    user_id,
    notification_type,
    duel_id,
    dedupe_key,
    title_key,
    body_data,
    deep_link_data,
    push_eligible,
    push_status
  )
  VALUES (
    p_user_id,
    p_type,
    p_duel_id,
    p_dedupe_key,
    p_title_key,
    COALESCE(p_body_data, '{}'::jsonb),
    p_deep_link_data,
    push_ok,
    CASE WHEN push_ok THEN 'pending' ELSE 'suppressed' END
  )
  ON CONFLICT (user_id, dedupe_key) DO NOTHING
  RETURNING id INTO notif_id;

  IF notif_id IS NULL THEN
    SELECT id INTO notif_id
    FROM public.player_notifications
    WHERE user_id = p_user_id AND dedupe_key = p_dedupe_key;
    RETURN notif_id;
  END IF;

  IF push_ok THEN
    INSERT INTO public.notification_push_outbox (notification_id, user_id, status)
    VALUES (notif_id, p_user_id, 'pending')
    ON CONFLICT (notification_id) DO NOTHING;
  END IF;

  RETURN notif_id;
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_player_notification(
  uuid, text, uuid, text, text, jsonb, jsonb, boolean
) FROM PUBLIC;

-- ---------------------------------------------------------------------------
-- Settlement stats (idempotent)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.apply_async_duel_settlement_stats(p_duel_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  duel public.async_duels%ROWTYPE;
  ca public.async_duel_attempts%ROWTYPE;
  oa public.async_duel_attempts%ROWTYPE;
  challenger_outcome text;
  opponent_outcome text;
BEGIN
  SELECT * INTO duel FROM public.async_duels WHERE id = p_duel_id FOR UPDATE;
  IF NOT FOUND OR duel.status <> 'completed' OR duel.outcome IS NULL THEN
    RETURN;
  END IF;

  SELECT * INTO ca FROM public.async_duel_attempts
  WHERE duel_id = p_duel_id AND participant_role = 'challenger' AND status = 'completed';
  SELECT * INTO oa FROM public.async_duel_attempts
  WHERE duel_id = p_duel_id AND participant_role = 'opponent' AND status = 'completed';

  IF ca.id IS NULL OR oa.id IS NULL THEN
    RETURN;
  END IF;

  IF duel.outcome = 'challenger_win' THEN
    challenger_outcome := 'win';
    opponent_outcome := 'loss';
  ELSIF duel.outcome = 'opponent_win' THEN
    challenger_outcome := 'loss';
    opponent_outcome := 'win';
  ELSE
    challenger_outcome := 'tie';
    opponent_outcome := 'tie';
  END IF;

  INSERT INTO public.duel_stat_events (duel_id, user_id, outcome, score)
  VALUES (p_duel_id, duel.challenger_id, challenger_outcome, COALESCE(ca.score, 0))
  ON CONFLICT (duel_id, user_id) DO NOTHING;

  IF FOUND OR NOT EXISTS (
    SELECT 1 FROM public.duel_stat_events WHERE duel_id = p_duel_id AND user_id = duel.challenger_id
  ) THEN
    NULL; -- conflict path handled below via GET
  END IF;

  -- Recompute aggregates from events for both users (idempotent, safe under retry).
  INSERT INTO public.player_duel_stats (user_id)
  VALUES (duel.challenger_id), (duel.opponent_id)
  ON CONFLICT (user_id) DO NOTHING;

  UPDATE public.player_duel_stats s
  SET
    completed_duels = sub.completed,
    wins = sub.wins,
    losses = sub.losses,
    ties = sub.ties,
    highest_duel_score = sub.highest,
    updated_at = now()
  FROM (
    SELECT
      e.user_id,
      count(*)::integer AS completed,
      count(*) FILTER (WHERE e.outcome = 'win')::integer AS wins,
      count(*) FILTER (WHERE e.outcome = 'loss')::integer AS losses,
      count(*) FILTER (WHERE e.outcome = 'tie')::integer AS ties,
      COALESCE(max(e.score), 0)::integer AS highest
    FROM public.duel_stat_events e
    WHERE e.user_id IN (duel.challenger_id, duel.opponent_id)
    GROUP BY e.user_id
  ) sub
  WHERE s.user_id = sub.user_id;

  INSERT INTO public.duel_stat_events (duel_id, user_id, outcome, score)
  VALUES (p_duel_id, duel.opponent_id, opponent_outcome, COALESCE(oa.score, 0))
  ON CONFLICT (duel_id, user_id) DO NOTHING;

  UPDATE public.player_duel_stats s
  SET
    completed_duels = sub.completed,
    wins = sub.wins,
    losses = sub.losses,
    ties = sub.ties,
    highest_duel_score = sub.highest,
    updated_at = now()
  FROM (
    SELECT
      e.user_id,
      count(*)::integer AS completed,
      count(*) FILTER (WHERE e.outcome = 'win')::integer AS wins,
      count(*) FILTER (WHERE e.outcome = 'loss')::integer AS losses,
      count(*) FILTER (WHERE e.outcome = 'tie')::integer AS ties,
      COALESCE(max(e.score), 0)::integer AS highest
    FROM public.duel_stat_events e
    WHERE e.user_id IN (duel.challenger_id, duel.opponent_id)
    GROUP BY e.user_id
  ) sub
  WHERE s.user_id = sub.user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_async_duel_settlement_stats(uuid) FROM PUBLIC;

-- Fix/replace settlement stats with a cleaner idempotent implementation
CREATE OR REPLACE FUNCTION public.apply_async_duel_settlement_stats(p_duel_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  duel public.async_duels%ROWTYPE;
  ca public.async_duel_attempts%ROWTYPE;
  oa public.async_duel_attempts%ROWTYPE;
  challenger_outcome text;
  opponent_outcome text;
BEGIN
  SELECT * INTO duel FROM public.async_duels WHERE id = p_duel_id FOR UPDATE;
  IF NOT FOUND OR duel.status <> 'completed' OR duel.outcome IS NULL THEN
    RETURN;
  END IF;

  SELECT * INTO ca FROM public.async_duel_attempts
  WHERE duel_id = p_duel_id AND participant_role = 'challenger' AND status = 'completed';
  SELECT * INTO oa FROM public.async_duel_attempts
  WHERE duel_id = p_duel_id AND participant_role = 'opponent' AND status = 'completed';

  IF ca.id IS NULL OR oa.id IS NULL THEN
    RETURN;
  END IF;

  IF duel.outcome = 'challenger_win' THEN
    challenger_outcome := 'win';
    opponent_outcome := 'loss';
  ELSIF duel.outcome = 'opponent_win' THEN
    challenger_outcome := 'loss';
    opponent_outcome := 'win';
  ELSE
    challenger_outcome := 'tie';
    opponent_outcome := 'tie';
  END IF;

  INSERT INTO public.duel_stat_events (duel_id, user_id, outcome, score)
  VALUES
    (p_duel_id, duel.challenger_id, challenger_outcome, COALESCE(ca.score, 0)),
    (p_duel_id, duel.opponent_id, opponent_outcome, COALESCE(oa.score, 0))
  ON CONFLICT (duel_id, user_id) DO NOTHING;

  INSERT INTO public.player_duel_stats (user_id)
  VALUES (duel.challenger_id), (duel.opponent_id)
  ON CONFLICT (user_id) DO NOTHING;

  UPDATE public.player_duel_stats s
  SET
    completed_duels = sub.completed,
    wins = sub.wins,
    losses = sub.losses,
    ties = sub.ties,
    highest_duel_score = sub.highest,
    updated_at = now()
  FROM (
    SELECT
      e.user_id,
      count(*)::integer AS completed,
      count(*) FILTER (WHERE e.outcome = 'win')::integer AS wins,
      count(*) FILTER (WHERE e.outcome = 'loss')::integer AS losses,
      count(*) FILTER (WHERE e.outcome = 'tie')::integer AS ties,
      COALESCE(max(e.score), 0)::integer AS highest
    FROM public.duel_stat_events e
    WHERE e.user_id IN (duel.challenger_id, duel.opponent_id)
    GROUP BY e.user_id
  ) sub
  WHERE s.user_id = sub.user_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- complete_async_duel_attempt — add notifications + stats (same contract)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.complete_async_duel_attempt(
  p_attempt_id uuid,
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
  attempt public.async_duel_attempts%ROWTYPE;
  duel public.async_duels%ROWTYPE;
  other public.async_duel_attempts%ROWTYPE;
  comparison jsonb;
  winner uuid;
  outcome_text text;
  deciding text;
  play_hours integer;
  challenger_name text;
  opponent_name text;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT * INTO attempt FROM public.async_duel_attempts WHERE id = p_attempt_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'DUEL_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;

  IF attempt.user_id IS DISTINCT FROM v_user THEN
    RAISE EXCEPTION 'NOT_PARTICIPANT' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO duel FROM public.async_duels WHERE id = attempt.duel_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'DUEL_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;

  IF attempt.status = 'completed' THEN
    RETURN public.get_async_duel_result(duel.id);
  END IF;

  IF attempt.status <> 'started' THEN
    RAISE EXCEPTION 'INVALID_DUEL_STATE' USING ERRCODE = 'P0001';
  END IF;

  IF p_rules_version IS DISTINCT FROM duel.rules_version
     OR p_deck_version IS DISTINCT FROM duel.deck_version THEN
    RAISE EXCEPTION 'INVALID_RESULT' USING ERRCODE = 'P0001';
  END IF;

  IF p_score IS NULL OR p_score < 0 OR p_completion_ms IS NULL OR p_completion_ms < 0 THEN
    RAISE EXCEPTION 'INVALID_RESULT' USING ERRCODE = 'P0001';
  END IF;

  SELECT COALESCE(display_name::text, 'Blaze Player') INTO challenger_name
  FROM public.profiles WHERE id = duel.challenger_id;
  SELECT COALESCE(display_name::text, 'Blaze Player') INTO opponent_name
  FROM public.profiles WHERE id = duel.opponent_id;

  IF attempt.participant_role = 'challenger' THEN
    IF duel.status <> 'challenger_playing' THEN
      RAISE EXCEPTION 'INVALID_DUEL_STATE' USING ERRCODE = 'P0001';
    END IF;

    PERFORM public.assert_async_duel_transition(duel.status, 'awaiting_opponent');

    UPDATE public.async_duel_attempts
    SET
      status = 'completed',
      completed_at = now(),
      score = p_score,
      exact_21_count = COALESCE(p_exact_21_count, 0),
      five_card_clear_count = COALESCE(p_five_card_clear_count, 0),
      bust_count = COALESCE(p_bust_count, 0),
      cards_played = COALESCE(p_cards_played, 0),
      lanes_cleared = COALESCE(p_lanes_cleared, 0),
      completion_ms = COALESCE(p_completion_ms, 0),
      submission_version = p_submission_version,
      updated_at = now()
    WHERE id = attempt.id
    RETURNING * INTO attempt;

    play_hours := COALESCE(
      (public.async_duel_config()->>'opponentPlayLifetimeHours')::integer,
      72
    );

    UPDATE public.async_duels
    SET
      status = 'awaiting_opponent',
      challenger_completed_at = now(),
      expires_at = now() + make_interval(hours => play_hours),
      updated_at = now()
    WHERE id = duel.id
    RETURNING * INTO duel;

    PERFORM public.enqueue_player_notification(
      duel.opponent_id,
      'DUEL_CHALLENGE_RECEIVED',
      duel.id,
      'duel_challenge_received:' || duel.id::text || ':' || duel.opponent_id::text,
      'NEW_DUEL',
      jsonb_build_object(
        'opponentDisplayName', challenger_name,
        'challengerScore', attempt.score,
        'duelId', duel.id
      ),
      jsonb_build_object('screen', 'AsyncDuelChallengeDetails', 'duelId', duel.id),
      true
    );

    RETURN jsonb_build_object(
      'duelId', duel.id,
      'attemptId', attempt.id,
      'status', duel.status,
      'alreadyCompleted', false,
      'score', attempt.score,
      'settled', false
    );
  END IF;

  IF attempt.participant_role <> 'opponent' THEN
    RAISE EXCEPTION 'NOT_PARTICIPANT' USING ERRCODE = 'P0001';
  END IF;

  IF duel.status <> 'opponent_playing' THEN
    RAISE EXCEPTION 'INVALID_DUEL_STATE' USING ERRCODE = 'P0001';
  END IF;

  IF duel.expires_at <= now() THEN
    PERFORM public.assert_async_duel_transition(duel.status, 'expired');
    UPDATE public.async_duels SET status = 'expired', updated_at = now() WHERE id = duel.id;
    RAISE EXCEPTION 'EXPIRED' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO other
  FROM public.async_duel_attempts
  WHERE duel_id = duel.id
    AND participant_role = 'challenger'
    AND status = 'completed'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'INVALID_DUEL_STATE' USING ERRCODE = 'P0001', DETAIL = 'missing_challenger_result';
  END IF;

  UPDATE public.async_duel_attempts
  SET
    status = 'completed',
    completed_at = now(),
    score = p_score,
    exact_21_count = COALESCE(p_exact_21_count, 0),
    five_card_clear_count = COALESCE(p_five_card_clear_count, 0),
    bust_count = COALESCE(p_bust_count, 0),
    cards_played = COALESCE(p_cards_played, 0),
    lanes_cleared = COALESCE(p_lanes_cleared, 0),
    completion_ms = COALESCE(p_completion_ms, 0),
    submission_version = p_submission_version,
    updated_at = now()
  WHERE id = attempt.id
  RETURNING * INTO attempt;

  comparison := public.compare_async_duel_results(
    other.score,
    other.exact_21_count,
    other.five_card_clear_count,
    other.bust_count,
    other.completion_ms,
    attempt.score,
    attempt.exact_21_count,
    attempt.five_card_clear_count,
    attempt.bust_count,
    attempt.completion_ms
  );

  outcome_text := comparison->>'outcome';
  deciding := comparison->>'decidingField';
  winner := CASE outcome_text
    WHEN 'challenger_win' THEN duel.challenger_id
    WHEN 'opponent_win' THEN duel.opponent_id
    ELSE NULL
  END;

  PERFORM public.assert_async_duel_transition(duel.status, 'completed');

  UPDATE public.async_duels
  SET
    status = 'completed',
    outcome = outcome_text,
    winner_user_id = winner,
    deciding_field = deciding,
    opponent_completed_at = now(),
    settled_at = now(),
    updated_at = now()
  WHERE id = duel.id
  RETURNING * INTO duel;

  PERFORM public.apply_async_duel_settlement_stats(duel.id);

  -- Result notification for challenger (opponent just acted).
  PERFORM public.enqueue_player_notification(
    duel.challenger_id,
    'DUEL_COMPLETED',
    duel.id,
    'duel_completed:' || duel.id::text || ':' || duel.challenger_id::text,
    'DUEL_COMPLETE',
    jsonb_build_object(
      'opponentDisplayName', opponent_name,
      'outcome', duel.outcome,
      'duelId', duel.id
    ),
    jsonb_build_object('screen', 'AsyncDuelResult', 'duelId', duel.id),
    true
  );

  -- No XP / Blaze Coins.
  RETURN public.get_async_duel_result(duel.id);
END;
$$;

CREATE OR REPLACE FUNCTION public.decline_async_duel(p_duel_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  duel public.async_duels%ROWTYPE;
  opponent_name text;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT * INTO duel FROM public.async_duels WHERE id = p_duel_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'DUEL_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;
  IF duel.opponent_id IS DISTINCT FROM v_user THEN
    RAISE EXCEPTION 'NOT_PARTICIPANT' USING ERRCODE = 'P0001';
  END IF;
  IF duel.status = 'declined' THEN
    RETURN jsonb_build_object('duelId', duel.id, 'status', 'declined', 'alreadyDeclined', true);
  END IF;
  IF duel.status <> 'awaiting_opponent' THEN
    RAISE EXCEPTION 'INVALID_DUEL_STATE' USING ERRCODE = 'P0001';
  END IF;

  PERFORM public.assert_async_duel_transition(duel.status, 'declined');

  UPDATE public.async_duels
  SET status = 'declined', updated_at = now()
  WHERE id = duel.id
  RETURNING * INTO duel;

  SELECT COALESCE(display_name::text, 'Blaze Player') INTO opponent_name
  FROM public.profiles WHERE id = duel.opponent_id;

  PERFORM public.enqueue_player_notification(
    duel.challenger_id,
    'DUEL_DECLINED',
    duel.id,
    'duel_declined:' || duel.id::text || ':' || duel.challenger_id::text,
    'CHALLENGE_DECLINED',
    jsonb_build_object(
      'opponentDisplayName', opponent_name,
      'duelId', duel.id
    ),
    jsonb_build_object('screen', 'AsyncDuelChallengeDetails', 'duelId', duel.id),
    true
  );

  RETURN jsonb_build_object('duelId', duel.id, 'status', 'declined', 'alreadyDeclined', false);
END;
$$;

CREATE OR REPLACE FUNCTION public.expire_async_duels(p_now timestamptz DEFAULT now())
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_count integer := 0;
  r record;
BEGIN
  FOR r IN
    UPDATE public.async_duels d
    SET status = 'expired', updated_at = p_now
    WHERE d.status IN ('challenger_playing', 'awaiting_opponent', 'opponent_playing')
      AND d.expires_at <= p_now
    RETURNING d.id, d.challenger_id, d.opponent_id, d.status
  LOOP
    updated_count := updated_count + 1;
    -- In-app only expired notices (push_eligible false via type).
    PERFORM public.enqueue_player_notification(
      r.challenger_id,
      'DUEL_EXPIRED',
      r.id,
      'duel_expired:' || r.id::text || ':' || r.challenger_id::text,
      'CHALLENGE_EXPIRED',
      jsonb_build_object('duelId', r.id),
      jsonb_build_object('screen', 'AsyncDuelChallengeDetails', 'duelId', r.id),
      false
    );
    PERFORM public.enqueue_player_notification(
      r.opponent_id,
      'DUEL_EXPIRED',
      r.id,
      'duel_expired:' || r.id::text || ':' || r.opponent_id::text,
      'CHALLENGE_EXPIRED',
      jsonb_build_object('duelId', r.id),
      jsonb_build_object('screen', 'AsyncDuelChallengeDetails', 'duelId', r.id),
      false
    );
  END LOOP;

  RETURN updated_count;
END;
$$;

-- ---------------------------------------------------------------------------
-- Rematch
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_async_duel_rematch(p_source_duel_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  source public.async_duels%ROWTYPE;
  existing public.async_duels%ROWTYPE;
  other_id uuid;
  cfg jsonb;
  duel public.async_duels%ROWTYPE;
  attempt public.async_duel_attempts%ROWTYPE;
  pending_count integer;
  pair_count integer;
  cooldown_seconds integer;
  invite_hours integer;
  seed_text text;
  root_id uuid;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  PERFORM public.expire_async_duels(now());

  IF NOT public.async_duel_creation_enabled() THEN
    RAISE EXCEPTION 'ASYNC_DUEL_DISABLED' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO source FROM public.async_duels WHERE id = p_source_duel_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'DUEL_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;

  IF source.challenger_id IS DISTINCT FROM v_user AND source.opponent_id IS DISTINCT FROM v_user THEN
    RAISE EXCEPTION 'NOT_PARTICIPANT' USING ERRCODE = 'P0001';
  END IF;

  IF source.status <> 'completed' THEN
    RAISE EXCEPTION 'INVALID_DUEL_STATE' USING ERRCODE = 'P0001';
  END IF;

  -- Idempotent: return existing rematch child if present.
  SELECT * INTO existing FROM public.async_duels WHERE rematch_of_duel_id = source.id;
  IF FOUND THEN
    SELECT * INTO attempt
    FROM public.async_duel_attempts
    WHERE duel_id = existing.id AND participant_role = 'challenger';

    IF attempt.user_id IS DISTINCT FROM v_user THEN
      -- Other participant already created rematch; surface typed conflict.
      RAISE EXCEPTION 'DUPLICATE_ACTIVE_DUEL' USING ERRCODE = 'P0001', DETAIL = 'rematch_exists';
    END IF;

    RETURN jsonb_build_object(
      'duelId', existing.id,
      'attemptId', attempt.id,
      'seed', existing.seed,
      'rulesVersion', existing.rules_version,
      'deckVersion', existing.deck_version,
      'durationSeconds', existing.duration_seconds,
      'bustLimit', existing.bust_limit,
      'status', existing.status,
      'expiresAt', existing.expires_at,
      'participantRole', 'challenger',
      'alreadyStarted', attempt.status <> 'started' OR existing.status <> 'challenger_playing',
      'rematchOfDuelId', source.id,
      'seriesRootDuelId', existing.series_root_duel_id,
      'alreadyExisted', true
    );
  END IF;

  other_id := CASE WHEN source.challenger_id = v_user THEN source.opponent_id ELSE source.challenger_id END;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = other_id) THEN
    RAISE EXCEPTION 'PLAYER_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = other_id) THEN
    RAISE EXCEPTION 'PLAYER_NOT_ELIGIBLE' USING ERRCODE = 'P0001';
  END IF;

  cfg := public.async_duel_config();
  invite_hours := COALESCE((cfg->>'invitationLifetimeHours')::integer, 72);
  cooldown_seconds := COALESCE((cfg->>'creationCooldownSeconds')::integer, 30);

  SELECT count(*) INTO pending_count
  FROM public.async_duels
  WHERE challenger_id = v_user
    AND status IN ('challenger_playing', 'awaiting_opponent', 'opponent_playing');

  IF pending_count >= COALESCE((cfg->>'maxPendingOutgoing')::integer, 5) THEN
    RAISE EXCEPTION 'ACTIVE_DUEL_LIMIT' USING ERRCODE = 'P0001';
  END IF;

  SELECT count(*) INTO pair_count
  FROM public.async_duels
  WHERE (
      (challenger_id = v_user AND opponent_id = other_id)
      OR (challenger_id = other_id AND opponent_id = v_user)
    )
    AND status IN ('challenger_playing', 'awaiting_opponent', 'opponent_playing');

  IF pair_count >= COALESCE((cfg->>'maxActiveBetweenPair')::integer, 1) THEN
    RAISE EXCEPTION 'DUPLICATE_ACTIVE_DUEL' USING ERRCODE = 'P0001';
  END IF;

  root_id := COALESCE(source.series_root_duel_id, source.id);
  seed_text := '21blaze-async-v1:' || gen_random_uuid()::text || ':' || encode(gen_random_bytes(16), 'hex');

  BEGIN
    INSERT INTO public.async_duels (
      challenger_id,
      opponent_id,
      seed,
      rules_version,
      deck_version,
      duration_seconds,
      bust_limit,
      status,
      expires_at,
      target_score_visibility,
      rematch_of_duel_id,
      series_root_duel_id
    )
    VALUES (
      v_user,
      other_id,
      seed_text,
      COALESCE(cfg->>'rulesVersion', '1'),
      COALESCE(cfg->>'deckVersion', '1'),
      COALESCE((cfg->>'durationSeconds')::integer, 120),
      COALESCE((cfg->>'bustLimit')::integer, 3),
      'challenger_playing',
      now() + make_interval(hours => invite_hours),
      COALESCE((cfg->>'targetScoreVisibility')::boolean, true),
      source.id,
      root_id
    )
    RETURNING * INTO duel;
  EXCEPTION
    WHEN unique_violation THEN
      SELECT * INTO existing FROM public.async_duels WHERE rematch_of_duel_id = source.id;
      IF existing.challenger_id = v_user THEN
        SELECT * INTO attempt FROM public.async_duel_attempts
        WHERE duel_id = existing.id AND participant_role = 'challenger';
        RETURN jsonb_build_object(
          'duelId', existing.id,
          'attemptId', attempt.id,
          'seed', existing.seed,
          'rulesVersion', existing.rules_version,
          'deckVersion', existing.deck_version,
          'durationSeconds', existing.duration_seconds,
          'bustLimit', existing.bust_limit,
          'status', existing.status,
          'expiresAt', existing.expires_at,
          'participantRole', 'challenger',
          'alreadyStarted', false,
          'rematchOfDuelId', source.id,
          'seriesRootDuelId', existing.series_root_duel_id,
          'alreadyExisted', true
        );
      END IF;
      RAISE EXCEPTION 'DUPLICATE_ACTIVE_DUEL' USING ERRCODE = 'P0001', DETAIL = 'rematch_race';
  END;

  INSERT INTO public.async_duel_attempts (
    duel_id, user_id, participant_role, status, rules_version, deck_version
  )
  VALUES (
    duel.id, v_user, 'challenger', 'started', duel.rules_version, duel.deck_version
  )
  RETURNING * INTO attempt;

  RETURN jsonb_build_object(
    'duelId', duel.id,
    'attemptId', attempt.id,
    'seed', duel.seed,
    'rulesVersion', duel.rules_version,
    'deckVersion', duel.deck_version,
    'durationSeconds', duel.duration_seconds,
    'bustLimit', duel.bust_limit,
    'status', duel.status,
    'expiresAt', duel.expires_at,
    'participantRole', 'challenger',
    'alreadyStarted', false,
    'rematchOfDuelId', source.id,
    'seriesRootDuelId', root_id,
    'alreadyExisted', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_async_duel_rematch(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_async_duel_rematch(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- Notification client RPCs
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_player_notifications(
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

  SELECT COALESCE(jsonb_agg(row_to_json(x)::jsonb ORDER BY x."createdAt" DESC), '[]'::jsonb)
  INTO items
  FROM (
    SELECT
      n.id,
      n.notification_type AS "notificationType",
      n.duel_id AS "duelId",
      n.title_key AS "titleKey",
      n.body_data AS "bodyData",
      n.deep_link_data AS "deepLinkData",
      n.read_at AS "readAt",
      n.created_at AS "createdAt"
    FROM public.player_notifications n
    WHERE n.user_id = v_user
    ORDER BY n.created_at DESC
    LIMIT safe_limit OFFSET safe_offset
  ) x;

  RETURN jsonb_build_object('items', items, 'limit', safe_limit, 'offset', safe_offset);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_unread_notification_count()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  cnt integer;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  SELECT count(*)::integer INTO cnt
  FROM public.player_notifications
  WHERE user_id = v_user AND read_at IS NULL;
  RETURN jsonb_build_object('count', cnt);
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_notification_read(p_notification_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  n public.player_notifications%ROWTYPE;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  UPDATE public.player_notifications
  SET read_at = COALESCE(read_at, now()), updated_at = now()
  WHERE id = p_notification_id AND user_id = v_user
  RETURNING * INTO n;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_PARTICIPANT' USING ERRCODE = 'P0001';
  END IF;

  RETURN jsonb_build_object('id', n.id, 'readAt', n.read_at);
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_all_notifications_read()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  updated integer;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  UPDATE public.player_notifications
  SET read_at = now(), updated_at = now()
  WHERE user_id = v_user AND read_at IS NULL;

  GET DIAGNOSTICS updated = ROW_COUNT;
  RETURN jsonb_build_object('updated', updated);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_notification_preferences()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  prefs public.notification_preferences%ROWTYPE;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  prefs := public.ensure_notification_preferences(v_user);
  RETURN jsonb_build_object(
    'duelChallengesInApp', prefs.duel_challenges_in_app,
    'duelChallengesPush', prefs.duel_challenges_push,
    'duelResultsInApp', prefs.duel_results_in_app,
    'duelResultsPush', prefs.duel_results_push,
    'duelStatusInApp', prefs.duel_status_in_app,
    'duelStatusPush', prefs.duel_status_push
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.update_notification_preferences(p_prefs jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  PERFORM public.ensure_notification_preferences(v_user);
  UPDATE public.notification_preferences
  SET
    duel_challenges_in_app = COALESCE((p_prefs->>'duelChallengesInApp')::boolean, duel_challenges_in_app),
    duel_challenges_push = COALESCE((p_prefs->>'duelChallengesPush')::boolean, duel_challenges_push),
    duel_results_in_app = COALESCE((p_prefs->>'duelResultsInApp')::boolean, duel_results_in_app),
    duel_results_push = COALESCE((p_prefs->>'duelResultsPush')::boolean, duel_results_push),
    duel_status_in_app = COALESCE((p_prefs->>'duelStatusInApp')::boolean, duel_status_in_app),
    duel_status_push = COALESCE((p_prefs->>'duelStatusPush')::boolean, duel_status_push),
    updated_at = now()
  WHERE user_id = v_user;
  RETURN public.get_notification_preferences();
END;
$$;

CREATE OR REPLACE FUNCTION public.register_device_push_token(
  p_token text,
  p_platform text,
  p_environment text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  row public.device_push_tokens%ROWTYPE;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF p_token IS NULL OR char_length(p_token) < 16 OR char_length(p_token) > 512 THEN
    RAISE EXCEPTION 'INVALID_RESULT' USING ERRCODE = 'P0001', DETAIL = 'token';
  END IF;
  IF p_platform NOT IN ('ios', 'android', 'web') THEN
    RAISE EXCEPTION 'INVALID_RESULT' USING ERRCODE = 'P0001', DETAIL = 'platform';
  END IF;
  IF p_environment NOT IN ('development', 'preview', 'production') THEN
    RAISE EXCEPTION 'INVALID_RESULT' USING ERRCODE = 'P0001', DETAIL = 'environment';
  END IF;

  -- Detach token from other accounts on this device.
  UPDATE public.device_push_tokens
  SET active = false, revoked_at = now(), updated_at = now()
  WHERE push_token = p_token AND user_id IS DISTINCT FROM v_user AND active = true;

  INSERT INTO public.device_push_tokens (user_id, push_token, platform, app_environment, active, last_seen_at)
  VALUES (v_user, p_token, p_platform, p_environment, true, now())
  ON CONFLICT (push_token) DO UPDATE
    SET user_id = v_user,
        platform = EXCLUDED.platform,
        app_environment = EXCLUDED.app_environment,
        active = true,
        revoked_at = NULL,
        last_seen_at = now(),
        updated_at = now()
  RETURNING * INTO row;

  RETURN jsonb_build_object(
    'id', row.id,
    'platform', row.platform,
    'appEnvironment', row.app_environment,
    'active', row.active
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_device_push_token(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  updated integer;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  UPDATE public.device_push_tokens
  SET active = false, revoked_at = now(), updated_at = now()
  WHERE user_id = v_user AND push_token = p_token AND active = true;

  GET DIAGNOSTICS updated = ROW_COUNT;
  RETURN jsonb_build_object('revoked', updated > 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_player_notifications(integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_unread_notification_count() TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_notification_read(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_all_notifications_read() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_notification_preferences() TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_notification_preferences(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.register_device_push_token(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_device_push_token(text) TO authenticated;

-- ---------------------------------------------------------------------------
-- Duel records + head-to-head
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.public_duel_record_json(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s public.player_duel_stats%ROWTYPE;
  win_rate numeric;
BEGIN
  SELECT * INTO s FROM public.player_duel_stats WHERE user_id = p_user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'completedDuels', 0,
      'wins', 0,
      'losses', 0,
      'ties', 0,
      'winRate', null,
      'highestDuelScore', 0
    );
  END IF;

  IF s.completed_duels = 0 THEN
    win_rate := NULL;
  ELSE
    win_rate := round((s.wins::numeric / s.completed_duels::numeric) * 1000) / 10;
  END IF;

  RETURN jsonb_build_object(
    'completedDuels', s.completed_duels,
    'wins', s.wins,
    'losses', s.losses,
    'ties', s.ties,
    'winRate', win_rate,
    'highestDuelScore', s.highest_duel_score
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_player_duel_record(p_profile_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF p_profile_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_profile_id) THEN
    RAISE EXCEPTION 'PLAYER_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;
  RETURN public.public_duel_record_json(p_profile_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_my_duel_record()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  RETURN public.public_duel_record_json(auth.uid());
END;
$$;

CREATE OR REPLACE FUNCTION public.get_head_to_head_record(p_other_player_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  my_wins integer := 0;
  their_wins integer := 0;
  ties integer := 0;
  completed integer := 0;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF p_other_player_id IS NULL OR p_other_player_id = v_user THEN
    RAISE EXCEPTION 'INVALID_RESULT' USING ERRCODE = 'P0001';
  END IF;

  SELECT
    count(*)::integer,
    count(*) FILTER (
      WHERE (d.challenger_id = v_user AND d.outcome = 'challenger_win')
         OR (d.opponent_id = v_user AND d.outcome = 'opponent_win')
    )::integer,
    count(*) FILTER (
      WHERE (d.challenger_id = p_other_player_id AND d.outcome = 'challenger_win')
         OR (d.opponent_id = p_other_player_id AND d.outcome = 'opponent_win')
    )::integer,
    count(*) FILTER (WHERE d.outcome = 'tie')::integer
  INTO completed, my_wins, their_wins, ties
  FROM public.async_duels d
  WHERE d.status = 'completed'
    AND d.outcome IS NOT NULL
    AND (
      (d.challenger_id = v_user AND d.opponent_id = p_other_player_id)
      OR (d.challenger_id = p_other_player_id AND d.opponent_id = v_user)
    );

  RETURN jsonb_build_object(
    'otherPlayerId', p_other_player_id,
    'otherDisplayName', COALESCE(
      (SELECT display_name::text FROM public.profiles WHERE id = p_other_player_id),
      'Blaze Player'
    ),
    'completedDuels', completed,
    'yourWins', my_wins,
    'theirWins', their_wins,
    'ties', ties
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_async_duel_series_summary(p_duel_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  duel public.async_duels%ROWTYPE;
  root_id uuid;
  other_id uuid;
  depth integer := 1;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT * INTO duel FROM public.async_duels WHERE id = p_duel_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'DUEL_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;
  IF duel.challenger_id IS DISTINCT FROM v_user AND duel.opponent_id IS DISTINCT FROM v_user THEN
    RAISE EXCEPTION 'NOT_PARTICIPANT' USING ERRCODE = 'P0001';
  END IF;

  root_id := COALESCE(duel.series_root_duel_id, duel.id);
  other_id := CASE WHEN duel.challenger_id = v_user THEN duel.opponent_id ELSE duel.challenger_id END;

  SELECT count(*)::integer INTO depth
  FROM public.async_duels
  WHERE id = p_duel_id OR rematch_of_duel_id IS NOT NULL AND series_root_duel_id = root_id;

  -- Rematch index: number of rematch links from root to this duel.
  WITH RECURSIVE chain AS (
    SELECT id, rematch_of_duel_id, 1 AS n FROM public.async_duels WHERE id = p_duel_id
    UNION ALL
    SELECT d.id, d.rematch_of_duel_id, c.n + 1
    FROM public.async_duels d
    JOIN chain c ON d.id = c.rematch_of_duel_id
  )
  SELECT COALESCE(max(n), 1) INTO depth FROM chain;

  RETURN jsonb_build_object(
    'duelId', duel.id,
    'rematchOfDuelId', duel.rematch_of_duel_id,
    'seriesRootDuelId', root_id,
    'rematchIndex', depth,
    'headToHead', public.get_head_to_head_record(other_id)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_player_duel_record(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_duel_record() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_head_to_head_record(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_async_duel_series_summary(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- Backfill + reconcile (authenticated can backfill own; full repair service_role)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.backfill_async_duel_stat_events()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  processed integer := 0;
BEGIN
  -- Safe to re-run: apply_async_duel_settlement_stats is idempotent.
  FOR r IN
    SELECT id FROM public.async_duels
    WHERE status = 'completed' AND outcome IS NOT NULL
    ORDER BY settled_at NULLS LAST, updated_at
  LOOP
    PERFORM public.apply_async_duel_settlement_stats(r.id);
    processed := processed + 1;
  END LOOP;

  RETURN jsonb_build_object('processed', processed);
END;
$$;

CREATE OR REPLACE FUNCTION public.reconcile_async_duel_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  mismatches jsonb := '[]'::jsonb;
  s record;
  expected record;
BEGIN
  -- service_role or authenticated for ops; mobile must not call in prod UI.
  FOR s IN SELECT * FROM public.player_duel_stats LOOP
    SELECT
      count(*)::integer AS completed,
      count(*) FILTER (WHERE outcome = 'win')::integer AS wins,
      count(*) FILTER (WHERE outcome = 'loss')::integer AS losses,
      count(*) FILTER (WHERE outcome = 'tie')::integer AS ties,
      COALESCE(max(score), 0)::integer AS highest
    INTO expected
    FROM public.duel_stat_events
    WHERE user_id = s.user_id;

    IF s.completed_duels IS DISTINCT FROM COALESCE(expected.completed, 0)
       OR s.wins IS DISTINCT FROM COALESCE(expected.wins, 0)
       OR s.losses IS DISTINCT FROM COALESCE(expected.losses, 0)
       OR s.ties IS DISTINCT FROM COALESCE(expected.ties, 0)
       OR s.highest_duel_score IS DISTINCT FROM COALESCE(expected.highest, 0) THEN
      mismatches := mismatches || jsonb_build_array(jsonb_build_object(
        'userId', s.user_id,
        'stored', jsonb_build_object(
          'completed', s.completed_duels, 'wins', s.wins, 'losses', s.losses, 'ties', s.ties,
          'highest', s.highest_duel_score
        ),
        'expected', jsonb_build_object(
          'completed', COALESCE(expected.completed, 0),
          'wins', COALESCE(expected.wins, 0),
          'losses', COALESCE(expected.losses, 0),
          'ties', COALESCE(expected.ties, 0),
          'highest', COALESCE(expected.highest, 0)
        )
      ));
    END IF;
  END LOOP;

  RETURN jsonb_build_object('mismatchCount', jsonb_array_length(mismatches), 'mismatches', mismatches);
END;
$$;

CREATE OR REPLACE FUNCTION public.repair_async_duel_stats_from_events()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  repaired integer := 0;
BEGIN
  UPDATE public.player_duel_stats s
  SET
    completed_duels = sub.completed,
    wins = sub.wins,
    losses = sub.losses,
    ties = sub.ties,
    highest_duel_score = sub.highest,
    updated_at = now()
  FROM (
    SELECT
      e.user_id,
      count(*)::integer AS completed,
      count(*) FILTER (WHERE e.outcome = 'win')::integer AS wins,
      count(*) FILTER (WHERE e.outcome = 'loss')::integer AS losses,
      count(*) FILTER (WHERE e.outcome = 'tie')::integer AS ties,
      COALESCE(max(e.score), 0)::integer AS highest
    FROM public.duel_stat_events e
    GROUP BY e.user_id
  ) sub
  WHERE s.user_id = sub.user_id
    AND (
      s.completed_duels IS DISTINCT FROM sub.completed
      OR s.wins IS DISTINCT FROM sub.wins
      OR s.losses IS DISTINCT FROM sub.losses
      OR s.ties IS DISTINCT FROM sub.ties
      OR s.highest_duel_score IS DISTINCT FROM sub.highest
    );

  GET DIAGNOSTICS repaired = ROW_COUNT;
  RETURN jsonb_build_object('repaired', repaired);
END;
$$;

REVOKE ALL ON FUNCTION public.backfill_async_duel_stat_events() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reconcile_async_duel_stats() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.repair_async_duel_stats_from_events() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.backfill_async_duel_stat_events() TO service_role;
GRANT EXECUTE ON FUNCTION public.reconcile_async_duel_stats() TO service_role;
GRANT EXECUTE ON FUNCTION public.repair_async_duel_stats_from_events() TO service_role;

-- ---------------------------------------------------------------------------
-- Push dispatcher helpers (service_role only)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.claim_notification_push_outbox(p_limit integer DEFAULT 20)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  safe_limit integer := LEAST(GREATEST(COALESCE(p_limit, 20), 1), 50);
  items jsonb;
BEGIN
  WITH claimed AS (
    UPDATE public.notification_push_outbox o
    SET status = 'processing', updated_at = now(), attempt_count = attempt_count + 1
    WHERE o.id IN (
      SELECT id FROM public.notification_push_outbox
      WHERE status IN ('pending', 'failed')
        AND next_attempt_at <= now()
        AND attempt_count < 8
      ORDER BY next_attempt_at
      LIMIT safe_limit
      FOR UPDATE SKIP LOCKED
    )
    RETURNING *
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'outboxId', c.id,
    'notificationId', c.notification_id,
    'userId', c.user_id,
    'attemptCount', c.attempt_count,
    'notification', (
      SELECT jsonb_build_object(
        'type', n.notification_type,
        'titleKey', n.title_key,
        'bodyData', n.body_data,
        'deepLinkData', n.deep_link_data,
        'duelId', n.duel_id
      )
      FROM public.player_notifications n WHERE n.id = c.notification_id
    ),
    'tokens', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id', t.id,
        'token', t.push_token,
        'platform', t.platform,
        'appEnvironment', t.app_environment
      )), '[]'::jsonb)
      FROM public.device_push_tokens t
      WHERE t.user_id = c.user_id AND t.active = true AND t.revoked_at IS NULL
    )
  )), '[]'::jsonb)
  INTO items
  FROM claimed c;

  RETURN jsonb_build_object('items', items);
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_notification_push_outbox(
  p_outbox_id uuid,
  p_status text,
  p_provider_message_id text DEFAULT NULL,
  p_error_code text DEFAULT NULL,
  p_invalid_token_ids uuid[] DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  backoff interval;
  row public.notification_push_outbox%ROWTYPE;
BEGIN
  IF p_status NOT IN ('submitted', 'delivered', 'failed', 'suppressed') THEN
    RAISE EXCEPTION 'INVALID_RESULT' USING ERRCODE = 'P0001';
  END IF;

  IF p_invalid_token_ids IS NOT NULL THEN
    UPDATE public.device_push_tokens
    SET active = false, revoked_at = now(), updated_at = now()
    WHERE id = ANY (p_invalid_token_ids);
  END IF;

  SELECT * INTO row FROM public.notification_push_outbox WHERE id = p_outbox_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'DUEL_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;

  IF p_status IN ('submitted', 'delivered', 'suppressed') THEN
    UPDATE public.notification_push_outbox
    SET
      status = p_status,
      provider_message_id = COALESCE(p_provider_message_id, provider_message_id),
      last_error_code = NULL,
      delivered_at = CASE WHEN p_status = 'delivered' THEN now() ELSE delivered_at END,
      updated_at = now()
    WHERE id = p_outbox_id;

    UPDATE public.player_notifications
    SET push_status = p_status, updated_at = now()
    WHERE id = row.notification_id;
  ELSE
    backoff := make_interval(secs => LEAST(3600, power(2, LEAST(row.attempt_count, 10))::integer * 15));
    UPDATE public.notification_push_outbox
    SET
      status = CASE WHEN attempt_count >= 8 THEN 'failed' ELSE 'failed' END,
      next_attempt_at = now() + backoff,
      last_error_code = left(COALESCE(p_error_code, 'unknown'), 120),
      updated_at = now()
    WHERE id = p_outbox_id;

    UPDATE public.player_notifications
    SET push_status = 'failed', updated_at = now()
    WHERE id = row.notification_id;
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.claim_notification_push_outbox(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.complete_notification_push_outbox(uuid, text, text, text, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_notification_push_outbox(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_notification_push_outbox(uuid, text, text, text, uuid[]) TO service_role;

COMMENT ON TABLE public.player_notifications IS
  'v1.4 Phase 3 in-app duel notifications. Inserts only via SECURITY DEFINER helpers.';
COMMENT ON TABLE public.notification_push_outbox IS
  'Push delivery outbox. Settlement never depends on push success.';
COMMENT ON TABLE public.player_duel_stats IS
  'Server-authoritative Async Duel aggregates. Client cannot write.';
COMMENT ON TABLE public.duel_stat_events IS
  'Immutable per-settlement stat events (one per duel+user).';
COMMENT ON FUNCTION public.create_async_duel_rematch IS
  'Creates a new duel from a completed source. Opponent derived server-side. New seed.';

-- Respect in-app preference for all types including DUEL_EXPIRED
CREATE OR REPLACE FUNCTION public.enqueue_player_notification(
  p_user_id uuid,
  p_type text,
  p_duel_id uuid,
  p_dedupe_key text,
  p_title_key text,
  p_body_data jsonb,
  p_deep_link_data jsonb,
  p_push_eligible boolean DEFAULT true
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  prefs public.notification_preferences%ROWTYPE;
  notif_id uuid;
  allow_in_app boolean := true;
  allow_push boolean := true;
  push_ok boolean;
BEGIN
  prefs := public.ensure_notification_preferences(p_user_id);

  IF p_type = 'DUEL_CHALLENGE_RECEIVED' THEN
    allow_in_app := prefs.duel_challenges_in_app;
    allow_push := prefs.duel_challenges_push;
  ELSIF p_type = 'DUEL_COMPLETED' THEN
    allow_in_app := prefs.duel_results_in_app;
    allow_push := prefs.duel_results_push;
  ELSE
    allow_in_app := prefs.duel_status_in_app;
    allow_push := prefs.duel_status_push;
  END IF;

  IF NOT allow_in_app THEN
    RETURN NULL;
  END IF;

  push_ok := p_push_eligible AND allow_push AND p_type <> 'DUEL_EXPIRED';

  INSERT INTO public.player_notifications (
    user_id, notification_type, duel_id, dedupe_key, title_key, body_data,
    deep_link_data, push_eligible, push_status
  )
  VALUES (
    p_user_id, p_type, p_duel_id, p_dedupe_key, p_title_key,
    COALESCE(p_body_data, '{}'::jsonb), p_deep_link_data, push_ok,
    CASE WHEN push_ok THEN 'pending' ELSE 'suppressed' END
  )
  ON CONFLICT (user_id, dedupe_key) DO NOTHING
  RETURNING id INTO notif_id;

  IF notif_id IS NULL THEN
    SELECT id INTO notif_id
    FROM public.player_notifications
    WHERE user_id = p_user_id AND dedupe_key = p_dedupe_key;
    RETURN notif_id;
  END IF;

  IF push_ok THEN
    INSERT INTO public.notification_push_outbox (notification_id, user_id, status)
    VALUES (notif_id, p_user_id, 'pending')
    ON CONFLICT (notification_id) DO NOTHING;
  END IF;

  RETURN notif_id;
END;
$$;
