import { APP_VERSION } from '../game/constants';
import { supabase } from '../lib/supabase';
import type {
  MoveLogEntry,
  StartMatchResponse,
  SubmitMatchResponse,
} from '../online/types';

const START_TIMEOUT_MS = 2500;
const SUBMIT_TIMEOUT_MS = 8000;

class OnlineMatchServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OnlineMatchServiceError';
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new OnlineMatchServiceError(`${label} timed out.`));
    }, ms);

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

function isStartMatchResponse(value: unknown): value is StartMatchResponse {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.matchId === 'string' &&
    typeof candidate.seed === 'number' &&
    Number.isFinite(candidate.seed) &&
    typeof candidate.startedAt === 'string' &&
    typeof candidate.expiresAt === 'string' &&
    typeof candidate.durationSeconds === 'number'
  );
}

function isSubmitMatchResponse(value: unknown): value is SubmitMatchResponse {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return typeof candidate.verified === 'boolean';
}

export async function startOnlineMatch(): Promise<StartMatchResponse> {
  const invoke = supabase.functions.invoke('start-match', {
    body: { clientVersion: APP_VERSION },
  });

  const { data, error } = await withTimeout(invoke, START_TIMEOUT_MS, 'start-match');

  if (error) {
    throw new OnlineMatchServiceError(error.message || 'Unable to start online match.');
  }

  if (!isStartMatchResponse(data)) {
    throw new OnlineMatchServiceError('Invalid start-match response.');
  }

  return data;
}

export async function submitOnlineMatch(
  matchId: string,
  moves: MoveLogEntry[],
): Promise<SubmitMatchResponse> {
  const invokeOnce = () =>
    supabase.functions.invoke('submit-match', {
      body: { matchId, moves },
    });

  let lastError: unknown;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const { data, error } = await withTimeout(
        invokeOnce(),
        SUBMIT_TIMEOUT_MS,
        'submit-match',
      );

      if (error) {
        throw new OnlineMatchServiceError(error.message || 'Unable to submit match.');
      }

      if (!isSubmitMatchResponse(data)) {
        throw new OnlineMatchServiceError('Invalid submit-match response.');
      }

      return data;
    } catch (error) {
      lastError = error;
      if (attempt === 0) {
        await new Promise((resolve) => setTimeout(resolve, 400));
        continue;
      }
    }
  }

  if (lastError instanceof Error) {
    throw lastError;
  }

  throw new OnlineMatchServiceError('Unable to submit match.');
}

export { OnlineMatchServiceError };
