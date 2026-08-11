import AsyncStorage from '@react-native-async-storage/async-storage';

import { livePvpDiagnostics } from './livePvpDiagnostics';
import type { LivePvpCheckpointV2 } from './livePvpCheckpointValidate';
import {
  LIVE_PVP_CHECKPOINT_SCHEMA_VERSION,
  validateLivePvpCheckpointPayload,
  type LivePvpCheckpointLoadResult,
} from './livePvpCheckpointValidate';

const STORAGE_KEY = '@21blaze/livePvpCheckpoint';

export type LivePvpCheckpointEngine = LivePvpCheckpointV2['engine'];
export type LivePvpCheckpoint = LivePvpCheckpointV2;

export type LivePvpCheckpointSaveResult =
  | { ok: true }
  | { ok: false; reason: string };

let lastWriteMs = 0;
const MIN_WRITE_INTERVAL_MS = 2000;

export async function loadLivePvpCheckpoint(): Promise<LivePvpCheckpoint | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as unknown;
    const result = validateLivePvpCheckpointPayload(parsed);
    if (!result.ok) {
      livePvpDiagnostics.checkpointDiscarded(result.reason);
      await AsyncStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return result.checkpoint;
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'read_failed';
    livePvpDiagnostics.checkpointDiscarded(reason);
    await AsyncStorage.removeItem(STORAGE_KEY).catch(() => undefined);
    return null;
  }
}

export async function saveLivePvpCheckpoint(
  checkpoint: LivePvpCheckpoint,
  options?: { force?: boolean },
): Promise<LivePvpCheckpointSaveResult> {
  const validation = validateLivePvpCheckpointPayload(checkpoint);
  if (!validation.ok) {
    return { ok: false, reason: validation.reason };
  }
  const now = Date.now();
  if (!options?.force && now - lastWriteMs < MIN_WRITE_INTERVAL_MS) {
    return { ok: true };
  }
  lastWriteMs = now;
  const payload: LivePvpCheckpoint = {
    ...validation.checkpoint,
    schemaVersion: LIVE_PVP_CHECKPOINT_SCHEMA_VERSION,
    updatedAtMs: now,
  };
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    return { ok: true };
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'write_failed';
    livePvpDiagnostics.checkpointDiscarded(reason);
    return { ok: false, reason };
  }
}

export async function clearLivePvpCheckpoint(): Promise<void> {
  lastWriteMs = 0;
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'clear_failed';
    livePvpDiagnostics.checkpointDiscarded(reason);
  }
}

export function __resetLivePvpCheckpointWriteThrottleForTests(): void {
  lastWriteMs = 0;
}

export function __validateLivePvpCheckpointForTests(
  raw: unknown,
): LivePvpCheckpointLoadResult {
  return validateLivePvpCheckpointPayload(raw);
}
