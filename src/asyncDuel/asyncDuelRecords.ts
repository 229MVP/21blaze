export type PlayerDuelRecord = {
  completedDuels: number;
  wins: number;
  losses: number;
  ties: number;
  /** Percentage 0–100, or null when no completed duels. */
  winRate: number | null;
  highestDuelScore: number;
};

export type HeadToHeadRecord = {
  otherPlayerId: string;
  otherDisplayName: string;
  completedDuels: number;
  yourWins: number;
  theirWins: number;
  ties: number;
};

export type AsyncDuelSeriesSummary = {
  duelId: string;
  rematchOfDuelId: string | null;
  seriesRootDuelId: string;
  rematchIndex: number;
  headToHead: HeadToHeadRecord;
};

export type AsyncDuelRematchResult = {
  duelId: string;
  attemptId: string;
  seed: string;
  rulesVersion: string;
  deckVersion: string;
  durationSeconds: number;
  bustLimit: number;
  status: string;
  expiresAt: string;
  participantRole: 'challenger';
  alreadyStarted: boolean;
  rematchOfDuelId: string;
  seriesRootDuelId: string;
  alreadyExisted: boolean;
};

export function formatWinRate(winRate: number | null): string {
  if (winRate == null) {
    return '—';
  }
  return `${winRate}%`;
}

export function formatRecordLine(record: PlayerDuelRecord): string {
  return `${record.wins}–${record.losses}–${record.ties}`;
}
