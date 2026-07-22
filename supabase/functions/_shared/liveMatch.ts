import {
  applyMissionProgressFromMatch,
  grantMatchXp,
  tryBuildMatchSummaryFromMoveLog,
  type MatchXpMode,
} from './progression.ts';
import type { createServiceClient } from './supabaseAdmin.ts';

export const LIVE_MATCH_DURATION_SECONDS = 120;
export const LIVE_COUNTDOWN_SECONDS = 5;
export const LIVE_ROOM_TTL_MS = 10 * 60 * 1000;
export const LIVE_RECONNECT_GRACE_MS = 20_000;
export const LIVE_RESULT_GRACE_MS = 30_000;

const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export type LiveMatchStatus =
  | 'waiting'
  | 'ready'
  | 'countdown'
  | 'running'
  | 'awaiting_results'
  | 'completed'
  | 'cancelled'
  | 'forfeited'
  | 'expired';

export type LivePlayerResult =
  | 'pending'
  | 'win'
  | 'loss'
  | 'draw'
  | 'forfeit_win'
  | 'forfeit_loss';

export type LiveMatchRow = {
  id: string;
  room_code: string;
  mode: string;
  status: LiveMatchStatus;
  seed: number;
  host_user_id: string;
  starts_at: string | null;
  ends_at: string | null;
  expires_at: string;
  winner_user_id: string | null;
  finish_reason: string | null;
  created_at: string;
  completed_at: string | null;
};

export type LivePlayerRow = {
  match_id: string;
  user_id: string;
  seat: number;
  ready_at: string | null;
  joined_at: string;
  last_seen_at: string | null;
  disconnected_at: string | null;
  submitted_at: string | null;
  verified_score: number | null;
  verified_lanes_cleared: number | null;
  verified_cards_played: number | null;
  verified_busts: number | null;
  verified_time_remaining_seconds: number | null;
  verified_move_log?: unknown;
  display_name_snapshot?: string | null;
  result: LivePlayerResult;
};

export type VerifiedLiveResult = {
  score: number;
  lanesCleared: number;
  cardsPlayed: number;
  busts: number;
  timeRemainingSeconds: number;
};

type AdminClient = ReturnType<typeof createServiceClient>;

function liveXpMode(mode: string): MatchXpMode {
  return mode === 'ranked' ? 'ranked' : 'casual';
}

async function grantLiveProgressionSilent(
  admin: AdminClient,
  match: LiveMatchRow,
  players: LivePlayerRow[],
): Promise<void> {
  if (match.status === 'cancelled' || match.status === 'forfeited') {
    return;
  }

  // Only grant for valid completed score matches (not forfeit / no-contest).
  if (match.status !== 'completed') {
    return;
  }

  const finish = match.finish_reason;
  if (
    finish === 'disconnect_forfeit' ||
    finish === 'missing_result' ||
    finish === 'forfeit'
  ) {
    return;
  }

  const xpMode = liveXpMode(match.mode);

  for (const player of players) {
    if (
      !player.submitted_at ||
      player.verified_score === null ||
      player.result === 'forfeit_loss' ||
      player.result === 'forfeit_win'
    ) {
      continue;
    }

    try {
      await grantMatchXp(admin, player.user_id, xpMode, match.id);
    } catch {
      // Idempotent retry later.
    }

    try {
      const summary = tryBuildMatchSummaryFromMoveLog(
        match.seed,
        player.verified_move_log,
        {
          matchMode: xpMode,
          matchCompleted: true,
          validCompletion: true,
          lanesClearedFallback: player.verified_lanes_cleared ?? 0,
        },
      );
      await applyMissionProgressFromMatch(
        admin,
        player.user_id,
        match.id,
        summary,
      );
    } catch {
      // Silent — mission progress is idempotent per match.
    }
  }
}

export function randomSeed(): number {
  const bytes = new Uint32Array(1);
  crypto.getRandomValues(bytes);
  return (bytes[0] % 0x80000000) | 0;
}

export function generateRoomCode(): string {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  let code = '';
  for (let index = 0; index < 6; index += 1) {
    code += ROOM_CODE_ALPHABET[bytes[index]! % ROOM_CODE_ALPHABET.length];
  }
  return code;
}

export function normalizeRoomCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^A-HJ-NP-Z2-9]/g, '');
}

export function liveTopic(matchId: string): string {
  return `live-match:${matchId}`;
}

