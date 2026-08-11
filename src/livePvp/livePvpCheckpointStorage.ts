import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Card, Lane, TimerStatus } from '../game/types';
import type { LiveMatchParticipantRole } from './livePvpTypes';

export const LIVE_PVP_CHECKPOINT_SCHEMA_VERSION = 1;
const STORAGE_KEY = '@21blaze/livePvpCheckpoint';

export type LivePvpCheckpointEngine = {
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

export type LivePvpCheckpoint = {
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
  authoritativeSeed: string;
  opponentDisplayName: string;
  lastAcceptedProgressSequence: number;
  lastAttemptedProgressSequence: number;
  updatedAtMs: number;
  engine: LivePvpCheckpointEngine;
};

let lastWriteMs = 0;
const MIN_WRITE_INTERVAL_MS = 2000;

export async function loadLivePvpCheckpoint(): Promise<LivePvpCheckpoint | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as LivePvpCheckpoint;
    if (
      parsed?.schemaVersion !== LIVE_PVP_CHECKPOINT_SCHEMA_VERSION ||
      typeof parsed.userId !== 'string' ||
      typeof parsed.matchId !== 'string' ||
      typeof parsed.attemptId !== 'string' ||
      typeof parsed.authoritativeSeed !== 'string' ||
      !parsed.engine
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function saveLivePvpCheckpoint(
  checkpoint: LivePvpCheckpoint,
  options?: { force?: boolean },
): Promise<void> {
  const now = Date.now();
  if (!options?.force && now - lastWriteMs < MIN_WRITE_INTERVAL_MS) {
    return;
  }
  lastWriteMs = now;
  const payload: LivePvpCheckpoint = {
    ...checkpoint,
    schemaVersion: LIVE_PVP_CHECKPOINT_SCHEMA_VERSION,
    updatedAtMs: now,
  };
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload)).catch(() => undefined);
}

export async function clearLivePvpCheckpoint(): Promise<void> {
  lastWriteMs = 0;
  await AsyncStorage.removeItem(STORAGE_KEY).catch(() => undefined);
}

export function __resetLivePvpCheckpointWriteThrottleForTests(): void {
  lastWriteMs = 0;
}
