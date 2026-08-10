export type AsyncDuelSession = {
  duelId: string;
  attemptId: string;
  participantRole: 'challenger' | 'opponent';
  authoritativeSeed: string;
  rulesVersion: string;
  deckVersion: string;
  durationSeconds: number;
  bustLimit: number;
  serverStartTime: string;
  expiresAt: string;
  opponentDisplayName: string;
  targetScore: number | null;
  resumed?: boolean;
};