export function compareVerifiedResults(
  a: VerifiedLiveResult,
  b: VerifiedLiveResult,
): number {
  if (a.score !== b.score) {
    return a.score - b.score;
  }
  if (a.lanesCleared !== b.lanesCleared) {
    return a.lanesCleared - b.lanesCleared;
  }
  if (a.cardsPlayed !== b.cardsPlayed) {
    return a.cardsPlayed - b.cardsPlayed;
  }
  if (a.busts !== b.busts) {
    return b.busts - a.busts; // fewer busts wins
  }
  return a.timeRemainingSeconds - b.timeRemainingSeconds;
}

export async function broadcastLiveEvent(
  matchId: string,
  event: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const url = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceRoleKey) {
    return;
  }

  await fetch(`${url}/realtime/v1/api/broadcast`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      apikey: serviceRoleKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messages: [
        {
          topic: liveTopic(matchId),
          event,
          payload,
          private: true,
        },
      ],
    }),
  }).catch(() => undefined);
}

export async function touchLastSeen(
  admin: AdminClient,
  matchId: string,
  userId: string,
): Promise<void> {
  const nowIso = new Date().toISOString();
  await admin
    .from('live_match_players')
    .update({
      last_seen_at: nowIso,
      disconnected_at: null,
    })
    .eq('match_id', matchId)
    .eq('user_id', userId);
}

export async function loadMatchWithPlayers(
  admin: AdminClient,
  matchId: string,
): Promise<{ match: LiveMatchRow; players: LivePlayerRow[] } | null> {
  const { data: match, error } = await admin
    .from('live_matches')
    .select('*')
    .eq('id', matchId)
    .maybeSingle();

  if (error || !match) {
    return null;
  }

  const { data: players, error: playersError } = await admin
    .from('live_match_players')
    .select('*')
    .eq('match_id', matchId)
    .order('seat', { ascending: true });

  if (playersError || !players) {
    return null;
  }

  return {
    match: match as LiveMatchRow,
    players: players as LivePlayerRow[],
  };
}

export async function expireStaleWaitingRooms(
  admin: AdminClient,
): Promise<void> {
  const nowIso = new Date().toISOString();
  await admin
    .from('live_matches')
    .update({
      status: 'expired',
      finish_reason: 'expired',
      completed_at: nowIso,
    })
    .eq('status', 'waiting')
    .lt('expires_at', nowIso);
}

export async function applyDisconnectForfeits(
  admin: AdminClient,
  matchId: string,
): Promise<boolean> {
  const loaded = await loadMatchWithPlayers(admin, matchId);
  if (!loaded) {
    return false;
  }

  const { match, players } = loaded;
  if (
    match.status !== 'countdown' &&
    match.status !== 'running' &&
    match.status !== 'awaiting_results'
  ) {
    return false;
  }

  const now = Date.now();
  let changed = false;

  for (const player of players) {
    if (player.result !== 'pending') {
      continue;
    }
    if (player.submitted_at) {
      continue;
    }

    const lastSeenMs = player.last_seen_at
      ? Date.parse(player.last_seen_at)
      : Date.parse(player.joined_at);

    if (!Number.isFinite(lastSeenMs)) {
      continue;
    }

    if (now - lastSeenMs < LIVE_RECONNECT_GRACE_MS) {
      continue;
    }

    const opponent = players.find((item) => item.user_id !== player.user_id);
    if (!opponent) {
      continue;
    }

    const completedAt = new Date().toISOString();
    await admin
      .from('live_match_players')
      .update({ result: 'forfeit_loss', disconnected_at: completedAt })
      .eq('match_id', matchId)
      .eq('user_id', player.user_id);

    await admin
      .from('live_match_players')
      .update({ result: 'forfeit_win' })
      .eq('match_id', matchId)
      .eq('user_id', opponent.user_id);

    await admin
      .from('live_matches')
      .update({
        status: 'forfeited',
        winner_user_id: opponent.user_id,
        finish_reason: 'disconnect_forfeit',
        completed_at: completedAt,
      })
      .eq('id', matchId);

    await broadcastLiveEvent(matchId, 'player_forfeited', {
      userId: player.user_id,
      winnerUserId: opponent.user_id,
      reason: 'disconnect',
    });
  await broadcastLiveEvent(matchId, 'match_completed', {
      winnerUserId: opponent.user_id,
      finishReason: 'disconnect_forfeit',
    });

    const { maybeFinalizeRankedMatch } = await import('./rankedHelpers.ts');
    await maybeFinalizeRankedMatch(
      admin,
      matchId,
      match.mode,
      'forfeited',
      match.starts_at,
    );

    changed = true;
    break;
  }

  return changed;
}

