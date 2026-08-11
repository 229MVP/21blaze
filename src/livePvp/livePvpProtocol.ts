import type {
  LiveMatchErrorCode,
  LiveMatchProgress,
  LiveMatchRealtimeEvent,
  LiveMatchRealtimeEventType,
  LiveMatchSnapshot,
  LiveMatchStatus,
} from './livePvpTypes';

const EVENT_TYPES: ReadonlySet<LiveMatchRealtimeEventType> = new Set([
  'MATCH_SNAPSHOT_CHANGED',
  'PARTICIPANT_JOINED',
  'PARTICIPANT_READY',
  'COUNTDOWN_SCHEDULED',
  'MATCH_ACTIVE',
  'PROGRESS_ACCEPTED',
  'PARTICIPANT_FINISHED',
  'PARTICIPANT_FORFEITED',
  'PARTICIPANT_TIMED_OUT',
  'MATCH_SETTLED',
  'MATCH_CANCELLED',
  'MATCH_EXPIRED',
  'MATCH_INVALIDATED',
]);

function parseUuid(value: unknown, label: string): string {
  const id = String(value ?? '');
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    throw new LivePvpProtocolError(`Invalid ${label}`);
  }
  return id;
}

function parseNonNegativeInt(value: unknown, label: string): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) {
    throw new LivePvpProtocolError(`Invalid ${label}`);
  }
  return Math.floor(n);
}

export class LivePvpProtocolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LivePvpProtocolError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseLivePvpRealtimeEvent(
  value: unknown,
): LiveMatchRealtimeEvent | null {
  if (!isRecord(value)) {
    return null;
  }
  const eventType = String(value.eventType ?? '');
  if (!EVENT_TYPES.has(eventType as LiveMatchRealtimeEventType)) {
    return null;
  }
  const matchId = String(value.matchId ?? '');
  const eventId = String(value.eventId ?? '');
  const protocolVersion = String(value.protocolVersion ?? '');
  const stateVersion = Number(value.stateVersion);
  if (!matchId || !eventId || !protocolVersion || !Number.isFinite(stateVersion)) {
    return null;
  }
  const payload = isRecord(value.payload) ? value.payload : {};
  // Never accept seed / secrets from broadcast envelopes.
  const { seed: _seed, accessToken: _token, ...safePayload } = payload as Record<
    string,
    unknown
  > & { seed?: unknown; accessToken?: unknown };
  return {
    protocolVersion,
    eventId,
    matchId,
    stateVersion,
    eventType: eventType as LiveMatchRealtimeEventType,
    serverOccurredAt: String(value.serverOccurredAt ?? new Date().toISOString()),
    payload: safePayload,
  };
}

function mapParticipant(raw: unknown): {
  userId: string;
  displayName: string;
  profileFrameId?: string | null;
} {
  if (!isRecord(raw)) {
    return { userId: '', displayName: 'Blaze Player' };
  }
  return {
    userId: String(raw.userId ?? ''),
    displayName: String(raw.displayName ?? 'Blaze Player'),
    profileFrameId:
      raw.profileFrameId == null ? null : String(raw.profileFrameId),
  };
}

function mapProgress(raw: unknown): LiveMatchProgress | null {
  if (!isRecord(raw)) {
    return null;
  }
  return {
    userId: String(raw.userId ?? ''),
    sequence: Number(raw.sequence ?? 0),
    score: Number(raw.score ?? 0),
    exact21Count: Number(raw.exact21Count ?? 0),
    fiveCardClearCount: Number(raw.fiveCardClearCount ?? 0),
    bustCount: Number(raw.bustCount ?? 0),
    cardsPlayed: Number(raw.cardsPlayed ?? 0),
    lanesCleared: Number(raw.lanesCleared ?? 0),
    clientElapsedMs:
      raw.clientElapsedMs == null ? undefined : Number(raw.clientElapsedMs),
    serverReceivedAt:
      raw.serverReceivedAt == null ? undefined : String(raw.serverReceivedAt),
  };
}

