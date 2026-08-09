/**
 * Central Async Duel configuration registry.
 * Server `async_duel_config` in app_configuration is authoritative at create time.
 * Effective values are snapshotted onto each duel row.
 */

export const ASYNC_DUEL_CONFIG = {
  rulesVersion: '1',
  deckVersion: '1',
  durationSeconds: 120,
  bustLimit: 3,
  invitationLifetimeHours: 72,
  opponentPlayLifetimeHours: 72,
  targetScoreVisibility: true,
  maxPendingOutgoing: 5,
  maxActiveBetweenPair: 1,
  creationCooldownSeconds: 30,
  active: true,
  inboxPageSizeMax: 50,
} as const;

export type AsyncDuelConfiguration = {
  rulesVersion: string;
  deckVersion: string;
  durationSeconds: number;
  bustLimit: number;
  invitationLifetimeHours: number;
  opponentPlayLifetimeHours: number;
  targetScoreVisibility: boolean;
  maxPendingOutgoing: number;
  maxActiveBetweenPair: number;
  creationCooldownSeconds: number;
  active: boolean;
};

export function getAsyncDuelConfig(): AsyncDuelConfiguration {
  return { ...ASYNC_DUEL_CONFIG };
}