export async function finalizeIfBothSubmitted(
  admin: AdminClient,
  matchId: string,
): Promise<void> {
  const loaded = await loadMatchWithPlayers(admin, matchId);
  if (!loaded) {
    return;
  }

  const { match, players } = loaded;
  if (match.status === 'completed' || match.status === 'forfeited') {
    if (match.status === 'completed') {
      try {
        await grantLiveProgressionSilent(admin, match, players);
      } catch {
        // Swallow progression errors on idempotent path.
      }
    }
    return;
  }

  if (players.length !== 2) {
    return;
  }

  const [a, b] = players;
  if (!a || !b) {
    return;
  }

  // Handle prior forfeit already stored on a player.
  if (a.result === 'forfeit_loss' || b.result === 'forfeit_loss') {
    return;
  }

  if (!a.submitted_at || !b.submitted_at) {
    const endsAtMs = match.ends_at ? Date.parse(match.ends_at) : NaN;
    if (
      Number.isFinite(endsAtMs) &&
      Date.now() > endsAtMs + LIVE_RESULT_GRACE_MS
    ) {
      await finalizeMissingOpponent(admin, matchId);
    }
    return;
  }

  if (
    a.verified_score === null ||
    b.verified_score === null ||
    a.verified_lanes_cleared === null ||
    b.verified_lanes_cleared === null ||
    a.verified_cards_played === null ||
    b.verified_cards_played === null ||
    a.verified_busts === null ||
    b.verified_busts === null ||
    a.verified_time_remaining_seconds === null ||
    b.verified_time_remaining_seconds === null
  ) {
    return;
  }

  const left: VerifiedLiveResult = {
    score: a.verified_score,
    lanesCleared: a.verified_lanes_cleared,
    cardsPlayed: a.verified_cards_played,
    busts: a.verified_busts,
    timeRemainingSeconds: a.verified_time_remaining_seconds,
  };
  const right: VerifiedLiveResult = {
    score: b.verified_score,
    lanesCleared: b.verified_lanes_cleared,
    cardsPlayed: b.verified_cards_played,
    busts: b.verified_busts,
    timeRemainingSeconds: b.verified_time_remaining_seconds,
  };

  const cmp = compareVerifiedResults(left, right);
  let winnerUserId: string | null = null;
  let aResult: LivePlayerResult = 'draw';
  let bResult: LivePlayerResult = 'draw';

  if (cmp > 0) {
    winnerUserId = a.user_id;
    aResult = 'win';
    bResult = 'loss';
  } else if (cmp < 0) {
    winnerUserId = b.user_id;
    aResult = 'loss';
    bResult = 'win';
  }

  const completedAt = new Date().toISOString();
  await admin
    .from('live_match_players')
    .update({ result: aResult })
    .eq('match_id', matchId)
    .eq('user_id', a.user_id);
  await admin
    .from('live_match_players')
    .update({ result: bResult })
    .eq('match_id', matchId)
    .eq('user_id', b.user_id);

  await admin
    .from('live_matches')
    .update({
      status: 'completed',
      winner_user_id: winnerUserId,
      finish_reason: winnerUserId ? 'score' : 'draw',
      completed_at: completedAt,
    })
    .eq('id', matchId);

  await broadcastLiveEvent(matchId, 'match_completed', {
    winnerUserId,
    finishReason: winnerUserId ? 'score' : 'draw',
  });

  const { maybeFinalizeRankedMatch } = await import('./rankedHelpers.ts');
  await maybeFinalizeRankedMatch(
    admin,
    matchId,
    match.mode,
    'completed',
    match.starts_at,
  );

  try {
    await grantLiveProgressionSilent(
      admin,
      {
        ...match,
        status: 'completed',
        winner_user_id: winnerUserId,
        finish_reason: winnerUserId ? 'score' : 'draw',
        completed_at: completedAt,
      },
      [
        { ...a, result: aResult },
        { ...b, result: bResult },
      ],
    );
  } catch {
    // Swallow all progression errors.
  }
}

