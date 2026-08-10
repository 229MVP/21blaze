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
  const progressRaw = Array.isArray(data.progress) ? data.progress : [];
  const myAttempt = isRecord(data.myAttempt)
    ? {
        attemptId: String(data.myAttempt.attemptId ?? ''),
        status: String(data.myAttempt.status ?? 'pending') as NonNullable<
          LiveMatchSnapshot['myAttempt']
        >['status'],
        score: data.myAttempt.score == null ? null : Number(data.myAttempt.score),
        completedAt:
          data.myAttempt.completedAt == null
            ? null
            : String(data.myAttempt.completedAt),
      }
    : null;

  return {
    matchId: String(data.matchId),
    status: String(data.status) as LiveMatchStatus,
    stateVersion: Number(data.stateVersion ?? 0),
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
      data.durationSeconds == null ? null : Number(data.durationSeconds),
    bustLimit: data.bustLimit == null ? null : Number(data.bustLimit),
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
    progress: progressRaw
      .map(mapProgress)
      .filter((p): p is LiveMatchProgress => p != null),
    serverNow: String(data.serverNow ?? new Date().toISOString()),
    gameplayEligible: Boolean(data.gameplayEligible),
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
