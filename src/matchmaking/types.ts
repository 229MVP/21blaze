export type QuickMatchStatus =
  | 'idle'
  | 'joining'
  | 'queued'
  | 'matchFound'
  | 'accepting'
  | 'waitingForOpponent'
  | 'countdown'
  | 'running'
  | 'cancelled'
  | 'expired'
  | 'failed';

export type PublicPlayerProfile = {
  userId: string;
  displayName: string;
  seat: number;
};

export type QuickMatchQueueState = {
  queueId: string | null;
  status: QuickMatchStatus;
  queuedAt: string | null;
  expiresAt: string | null;
  elapsedSeconds: number;
  matchId: string | null;
  opponent: PublicPlayerProfile | null;
  acceptanceExpiresAt: string | null;
  localAccepted: boolean;
  opponentAccepted: boolean;
  error: string | null;
  region: string | null;
  seed: number | null;
  startsAt: string | null;
  endsAt: string | null;
};

type QuickMatchBase = {
  matchId?: string;
  opponent?: PublicPlayerProfile | null;
  acceptanceExpiresAt?: string | null;
  localAccepted?: boolean;
  opponentAccepted?: boolean;
  queueId?: string;
  queuedAt?: string;
  expiresAt?: string;
  elapsedSeconds?: number;
  region?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
  seed?: number;
  matchStatus?: string;
  roomType?: string;
  error?: string;
};

export type QuickMatchResponse =
  | (QuickMatchBase & { status: 'queued'; queueId: string; queuedAt: string; expiresAt: string; elapsedSeconds: number })
  | (QuickMatchBase & { status: 'match_found'; matchId: string })
  | (QuickMatchBase & { status: 'awaiting_acceptance'; matchId: string; localAccepted: true })
  | (QuickMatchBase & { status: 'both_accepted'; matchId: string })
  | (QuickMatchBase & { status: 'cancelled' })
  | (QuickMatchBase & { status: 'expired' })
  | (QuickMatchBase & { status: 'already_in_match' })
  | (QuickMatchBase & { status: 'failed'; error?: string });

export const IDLE_QUICK_MATCH_STATE: QuickMatchQueueState = {
  queueId: null,
  status: 'idle',
  queuedAt: null,
  expiresAt: null,
  elapsedSeconds: 0,
  matchId: null,
  opponent: null,
  acceptanceExpiresAt: null,
  localAccepted: false,
  opponentAccepted: false,
  error: null,
  region: null,
  seed: null,
  startsAt: null,
  endsAt: null,
};