async function finalizeMissingOpponent(
  admin: AdminClient,
  matchId: string,
): Promise<void> {
  const loaded = await loadMatchWithPlayers(admin, matchId);
  if (!loaded || loaded.players.length !== 2) {
    return;
  }

  const submitted = loaded.players.filter((player) => player.submitted_at);
  const missing = loaded.players.filter((player) => !player.submitted_at);

  if (submitted.length !== 1 || missing.length !== 1) {
    return;
  }

  const winner = submitted[0]!;
  const loser = missing[0]!;
  const completedAt = new Date().toISOString();

  await admin
    .from('live_match_players')
    .update({ result: 'forfeit_win' })
    .eq('match_id', matchId)
    .eq('user_id', winner.user_id);
  await admin
    .from('live_match_players')
    .update({ result: 'forfeit_loss' })
    .eq('match_id', matchId)
    .eq('user_id', loser.user_id);
  await admin
    .from('live_matches')
    .update({
      status: 'forfeited',
      winner_user_id: winner.user_id,
      finish_reason: 'missing_result',
      completed_at: completedAt,
    })
    .eq('id', matchId);

  await broadcastLiveEvent(matchId, 'match_completed', {
    winnerUserId: winner.user_id,
    finishReason: 'missing_result',
  });

  const { maybeFinalizeRankedMatch } = await import('./rankedHelpers.ts');
  await maybeFinalizeRankedMatch(
    admin,
    matchId,
    loaded.match.mode,
    'forfeited',
    loaded.match.starts_at,
  );
}

export async function buildPublicMatchState(
  admin: AdminClient,
  matchId: string,
  viewerId: string,
): Promise<Record<string, unknown> | null> {
  await applyDisconnectForfeits(admin, matchId);
  const loaded = await loadMatchWithPlayers(admin, matchId);
  if (!loaded) {
    return null;
  }

  const self = loaded.players.find((player) => player.user_id === viewerId);
  if (!self) {
    return null;
  }

  const opponent = loaded.players.find((player) => player.user_id !== viewerId);
  let opponentProfile: { userId: string; displayName: string; seat: number } | null =
    null;

  if (opponent) {
    const { data: profile } = await admin
      .from('profiles')
      .select('display_name')
      .eq('id', opponent.user_id)
      .maybeSingle();

    opponentProfile = {
      userId: opponent.user_id,
      displayName: profile ? String(profile.display_name) : 'Opponent',
      seat: opponent.seat,
    };
  }

  const { data: selfProfile } = await admin
    .from('profiles')
    .select('display_name')
    .eq('id', viewerId)
    .maybeSingle();

  return {
    match: {
      id: loaded.match.id,
      roomCode: loaded.match.room_code,
      mode: loaded.match.mode,
      status: loaded.match.status,
      seed: loaded.match.seed,
      hostUserId: loaded.match.host_user_id,
      startsAt: loaded.match.starts_at,
      endsAt: loaded.match.ends_at,
      expiresAt: loaded.match.expires_at,
      winnerUserId: loaded.match.winner_user_id,
      finishReason: loaded.match.finish_reason,
      completedAt: loaded.match.completed_at,
    },
    self: {
      userId: self.user_id,
      displayName: selfProfile ? String(selfProfile.display_name) : 'You',
      seat: self.seat,
      readyAt: self.ready_at,
      submittedAt: self.submitted_at,
      result: self.result,
      verifiedScore: self.verified_score,
      verifiedLanesCleared: self.verified_lanes_cleared,
      verifiedCardsPlayed: self.verified_cards_played,
      verifiedBusts: self.verified_busts,
      verifiedTimeRemainingSeconds: self.verified_time_remaining_seconds,
      lastSeenAt: self.last_seen_at,
      disconnectedAt: self.disconnected_at,
    },
    opponent: opponent
      ? {
          ...opponentProfile,
          readyAt: opponent.ready_at,
          submittedAt: opponent.submitted_at,
          result: opponent.result,
          verifiedScore: opponent.verified_score,
          verifiedLanesCleared: opponent.verified_lanes_cleared,
          verifiedCardsPlayed: opponent.verified_cards_played,
          verifiedBusts: opponent.verified_busts,
          verifiedTimeRemainingSeconds: opponent.verified_time_remaining_seconds,
          lastSeenAt: opponent.last_seen_at,
          disconnectedAt: opponent.disconnected_at,
          connected:
            !opponent.disconnected_at &&
            Boolean(opponent.last_seen_at) &&
            Date.now() - Date.parse(opponent.last_seen_at ?? '') <
              LIVE_RECONNECT_GRACE_MS,
        }
      : null,
    playersReady: loaded.players.every((player) => Boolean(player.ready_at)),
    bothSubmitted: loaded.players.every((player) => Boolean(player.submitted_at)),
  };
}
