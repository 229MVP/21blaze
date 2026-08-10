import type { LiveMatchParticipantRole } from './livePvpTypes';

/**
 * Live PvP game session descriptor for the canonical engine wrapper.
 * Core card engine must not know about Realtime / Presence / settlement.
 */
export type LivePvpSession = {
  matchId: string;
  attemptId: string;
  participantRole: LiveMatchParticipantRole;
  authoritativeSeed: string;
  rulesVersion: string;
  deckVersion: string;
  durationSeconds: number;
  bustLimit: number;
  scheduledStartAt: string;
  gameplayDeadlineAt: string;
  submissionGraceUntil: string;
  protocolVersion: string;
  opponentDisplayName: string;
  serverStartTime: string;
};
