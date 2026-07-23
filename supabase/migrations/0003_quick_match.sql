-- Live Duel Beta 0.3B — casual Quick Match
-- Safe to re-run where practical.

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- ---------------------------------------------------------------------------
-- Extend live_matches for quick_match mode + history snapshots
-- ---------------------------------------------------------------------------
ALTER TABLE public.live_matches
  DROP CONSTRAINT IF EXISTS live_matches_mode_check;

ALTER TABLE public.live_matches
  ADD CONSTRAINT live_matches_mode_check
  CHECK (mode IN ('friend', 'quick_match'));

ALTER TABLE public.live_match_players
  ADD COLUMN IF NOT EXISTS display_name_snapshot text;

-- ---------------------------------------------------------------------------
-- Matchmaking queue
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.matchmaking_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  mode text NOT NULL DEFAULT 'casual',
  status text NOT NULL DEFAULT 'queued',
  region text,
  game_rules_version text NOT NULL,
  queued_at timestamptz NOT NULL DEFAULT now(),
  matched_at timestamptz,
  expires_at timestamptz NOT NULL,
  match_id uuid REFERENCES public.live_matches (id),
  cancelled_at timestamptz,
  last_check_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT matchmaking_queue_mode_check CHECK (mode IN ('casual')),
  CONSTRAINT matchmaking_queue_status_check CHECK (
    status IN ('queued', 'matched', 'accepted', 'cancelled', 'expired', 'failed')
  ),
  CONSTRAINT matchmaking_queue_region_check CHECK (
    region IS NULL
    OR region IN (
      'us-east',
      'us-central',
      'us-west',
      'europe',
      'asia-pacific',
      'unknown'
    )
  )
);

CREATE INDEX IF NOT EXISTS matchmaking_queue_queued_order_idx
  ON public.matchmaking_queue (queued_at ASC)
  WHERE status = 'queued';

CREATE INDEX IF NOT EXISTS matchmaking_queue_status_idx
  ON public.matchmaking_queue (status);

CREATE INDEX IF NOT EXISTS matchmaking_queue_region_idx
  ON public.matchmaking_queue (region);

CREATE INDEX IF NOT EXISTS matchmaking_queue_rules_idx
  ON public.matchmaking_queue (game_rules_version);

CREATE INDEX IF NOT EXISTS matchmaking_queue_user_id_idx
  ON public.matchmaking_queue (user_id);

CREATE INDEX IF NOT EXISTS matchmaking_queue_match_id_idx
  ON public.matchmaking_queue (match_id);

CREATE INDEX IF NOT EXISTS matchmaking_queue_expires_at_idx
  ON public.matchmaking_queue (expires_at);

CREATE UNIQUE INDEX IF NOT EXISTS matchmaking_queue_one_active_per_user_idx
  ON public.matchmaking_queue (user_id)
  WHERE status IN ('queued', 'matched', 'accepted');

