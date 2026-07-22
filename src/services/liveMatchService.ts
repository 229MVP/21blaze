import { supabase } from '../lib/supabase';
import type { MoveLogEntry } from '../online/types';
import type {
  CreateLiveRoomResponse,
  JoinLiveRoomResponse,
  LiveMatchStatePayload,
  LiveOfficialResult,
} from '../live/types';

const TIMEOUT_MS = 8000;

class LiveMatchServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LiveMatchServiceError';
  }
}

function withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new LiveMatchServiceError(`${label} timed out.`));
    }, TIMEOUT_MS);

    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error: unknown) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

function isMatchState(value: unknown): value is LiveMatchStatePayload {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.match === 'object' &&
    candidate.match !== null &&
    typeof candidate.self === 'object' &&
    candidate.self !== null
  );
}

async function invokeFunction<T>(
  name: string,
  body: Record<string, unknown>,
  validate: (data: unknown) => data is T,
): Promise<T> {
  const { data, error } = await withTimeout(
    supabase.functions.invoke(name, { body }),
    name,
  );

  if (error) {
    throw new LiveMatchServiceError(error.message || `Unable to call ${name}.`);
  }

  if (data && typeof data === 'object' && 'error' in data) {
    const message = (data as { error?: unknown }).error;
    throw new LiveMatchServiceError(
      typeof message === 'string' ? message : `Unable to call ${name}.`,
    );
  }

  if (!validate(data)) {
    throw new LiveMatchServiceError(`Invalid ${name} response.`);
  }

  return data;
}

export async function createLiveRoom(): Promise<CreateLiveRoomResponse> {
  return invokeFunction(
    'create-live-room',
    {},
    (data): data is CreateLiveRoomResponse => {
      if (!data || typeof data !== 'object') {
        return false;
      }
      const candidate = data as Record<string, unknown>;
      return (
        typeof candidate.matchId === 'string' &&
        typeof candidate.roomCode === 'string' &&
        typeof candidate.seed === 'number' &&
        isMatchState(candidate.state)
      );
    },
  );
}

export async function joinLiveRoom(roomCode: string): Promise<JoinLiveRoomResponse> {
  return invokeFunction(
    'join-live-room',
    { roomCode },
    (data): data is JoinLiveRoomResponse => {
      if (!data || typeof data !== 'object') {
        return false;
      }
      const candidate = data as Record<string, unknown>;
      return (
        typeof candidate.matchId === 'string' &&
        typeof candidate.roomCode === 'string' &&
        typeof candidate.seed === 'number' &&
        isMatchState(candidate.state)
      );
    },
  );
}

export async function setLiveReady(
  matchId: string,
): Promise<LiveMatchStatePayload> {
  const response = await invokeFunction(
    'set-live-ready',
    { matchId },
    (data): data is { state: LiveMatchStatePayload } => {
      if (!data || typeof data !== 'object') {
        return false;
      }
      return isMatchState((data as { state?: unknown }).state);
    },
  );
  return response.state;
}

export async function leaveLiveMatch(matchId: string): Promise<void> {
  await invokeFunction(
    'leave-live-match',
    { matchId },
    (data): data is Record<string, unknown> =>
      Boolean(data && typeof data === 'object'),
  );
}

export async function getLiveMatchState(
  matchId: string,
): Promise<LiveMatchStatePayload> {
  const response = await invokeFunction(
    'get-live-match-state',
    { matchId },
    (data): data is { state: LiveMatchStatePayload } => {
      if (!data || typeof data !== 'object') {
        return false;
      }
      return isMatchState((data as { state?: unknown }).state);
    },
  );
  return response.state;
}

export async function submitLiveResult(
  matchId: string,
  moves: MoveLogEntry[],
): Promise<{
  verified: boolean;
  officialResult?: LiveOfficialResult;
  rejectionReason?: string;
  state?: LiveMatchStatePayload;
}> {
  return invokeFunction(
    'submit-live-result',
    { matchId, moves },
    (data): data is {
      verified: boolean;
      officialResult?: LiveOfficialResult;
      rejectionReason?: string;
      state?: LiveMatchStatePayload;
    } => {
      if (!data || typeof data !== 'object') {
        return false;
      }
      return typeof (data as { verified?: unknown }).verified === 'boolean';
    },
  );
}

export { LiveMatchServiceError };
