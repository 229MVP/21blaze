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

export type LiveConnectionStatus =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected';

export type LiveChannelStatus =
  | 'idle'
  | 'subscribing'
  | 'subscribed'
  | 'error'
  | 'closed';

export type LiveSubmissionStatus =
  | 'idle'
  | 'submitting'
  | 'verified'
  | 'rejected'
  | 'failed';

export type LiveOpponentProgress = {
  score: number;
  multiplier: number;
  busts: number;
  cardsPlayed: number;
  lanesCleared: number;
  elapsedMilliseconds: number;
  updatedAt: number;
};

export type LiveGameplayFlash = {
  id: string;
  type: 'lane_clear' | 'bust' | 'emote';
  message: string;
  createdAt: number;
};

/** Untrusted visual-only client→channel events. */
export type LiveClientBroadcastEvent =
  | 'player_ready'
  | 'progress'
  | 'lane_clear'
  | 'bust'
  | 'emote'
  | 'player_finished'
  | 'heartbeat';

/** Server/database channel events. */
export type LiveServerBroadcastEvent =
  | 'opponent_joined'
  | 'both_ready'
  | 'match_start'
  | 'player_disconnected'
  | 'player_reconnected'
  | 'opponent_finished'
  | 'match_completed'
  | 'match_cancelled'
  | 'player_forfeited'
  | 'player_ready'
  | 'player_finished';

export type LivePresenceState = {
  userId: string;
  displayName: string;
  ready: boolean;
  connectedAt: string;
  appState: 'active' | 'background';
};

export type LiveMatchSummary = {
  id: string;
  roomCode: string;
  mode: string;
  status: LiveMatchStatus;
  seed: number;
  hostUserId: string;
  startsAt: string | null;
  endsAt: string | null;
  expiresAt: string;
  winnerUserId: string | null;
  finishReason: string | null;
  completedAt: string | null;
};

export type LiveParticipantView = {
  userId: string;
  displayName: string;
  seat: number;
  readyAt: string | null;
  submittedAt: string | null;
  result: LivePlayerResult;
  verifiedScore: number | null;
  verifiedLanesCleared: number | null;
  verifiedCardsPlayed: number | null;
  verifiedBusts: number | null;
  verifiedTimeRemainingSeconds: number | null;
  lastSeenAt: string | null;
  disconnectedAt: string | null;
  connected?: boolean;
};

export type LiveMatchStatePayload = {
  match: LiveMatchSummary;
  self: LiveParticipantView;
  opponent: LiveParticipantView | null;
  playersReady: boolean;
  bothSubmitted: boolean;
};

export type LiveOfficialResult = {
  score: number;
  lanesCleared: number;
  cardsPlayed: number;
  busts: number;
  timeRemainingSeconds: number;
};

export type CreateLiveRoomResponse = {
  matchId: string;
  roomCode: string;
  seed: number;
  expiresAt: string;
  state: LiveMatchStatePayload;
};

export type JoinLiveRoomResponse = {
  matchId: string;
  roomCode: string;
  seed: number;
  state: LiveMatchStatePayload;
};