-- ---------------------------------------------------------------------------
-- Acceptance records
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.quick_match_acceptances (
  match_id uuid NOT NULL REFERENCES public.live_matches (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  accepted_at timestamptz,
  declined_at timestamptz,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (match_id, user_id)
);

CREATE INDEX IF NOT EXISTS quick_match_acceptances_expires_at_idx
  ON public.quick_match_acceptances (expires_at);

-- ---------------------------------------------------------------------------
-- History foundation view (public fields only)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.live_match_history
WITH (security_invoker = true)
AS
SELECT
  m.id AS match_id,
  m.mode,
  m.status,
  m.winner_user_id,
  m.finish_reason,
  m.completed_at,
  m.created_at,
  self.user_id AS viewer_user_id,
  self.display_name_snapshot AS viewer_display_name,
  self.verified_score AS viewer_score,
  self.verified_lanes_cleared AS viewer_lanes_cleared,
  self.verified_cards_played AS viewer_cards_played,
  self.verified_busts AS viewer_busts,
  self.verified_time_remaining_seconds AS viewer_time_remaining_seconds,
  self.result AS viewer_result,
  opp.user_id AS opponent_user_id,
  opp.display_name_snapshot AS opponent_display_name,
  opp.verified_score AS opponent_score,
  opp.verified_lanes_cleared AS opponent_lanes_cleared,
  opp.verified_cards_played AS opponent_cards_played,
  opp.verified_busts AS opponent_busts,
  opp.verified_time_remaining_seconds AS opponent_time_remaining_seconds,
  opp.result AS opponent_result
FROM public.live_matches m
INNER JOIN public.live_match_players self ON self.match_id = m.id
LEFT JOIN public.live_match_players opp
  ON opp.match_id = m.id
 AND opp.user_id <> self.user_id
WHERE m.status IN ('completed', 'forfeited')
  AND m.mode IN ('friend', 'quick_match');

-- ---------------------------------------------------------------------------
-- Transactional matcher (service_role / SECURITY DEFINER only)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.try_create_quick_match(
  requesting_user_id uuid,
  requesting_region text,
  requesting_game_rules_version text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  requester public.matchmaking_queue%ROWTYPE;
  opponent public.matchmaking_queue%ROWTYPE;
  new_match_id uuid;
  room_code text;
  seed integer;
  acceptance_deadline timestamptz;
  match_expires timestamptz;
  requester_name text;
  opponent_name text;
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  i integer;
  prefer_same_region boolean;
  seat1_user uuid;
  seat2_user uuid;
  seat1_name text;
  seat2_name text;
  seat1_queue uuid;
  seat2_queue uuid;
  found_opponent boolean := false;
BEGIN
  IF requesting_user_id IS NULL OR requesting_game_rules_version IS NULL THEN
    RETURN NULL;
  END IF;

  -- Expire stale queued rows.
  UPDATE public.matchmaking_queue
  SET status = 'expired',
      cancelled_at = COALESCE(cancelled_at, now())
  WHERE status = 'queued'
    AND expires_at <= now();

  -- Lock requester active queue row.
  SELECT *
  INTO requester
  FROM public.matchmaking_queue
  WHERE user_id = requesting_user_id
    AND status = 'queued'
    AND expires_at > now()
  ORDER BY queued_at ASC
  FOR UPDATE SKIP LOCKED
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- Already matched while waiting for lock.
  IF requester.match_id IS NOT NULL THEN
    RETURN requester.match_id;
  END IF;

  prefer_same_region :=
    (now() - requester.queued_at) < interval '15 seconds'
    AND requesting_region IS NOT NULL
    AND requesting_region <> 'unknown';

  IF prefer_same_region THEN
    SELECT *
    INTO opponent
    FROM public.matchmaking_queue q
    WHERE q.status = 'queued'
      AND q.expires_at > now()
      AND q.user_id <> requesting_user_id
      AND q.mode = 'casual'
      AND q.game_rules_version = requesting_game_rules_version
      AND q.region IS NOT DISTINCT FROM requesting_region
    ORDER BY q.queued_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT 1;

    IF FOUND THEN
      found_opponent := true;
    END IF;
  END IF;

  IF NOT found_opponent THEN
    SELECT *
    INTO opponent
    FROM public.matchmaking_queue q
    WHERE q.status = 'queued'
      AND q.expires_at > now()
      AND q.user_id <> requesting_user_id
      AND q.mode = 'casual'
      AND q.game_rules_version = requesting_game_rules_version
    ORDER BY q.queued_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT 1;

    IF FOUND THEN
      found_opponent := true;
    END IF;
  END IF;

  IF NOT found_opponent THEN
    RETURN NULL;
  END IF;

  -- Deterministic seats: earlier queue gets seat 1 / host.
  IF requester.queued_at <= opponent.queued_at THEN
    seat1_user := requester.user_id;
    seat2_user := opponent.user_id;
    seat1_queue := requester.id;
    seat2_queue := opponent.id;
  ELSE
    seat1_user := opponent.user_id;
    seat2_user := requester.user_id;
    seat1_queue := opponent.id;
    seat2_queue := requester.id;
  END IF;

  SELECT display_name::text INTO requester_name
  FROM public.profiles WHERE id = requester.user_id;
  SELECT display_name::text INTO opponent_name
  FROM public.profiles WHERE id = opponent.user_id;

  IF seat1_user = requester.user_id THEN
    seat1_name := COALESCE(requester_name, 'Blazer');
    seat2_name := COALESCE(opponent_name, 'Blazer');
  ELSE
    seat1_name := COALESCE(opponent_name, 'Blazer');
    seat2_name := COALESCE(requester_name, 'Blazer');
  END IF;

  -- Secure signed 32-bit seed.
  seed := (get_byte(gen_random_bytes(4), 0)::integer << 24)
        | (get_byte(gen_random_bytes(4), 1)::integer << 16)
        | (get_byte(gen_random_bytes(4), 2)::integer << 8)
        | get_byte(gen_random_bytes(4), 3)::integer;
  seed := (seed % 2147483647);

  -- Unique room code (not player-facing for quick match, but required by schema).
  LOOP
    room_code := '';
    FOR i IN 1..6 LOOP
      room_code := room_code || substr(
        alphabet,
        1 + (get_byte(gen_random_bytes(1), 0) % length(alphabet)),
        1
      );
    END LOOP;
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.live_matches lm WHERE lm.room_code = room_code::extensions.citext
    );
  END LOOP;

  acceptance_deadline := now() + interval '12 seconds';
  match_expires := now() + interval '10 minutes';

  INSERT INTO public.live_matches (
    room_code,
    mode,
    status,
    seed,
    host_user_id,
    expires_at
  )
  VALUES (
    room_code::extensions.citext,
    'quick_match',
    'ready',
    seed,
    seat1_user,
    match_expires
  )
  RETURNING id INTO new_match_id;

  INSERT INTO public.live_match_players (
    match_id, user_id, seat, last_seen_at, display_name_snapshot
  ) VALUES
    (new_match_id, seat1_user, 1, now(), seat1_name),
    (new_match_id, seat2_user, 2, now(), seat2_name);

  INSERT INTO public.quick_match_acceptances (
    match_id, user_id, expires_at
  ) VALUES
    (new_match_id, seat1_user, acceptance_deadline),
    (new_match_id, seat2_user, acceptance_deadline);

  UPDATE public.matchmaking_queue
  SET status = 'matched',
      matched_at = now(),
      match_id = new_match_id,
      last_check_at = now()
  WHERE id IN (seat1_queue, seat2_queue)
    AND status = 'queued';

  RETURN new_match_id;
END;
$$;

REVOKE ALL ON FUNCTION public.try_create_quick_match(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.try_create_quick_match(uuid, text, text) TO service_role;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.matchmaking_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quick_match_acceptances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "matchmaking_queue_select_own" ON public.matchmaking_queue;
CREATE POLICY "matchmaking_queue_select_own"
  ON public.matchmaking_queue
  FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "quick_match_acceptances_select_participants"
  ON public.quick_match_acceptances;
CREATE POLICY "quick_match_acceptances_select_participants"
  ON public.quick_match_acceptances
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.live_match_players p
      WHERE p.match_id = quick_match_acceptances.match_id
        AND p.user_id = (SELECT auth.uid())
    )
  );

GRANT SELECT ON public.matchmaking_queue TO authenticated;
GRANT SELECT ON public.quick_match_acceptances TO authenticated;
GRANT SELECT ON public.live_match_history TO authenticated;

REVOKE INSERT, UPDATE, DELETE ON public.matchmaking_queue FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.quick_match_acceptances FROM authenticated, anon;