export function mapLivePvpSnapshot(data: Record<string, unknown>): LiveMatchSnapshot {
  if (data.matchId != null && typeof data.matchId !== 'string') {
    throw new LivePvpProtocolError('Invalid matchId type');
  }
  const matchId = parseUuid(data.matchId, 'matchId');
  const status = String(data.status ?? '');
  const allowed: LiveMatchStatus[] = [
    'invited',
    'lobby',
    'countdown',
    'active',
    'settling',
    'completed',
    'declined',
    'cancelled',
    'expired',
    'invalid',
  ];
  if (!allowed.includes(status as LiveMatchStatus)) {
    throw new LivePvpProtocolError('Invalid match status');
  }

  const progressRaw = Array.isArray(data.progress) ? data.progress : [];
  const myAttempt = isRecord(data.myAttempt)
    ? {
        attemptId: parseUuid(data.myAttempt.attemptId, 'attemptId'),
        status: String(data.myAttempt.status ?? 'pending') as NonNullable<
          LiveMatchSnapshot['myAttempt']
        >['status'],
        score:
          data.myAttempt.score == null
            ? null
            : parseNonNegativeInt(data.myAttempt.score, 'score'),
        completedAt:
          data.myAttempt.completedAt == null
            ? null
            : String(data.myAttempt.completedAt),
      }
    : null;

  return {
    matchId,
    status: status as LiveMatchStatus,
    stateVersion: parseNonNegativeInt(data.stateVersion ?? 0, 'stateVersion'),
    protocolVersion: String(data.protocolVersion ?? '1'),
    realtimeTopic: String(data.realtimeTopic ?? ''),
    participantRole: data.participantRole === 'opponent' ? 'opponent' : 'challenger',
    challenger: mapParticipant(data.challenger),
    opponent: mapParticipant(data.opponent),
    challengerReady: Boolean(data.challengerReady),
    opponentReady: Boolean(data.opponentReady),
    scheduledStartAt: data.scheduledStartAt == null ? null : String(data.scheduledStartAt),
    gameplayDeadlineAt:
      data.gameplayDeadlineAt == null ? null : String(data.gameplayDeadlineAt),
    submissionGraceUntil:
      data.submissionGraceUntil == null ? null : String(data.submissionGraceUntil),
    expiresAt: String(data.expiresAt ?? ''),
    rulesVersion: data.rulesVersion == null ? null : String(data.rulesVersion),
    deckVersion: data.deckVersion == null ? null : String(data.deckVersion),
    durationSeconds:
      data.durationSeconds == null
        ? null
        : parseNonNegativeInt(data.durationSeconds, 'durationSeconds'),
    bustLimit:
      data.bustLimit == null ? null : parseNonNegativeInt(data.bustLimit, 'bustLimit'),
    seed: data.seed == null ? null : String(data.seed),
    seedAvailable: Boolean(data.seedAvailable),
    outcome: (data.outcome as LiveMatchSnapshot['outcome']) ?? null,
    winnerUserId: data.winnerUserId == null ? null : String(data.winnerUserId),
    decidingField:
      data.decidingField == null ? null : String(data.decidingField),
    completionReason:
      (data.completionReason as LiveMatchSnapshot['completionReason']) ?? null,
    settledAt: data.settledAt == null ? null : String(data.settledAt),
    myAttempt,
    myLatestProgressSequence: parseNonNegativeInt(
      data.myLatestProgressSequence ?? 0,
      'myLatestProgressSequence',
    ),
    progress: progressRaw
      .map(mapProgress)
      .filter((p): p is LiveMatchProgress => p != null),
    serverNow: String(data.serverNow ?? new Date().toISOString()),
    gameplayEligible: Boolean(data.gameplayEligible),
  };
}

export function mapLivePvpPlayerRecord(data: Record<string, unknown>): import('./livePvpTypes').LivePvpPlayerRecord {
  const recentRaw = Array.isArray(data.recentForm) ? data.recentForm : [];
  return {
    completedMatches: parseNonNegativeInt(data.completedMatches ?? 0, 'completedMatches'),
    wins: parseNonNegativeInt(data.wins ?? 0, 'wins'),
    losses: parseNonNegativeInt(data.losses ?? 0, 'losses'),
    ties: parseNonNegativeInt(data.ties ?? 0, 'ties'),
    noContests: parseNonNegativeInt(data.noContests ?? 0, 'noContests'),
    forfeitsAgainst: parseNonNegativeInt(data.forfeitsAgainst ?? 0, 'forfeitsAgainst'),
    timeouts: parseNonNegativeInt(data.timeouts ?? 0, 'timeouts'),
    winRate: Number(data.winRate ?? 0),
    recentForm: recentRaw.map((row) => mapRecordFormEntry(row)),
    serverNow: String(data.serverNow ?? new Date().toISOString()),
  };
}

