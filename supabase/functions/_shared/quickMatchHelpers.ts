import type { createServiceClient } from './supabaseAdmin.ts';
import { loadMatchWithPlayers } from './liveMatch.ts';

export const QUEUE_TTL_MS = 90_000;
export const SUPPORTED_GAME_RULES_VERSIONS = new Set(['1.0.0']);
export const QUICK_MATCH_REGIONS = [
  'us-east',
  'us-central',
  'us-west',
  'europe',
  'asia-pacific',
  'unknown',
] as const;

export type QuickMatchRegion = (typeof QUICK_MATCH_REGIONS)[number];

export type QueueRow = {
  id: string;
  user_id: string;
  mode: string;
  status: string;
  region: string | null;
  game_rules_version: string;
  queued_at: string;
  matched_at: string | null;
  expires_at: string;
  match_id: string | null;
  cancelled_at: string | null;
  last_check_at: string | null;
};

export type AcceptanceRow = {
  match_id: string;
  user_id: string;
  accepted_at: string | null;
  declined_at: string | null;
  expires_at: string;
};

type AdminClient = ReturnType<typeof createServiceClient>;

export function normalizeRegion(value: unknown): QuickMatchRegion {
  if (typeof value !== 'string') {
    return 'unknown';
  }
  const region = value.trim().toLowerCase();
  return (QUICK_MATCH_REGIONS as readonly string[]).includes(region)
    ? (region as QuickMatchRegion)
    : 'unknown';
}

export function elapsedSeconds(queuedAt: string): number {
  const ms = Date.now() - Date.parse(queuedAt);
  return Math.max(0, Math.floor(ms / 1000));
}

export async function expireStaleQueues(admin: AdminClient): Promise<void> {
  const nowIso = new Date().toISOString();
  await admin
    .from('matchmaking_queue')
    .update({ status: 'expired', cancelled_at: nowIso })
    .eq('status', 'queued')
    .lte('expires_at', nowIso);
}

export async function loadActiveQueue(
  admin: AdminClient,
  userId: string,
): Promise<QueueRow | null> {
  const { data } = await admin
    .from('matchmaking_queue')
    .select('*')
    .eq('user_id', userId)
    .in('status', ['queued', 'matched', 'accepted'])
    .order('queued_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return (data as QueueRow | null) ?? null;
}

export async function userHasBlockingLiveMatch(
  admin: AdminClient,
  userId: string,
): Promise<{ blocking: boolean; matchId?: string; status?: string }> {
  const { data: playerRows } = await admin
    .from('live_match_players')
    .select('match_id')
    .eq('user_id', userId)
    .order('joined_at', { ascending: false })
    .limit(15);

  for (const row of playerRows ?? []) {
    const loaded = await loadMatchWithPlayers(admin, row.match_id);
    if (!loaded) {
      continue;
    }
    if (
      loaded.match.status === 'countdown' ||
      loaded.match.status === 'running' ||
      loaded.match.status === 'awaiting_results'
    ) {
      return {
        blocking: true,
        matchId: loaded.match.id,
        status: loaded.match.status,
      };
    }
  }

  return { blocking: false };
}

export async function publicOpponentProfile(
  admin: AdminClient,
  matchId: string,
  viewerId: string,
): Promise<{ userId: string; displayName: string; seat: number } | null> {
  const loaded = await loadMatchWithPlayers(admin, matchId);
  if (!loaded) {
    return null;
  }

  const opponent = loaded.players.find((player) => player.user_id !== viewerId);
  if (!opponent) {
    return null;
  }

  const { data: profile } = await admin
    .from('profiles')
    .select('display_name')
    .eq('id', opponent.user_id)
    .maybeSingle();

  const snapshot = (opponent as { display_name_snapshot?: string | null })
    .display_name_snapshot;

  return {
    userId: opponent.user_id,
    displayName: snapshot || (profile ? String(profile.display_name) : 'Opponent'),
    seat: opponent.seat,
  };
}

export async function loadAcceptanceState(
  admin: AdminClient,
  matchId: string,
  userId: string,
): Promise<{
  localAccepted: boolean;
  opponentAccepted: boolean;
  acceptanceExpiresAt: string | null;
  declined: boolean;
}> {
  const { data } = await admin
    .from('quick_match_acceptances')
    .select('*')
    .eq('match_id', matchId);

  const rows = (data as AcceptanceRow[] | null) ?? [];
  const self = rows.find((row) => row.user_id === userId);
  const opponent = rows.find((row) => row.user_id !== userId);

  return {
    localAccepted: Boolean(self?.accepted_at),
    opponentAccepted: Boolean(opponent?.accepted_at),
    acceptanceExpiresAt: self?.expires_at ?? opponent?.expires_at ?? null,
    declined: Boolean(self?.declined_at || opponent?.declined_at),
  };
}
