import type { Card, Lane, LaneId, Rank, Suit, TimerStatus } from '../game/types';
import type { LiveMatchParticipantRole } from './livePvpTypes';

export const LIVE_PVP_CHECKPOINT_SCHEMA_VERSION = 2;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const SUITS: ReadonlySet<Suit> = new Set(['hearts', 'diamonds', 'clubs', 'spades']);
const RANKS: ReadonlySet<Rank> = new Set([
  'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K',
]);
const TIMER_STATUSES: ReadonlySet<TimerStatus> = new Set([
  'ready', 'countdown', 'running', 'paused', 'expired',
]);
const ROLES: ReadonlySet<LiveMatchParticipantRole> = new Set(['challenger', 'opponent']);

const MAX_DECK = 120;
const MAX_LANES = 4;
const MAX_CARDS_PER_LANE = 10;
const MAX_SCORE = 10_000_000;
const MAX_COUNTER = 10_000;

export type LivePvpCheckpointEngineV2 = {
  deck: Card[];
  activeCard: Card | null;
  lanes: Lane[];
  score: number;
  multiplier: number;
  busts: number;
  clearedLanes: number;
  cardsPlayed: number;
  exact21Count: number;
  fiveCardClearCount: number;
  timerStatus: TimerStatus;
  gameStartedAt: number | null;
  timeRemainingSeconds: number;
};

export type LivePvpCheckpointV2 = {
  schemaVersion: typeof LIVE_PVP_CHECKPOINT_SCHEMA_VERSION;
  userId: string;
  matchId: string;
  attemptId: string;
  participantRole: LiveMatchParticipantRole;
  protocolVersion: string;
  rulesVersion: string;
  deckVersion: string;
  durationSeconds: number;
  bustLimit: number;
  scheduledStartAt: string;
  gameplayDeadlineAt: string;
  submissionGraceUntil: string;
  opponentDisplayName: string;
  lastAcceptedProgressSequence: number;
  lastAttemptedProgressSequence: number;
  updatedAtMs: number;
  engine: LivePvpCheckpointEngineV2;
};

export type LivePvpCheckpointLoadResult =
  | { ok: true; checkpoint: LivePvpCheckpointV2 }
  | { ok: false; reason: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseUuid(value: unknown, label: string): string {
  const id = String(value ?? '');
  if (!UUID_RE.test(id)) {
    throw new Error(`invalid_${label}`);
  }
  return id;
}

function parseIso(value: unknown, label: string): string {
  const s = String(value ?? '');
  const ms = Date.parse(s);
  if (!Number.isFinite(ms)) {
    throw new Error(`invalid_${label}`);
  }
  return s;
}

function parseBoundedInt(value: unknown, label: string, max = MAX_COUNTER): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > max || Math.floor(n) !== n) {
    throw new Error(`invalid_${label}`);
  }
  return n;
}

function parseCard(raw: unknown): Card {
  if (!isRecord(raw)) {
    throw new Error('invalid_card');
  }
  const suit = String(raw.suit ?? '');
  const rank = String(raw.rank ?? '') as Rank;
  if (!SUITS.has(suit as Suit) || !RANKS.has(rank)) {
    throw new Error('invalid_card');
  }
  return {
    id: String(raw.id ?? `${suit}-${rank}`),
    suit: suit as Suit,
    rank,
  };
}

function parseLane(raw: unknown): Lane {
  if (!isRecord(raw)) {
    throw new Error('invalid_lane');
  }
  const id = Number(raw.id);
  if (id !== 1 && id !== 2 && id !== 3 && id !== 4) {
    throw new Error('invalid_lane');
  }
  const cardsRaw = Array.isArray(raw.cards) ? raw.cards : [];
  if (cardsRaw.length > MAX_CARDS_PER_LANE) {
    throw new Error('invalid_lane_cards');
  }
  return {
    id: id as LaneId,
    cards: cardsRaw.map(parseCard),
  };
}