export function mapLivePvpHeadToHeadRecord(
  data: Record<string, unknown>,
): import('./livePvpTypes').LivePvpHeadToHeadRecord {
  const recentRaw = Array.isArray(data.recentForm) ? data.recentForm : [];
  const opponent = mapParticipant(data.opponent);
  return {
    opponentId: parseUuid(data.opponentId ?? opponent.userId, 'opponentId'),
    opponent,
    completedMatches: parseNonNegativeInt(data.completedMatches ?? 0, 'completedMatches'),
    wins: parseNonNegativeInt(data.wins ?? 0, 'wins'),
    losses: parseNonNegativeInt(data.losses ?? 0, 'losses'),
    ties: parseNonNegativeInt(data.ties ?? 0, 'ties'),
    noContests: parseNonNegativeInt(data.noContests ?? 0, 'noContests'),
    winRate: Number(data.winRate ?? 0),
    recentForm: recentRaw.map((row) => mapRecordFormEntry(row)),
    serverNow: String(data.serverNow ?? new Date().toISOString()),
  };
}

function mapRecordFormEntry(raw: unknown): import('./livePvpTypes').LivePvpRecordFormEntry {
  if (!isRecord(raw)) {
    throw new LivePvpProtocolError('Invalid record form entry');
  }
  const perspective = String(raw.perspective ?? 'unknown');
  if (!['win', 'loss', 'tie', 'no_contest', 'unknown'].includes(perspective)) {
    throw new LivePvpProtocolError('Invalid record perspective');
  }
  return {
    matchId: parseUuid(raw.matchId, 'matchId'),
    outcome: (raw.outcome as LiveMatchSnapshot['outcome']) ?? null,
    winnerUserId: raw.winnerUserId == null ? null : String(raw.winnerUserId),
    completionReason:
      (raw.completionReason as LiveMatchSnapshot['completionReason']) ?? null,
    settledAt: raw.settledAt == null ? null : String(raw.settledAt),
    perspective: perspective as import('./livePvpTypes').LivePvpRecordFormEntry['perspective'],
  };
}

export function mapLivePvpRematchResult(
  data: Record<string, unknown>,
): import('./livePvpTypes').LivePvpRematchResult {
  return {
    matchId: parseUuid(data.matchId, 'matchId'),
    status: String(data.status ?? ''),
    realtimeTopic: String(data.realtimeTopic ?? ''),
    protocolVersion: String(data.protocolVersion ?? '1'),
    stateVersion: parseNonNegativeInt(data.stateVersion ?? 0, 'stateVersion'),
    expiresAt: String(data.expiresAt ?? ''),
    participantRole: data.participantRole === 'opponent' ? 'opponent' : 'challenger',
    opponent: mapParticipant(data.opponent),
    rematchOfMatchId: parseUuid(data.rematchOfMatchId, 'rematchOfMatchId'),
    alreadyExisted: Boolean(data.alreadyExisted),
    serverNow: String(data.serverNow ?? new Date().toISOString()),
  };
}

export function mapLivePvpErrorCode(message: string): LiveMatchErrorCode {
  const upper = message.toUpperCase();
  const codes: LiveMatchErrorCode[] = [
    'LIVE_PVP_DISABLED',
    'SELF_INVITE',
    'PLAYER_NOT_FOUND',
    'PLAYER_NOT_ELIGIBLE',
    'ACTIVE_MATCH_LIMIT',
    'INVITE_LIMIT',
    'DUPLICATE_INVITE',
    'MATCH_NOT_FOUND',
    'NOT_PARTICIPANT',
    'INVALID_MATCH_STATE',
    'INVITE_EXPIRED',
    'ALREADY_ACCEPTED',
    'ALREADY_READY',
    'COUNTDOWN_ALREADY_SCHEDULED',
    'MATCH_NOT_ACTIVE',
    'PROGRESS_RATE_LIMITED',
    'STALE_PROGRESS_SEQUENCE',
    'ATTEMPT_ALREADY_COMPLETED',
    'SUBMISSION_TOO_LATE',
    'MATCH_ALREADY_SETTLED',
    'PROTOCOL_VERSION_UNSUPPORTED',
    'REMATCH_NOT_ELIGIBLE',
  ];
  for (const code of codes) {
    if (upper.includes(code)) {
      return code;
    }
  }
  if (/NOT_AUTHENTICATED/i.test(message)) {
    return 'NOT_AUTHENTICATED';
  }
  return 'UNKNOWN';
}

/**
 * Apply a realtime event against local state version.
 * Returns: apply | ignore | refetch
 */
export function reconcileLivePvpEvent(
  currentVersion: number,
  event: LiveMatchRealtimeEvent,
): 'apply' | 'ignore' | 'refetch' {
  if (event.stateVersion < currentVersion) {
    return 'ignore';
  }
  if (event.stateVersion === currentVersion) {
    return 'ignore';
  }
  if (event.stateVersion > currentVersion + 1) {
    return 'refetch';
  }
  return 'apply';
}
