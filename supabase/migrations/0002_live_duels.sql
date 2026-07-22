-- Live Duel Beta 0.3 — private friend matches
-- Safe to re-run where practical.

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS citext WITH SCHEMA extensions;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.live_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_code extensions.citext NOT NULL,
  mode text NOT NULL DEFAULT 'friend',
  status text NOT NULL,
  seed integer NOT NULL,
  host_user_id uuid NOT NULL REFERENCES auth.users (id),
  starts_at timestamptz,
  ends_at timestamptz,
  expires_at timestamptz NOT NULL,
  winner_user_id uuid REFERENCES auth.users (id),
  finish_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  CONSTRAINT live_matches_mode_check CHECK (mode IN ('friend')),
  CONSTRAINT live_matches_status_check CHECK (
    status IN (
      'waiting',
      'ready',
      'countdown',
      'running',
      'awaiting_results',
      'completed',
      'cancelled',
      'forfeited',
      'expired'
    )
  ),
  CONSTRAINT live_matches_room_code_format CHECK (
    room_code::text ~ '^[A-HJ-NP-Z2-9]{6}$'
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS live_matches_room_code_unique_idx
  ON public.live_matches (room_code);

CREATE INDEX IF NOT EXISTS live_matches_status_idx
  ON public.live_matches (status);

CREATE INDEX IF NOT EXISTS live_matches_host_user_id_idx
  ON public.live_matches (host_user_id);

CREATE INDEX IF NOT EXISTS live_matches_expires_at_idx
  ON public.live_matches (expires_at);

CREATE TABLE IF NOT EXISTS public.live_match_players (
  match_id uuid NOT NULL REFERENCES public.live_matches (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  seat smallint NOT NULL,
  ready_at timestamptz,
  joined_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz,
  disconnected_at timestamptz,
  submitted_at timestamptz,
  verified_score integer,
  verified_lanes_cleared integer,
  verified_cards_played integer,
  verified_busts integer,
  verified_time_remaining_seconds integer,
  verified_move_log jsonb,
  result text NOT NULL DEFAULT 'pending',
  PRIMARY KEY (match_id, user_id),
  CONSTRAINT live_match_players_seat_check CHECK (seat IN (1, 2)),
  CONSTRAINT live_match_players_result_check CHECK (
    result IN (
      'pending',
      'win',
      'loss',
      'draw',
      'forfeit_win',
      'forfeit_loss'
    )
  ),
  CONSTRAINT live_match_players_score_check CHECK (
    verified_score IS NULL OR verified_score >= 0
  ),
  CONSTRAINT live_match_players_lanes_check CHECK (
    verified_lanes_cleared IS NULL OR verified_lanes_cleared >= 0
  ),
  CONSTRAINT live_match_players_cards_check CHECK (
    verified_cards_played IS NULL OR verified_cards_played BETWEEN 0 AND 52
  ),
  CONSTRAINT live_match_players_busts_check CHECK (
    verified_busts IS NULL OR verified_busts BETWEEN 0 AND 3
  ),
  CONSTRAINT live_match_players_time_check CHECK (
    verified_time_remaining_seconds IS NULL
    OR verified_time_remaining_seconds BETWEEN 0 AND 120
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS live_match_players_match_seat_unique_idx
  ON public.live_match_players (match_id, seat);

CREATE INDEX IF NOT EXISTS live_match_players_user_id_idx
  ON public.live_match_players (user_id);

-- Enforce max two players per match.
CREATE OR REPLACE FUNCTION public.enforce_live_match_player_limit()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  player_count integer;
BEGIN
  SELECT count(*) INTO player_count
  FROM public.live_match_players
  WHERE match_id = NEW.match_id;

  IF player_count >= 2 THEN
    RAISE EXCEPTION 'Live matches allow at most two players.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS live_match_players_limit ON public.live_match_players;
CREATE TRIGGER live_match_players_limit
  BEFORE INSERT ON public.live_match_players
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_live_match_player_limit();

-- ---------------------------------------------------------------------------
-- RLS — clients read only; Edge Functions (service role) manage writes
-- ---------------------------------------------------------------------------
ALTER TABLE public.live_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_match_players ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "live_matches_select_participants" ON public.live_matches;
CREATE POLICY "live_matches_select_participants"
  ON public.live_matches
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.live_match_players p
      WHERE p.match_id = live_matches.id
        AND p.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "live_match_players_select_participants" ON public.live_match_players;
CREATE POLICY "live_match_players_select_participants"
  ON public.live_match_players
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.live_match_players self
      WHERE self.match_id = live_match_players.match_id
        AND self.user_id = (SELECT auth.uid())
    )
  );

GRANT SELECT ON public.live_matches TO authenticated;
GRANT SELECT ON public.live_match_players TO authenticated;

REVOKE INSERT, UPDATE, DELETE ON public.live_matches FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.live_match_players FROM authenticated, anon;

-- ---------------------------------------------------------------------------
-- Realtime Authorization — private topics: live-match:{matchId}
-- ---------------------------------------------------------------------------
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_live_match_participant(topic text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.live_match_players p
    WHERE p.user_id = (SELECT auth.uid())
      AND topic = 'live-match:' || p.match_id::text
  );
$$;

REVOKE ALL ON FUNCTION public.is_live_match_participant(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_live_match_participant(text) TO authenticated;

DROP POLICY IF EXISTS "live_match_realtime_select" ON realtime.messages;
CREATE POLICY "live_match_realtime_select"
  ON realtime.messages
  FOR SELECT
  TO authenticated
  USING (
    public.is_live_match_participant((SELECT realtime.topic()))
    AND realtime.messages.extension IN ('broadcast', 'presence')
  );

DROP POLICY IF EXISTS "live_match_realtime_insert" ON realtime.messages;
CREATE POLICY "live_match_realtime_insert"
  ON realtime.messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_live_match_participant((SELECT realtime.topic()))
    AND realtime.messages.extension IN ('broadcast', 'presence')
  );