function parseEngine(raw: unknown): LivePvpCheckpointEngineV2 {
  if (!isRecord(raw)) {
    throw new Error('invalid_engine');
  }
  const deckRaw = Array.isArray(raw.deck) ? raw.deck : [];
  if (deckRaw.length > MAX_DECK) {
    throw new Error('invalid_deck_size');
  }
  const lanesRaw = Array.isArray(raw.lanes) ? raw.lanes : [];
  if (lanesRaw.length > MAX_LANES) {
    throw new Error('invalid_lanes');
  }
  const timerStatus = String(raw.timerStatus ?? '');
  if (!TIMER_STATUSES.has(timerStatus as TimerStatus)) {
    throw new Error('invalid_timer_status');
  }
  const gameStartedAt =
    raw.gameStartedAt == null ? null : Number(raw.gameStartedAt);
  if (gameStartedAt != null && !Number.isFinite(gameStartedAt)) {
    throw new Error('invalid_game_started_at');
  }
  const score = Number(raw.score ?? 0);
  if (!Number.isFinite(score) || score < 0 || score > MAX_SCORE) {
    throw new Error('invalid_score');
  }
  const multiplier = Number(raw.multiplier ?? 1);
  if (!Number.isFinite(multiplier) || multiplier < 1 || multiplier > 32) {
    throw new Error('invalid_multiplier');
  }
  return {
    deck: deckRaw.map(parseCard),
    activeCard: raw.activeCard == null ? null : parseCard(raw.activeCard),
    lanes: lanesRaw.map(parseLane),
    score,
    multiplier,
    busts: parseBoundedInt(raw.busts, 'busts', 20),
    clearedLanes: parseBoundedInt(raw.clearedLanes, 'cleared_lanes', MAX_LANES),
    cardsPlayed: parseBoundedInt(raw.cardsPlayed, 'cards_played'),
    exact21Count: parseBoundedInt(raw.exact21Count, 'exact21'),
    fiveCardClearCount: parseBoundedInt(raw.fiveCardClearCount, 'five_card'),
    timerStatus: timerStatus as TimerStatus,
    gameStartedAt,
    timeRemainingSeconds: parseBoundedInt(raw.timeRemainingSeconds, 'time_remaining', 600),
  };
}

export function validateLivePvpCheckpointPayload(raw: unknown): LivePvpCheckpointLoadResult {
  try {
    if (!isRecord(raw)) {
      return { ok: false, reason: 'not_object' };
    }
    if (Number(raw.schemaVersion) !== LIVE_PVP_CHECKPOINT_SCHEMA_VERSION) {
      return { ok: false, reason: 'schema_version' };
    }
    if ('authoritativeSeed' in raw || 'seed' in raw) {
      return { ok: false, reason: 'seed_persisted' };
    }
    const scheduledStartAt = parseIso(raw.scheduledStartAt, 'scheduled_start');
    const gameplayDeadlineAt = parseIso(raw.gameplayDeadlineAt, 'gameplay_deadline');
    const submissionGraceUntil = parseIso(raw.submissionGraceUntil, 'submission_grace');
    if (Date.parse(gameplayDeadlineAt) < Date.parse(scheduledStartAt)) {
      return { ok: false, reason: 'deadline_order' };
    }
    const role = String(raw.participantRole ?? '');
    if (!ROLES.has(role as LiveMatchParticipantRole)) {
      return { ok: false, reason: 'participant_role' };
    }
    const lastAccepted = parseBoundedInt(raw.lastAcceptedProgressSequence, 'accepted_seq');
    const lastAttempted = parseBoundedInt(raw.lastAttemptedProgressSequence, 'attempted_seq');
    if (lastAttempted < lastAccepted) {
      return { ok: false, reason: 'sequence_order' };
    }
    const checkpoint: LivePvpCheckpointV2 = {
      schemaVersion: LIVE_PVP_CHECKPOINT_SCHEMA_VERSION,
      userId: parseUuid(raw.userId, 'user_id'),
      matchId: parseUuid(raw.matchId, 'match_id'),
      attemptId: parseUuid(raw.attemptId, 'attempt_id'),
      participantRole: role as LiveMatchParticipantRole,
      protocolVersion: String(raw.protocolVersion ?? ''),
      rulesVersion: String(raw.rulesVersion ?? ''),
      deckVersion: String(raw.deckVersion ?? ''),
      durationSeconds: parseBoundedInt(raw.durationSeconds, 'duration', 600),
      bustLimit: parseBoundedInt(raw.bustLimit, 'bust_limit', 20),
      scheduledStartAt,
      gameplayDeadlineAt,
      submissionGraceUntil,
      opponentDisplayName: String(raw.opponentDisplayName ?? 'Opponent').slice(0, 80),
      lastAcceptedProgressSequence: lastAccepted,
      lastAttemptedProgressSequence: lastAttempted,
      updatedAtMs: parseBoundedInt(raw.updatedAtMs, 'updated_at', Number.MAX_SAFE_INTEGER),
      engine: parseEngine(raw.engine),
    };
    if (!checkpoint.protocolVersion || !checkpoint.rulesVersion || !checkpoint.deckVersion) {
      return { ok: false, reason: 'version_empty' };
    }
    return { ok: true, checkpoint };
  } catch (e) {
    const reason = e instanceof Error ? e.message : 'corrupt';
    return { ok: false, reason };
  }
}
