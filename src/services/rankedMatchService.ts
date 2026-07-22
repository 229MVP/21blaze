import { GAME_RULES_VERSION } from '../game/constants';
import { supabase } from '../lib/supabase';
import type { RankedServerResponse } from '../ranked/types';

const TIMEOUT_MS = 8000;

class RankedMatchServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RankedMatchServiceError';
  }
}

function withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new RankedMatchServiceError(`${label} timed out.`));
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

function isRankedResponse(value: unknown): value is RankedServerResponse {
  if (!value || typeof value !== 'object') {
    return false;
  }
  return typeof (value as { status?: unknown }).status === 'string';
}

async function invoke(
  body: Record<string, unknown>,
  retryTransient = false,
): Promise<RankedServerResponse> {
  let lastError: unknown;
  const attempts = retryTransient ? 2 : 1;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const { data, error } = await withTimeout(
        supabase.functions.invoke('ranked-match', { body }),
        'ranked-match',
      );

      if (error) {
        throw new RankedMatchServiceError(error.message || 'Ranked request failed.');
      }

      if (data && typeof data === 'object' && 'error' in data && !('status' in data)) {
        const message = (data as { error?: unknown }).error;
        throw new RankedMatchServiceError(
          typeof message === 'string' ? message : 'Ranked request failed.',
        );
      }

      if (!isRankedResponse(data)) {
        throw new RankedMatchServiceError('Invalid Ranked response.');
      }

      return data;
    } catch (error) {
      lastError = error;
      if (attempt === 0 && retryTransient) {
        await new Promise((resolve) => setTimeout(resolve, 400));
        continue;
      }
    }
  }

  if (lastError instanceof Error) {
    throw lastError;
  }
  throw new RankedMatchServiceError('Ranked request failed.');
}

export async function joinRankedMatch(region?: string): Promise<RankedServerResponse> {
  return invoke(
    {
      action: 'join',
      region: region ?? 'unknown',
      gameRulesVersion: GAME_RULES_VERSION,
    },
    true,
  );
}

export async function pollRankedMatch(): Promise<RankedServerResponse> {
  return invoke({ action: 'poll' }, true);
}

export async function acceptRankedMatch(matchId: string): Promise<RankedServerResponse> {
  return invoke({ action: 'accept', matchId }, false);
}

export async function declineRankedMatch(matchId: string): Promise<RankedServerResponse> {
  return invoke({ action: 'decline', matchId }, false);
}

export async function cancelRankedMatch(): Promise<RankedServerResponse> {
  return invoke({ action: 'cancel' }, false);
}

export async function reconnectRankedMatch(): Promise<RankedServerResponse> {
  return invoke({ action: 'reconnect' }, true);
}

export async function getRankedProfile(): Promise<RankedServerResponse> {
  return invoke({ action: 'get_profile' }, true);
}

export async function getRankedLeaderboard(
  limit = 100,
): Promise<RankedServerResponse> {
  return invoke({ action: 'get_leaderboard', limit }, true);
}

export async function getRankedHistory(limit = 20): Promise<RankedServerResponse> {
  return invoke({ action: 'get_history', limit }, true);
}

export { RankedMatchServiceError };
