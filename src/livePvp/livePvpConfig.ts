/**
 * Centralized Live PvP configuration (client display defaults).
 * Server `live_pvp_config` is authoritative; existing matches keep snapshotted values.
 */

export const LIVE_PVP_PROTOCOL_VERSION = '1' as const;

export const LIVE_PVP_CONFIG = {
  enabled: true,
  protocolVersion: LIVE_PVP_PROTOCOL_VERSION,
  rulesVersion: '1',
  deckVersion: '1',
  durationSeconds: 120,
  bustLimit: 3,
  invitationLifetimeSeconds: 300,
  lobbyLifetimeSeconds: 300,
  readyTimeoutSeconds: 120,
  countdownLeadSeconds: 5,
  completionGraceSeconds: 15,
  progressMinimumIntervalMs: 1000,
  progressMaximumSilenceSeconds: 45,
  maximumActiveMatchesPerPlayer: 1,
  maximumPendingInvitesPerPlayer: 3,
  maximumPendingInvitesBetweenPlayers: 1,
  presenceEnabled: true,
  liveProgressEnabled: true,
} as const;

export function livePvpTopicForMatch(matchId: string): string {
  return `live-pvp:${matchId}`;
}
