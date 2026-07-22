import { GAME_RULES_VERSION } from '../game/constants';
import { supabase } from '../lib/supabase';
import type { QuickMatchResponse } from '../matchmaking/types';

const TIMEOUT_MS = 8000;

class QuickMatchServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'QuickMatchServiceError';
  }
}

function withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new QuickMatchServiceError(`${label} timed out.`));
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

function isQuickMatchResponse(value: unknown): value is QuickMatchResponse {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const status = (value as { status?: unknown }).status;
  return typeof status === 'string';
}

async function invoke(
  body: Record<string, unknown>,
  retryTransient = false,
): Promise<QuickMatchResponse> {
  let lastError: unknown;

  const attempts = retryTransient ? 2 : 1;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const { data, error } = await withTimeout(
        supabase.functions.invoke('quick-match', { body }),
        'quick-match',
      );

      if (error) {
        throw new QuickMatchServiceError(error.message || 'Quick Match request failed.');
      }

      if (data && typeof data === 'object' && 'error' in data && !('status' in data)) {
        const message = (data as { error?: unknown }).error;
        throw new QuickMatchServiceError(
          typeof message === 'string' ? message : 'Quick Match request failed.',
        );
      }

      if (!isQuickMatchResponse(data)) {
        throw new QuickMatchServiceError('Invalid Quick Match response.');
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
  throw new QuickMatchServiceError('Quick Match request failed.');
}

export async function joinQuickMatch(region?: string): Promise<QuickMatchResponse> {
  return invoke(
    {
      action: 'join',
      region: region ?? 'unknown',
      gameRulesVersion: GAME_RULES_VERSION,
    },
    true,
  );
}

export async function pollQuickMatch(): Promise<QuickMatchResponse> {
  return invoke({ action: 'poll' }, true);
}

export async function acceptQuickMatch(matchId: string): Promise<QuickMatchResponse> {
  return invoke({ action: 'accept', matchId }, false);
}

export async function declineQuickMatch(matchId: string): Promise<QuickMatchResponse> {
  return invoke({ action: 'decline', matchId }, false);
}

export async function cancelQuickMatch(): Promise<QuickMatchResponse> {
  return invoke({ action: 'cancel' }, false);
}

export async function reconnectQuickMatch(): Promise<QuickMatchResponse> {
  return invoke({ action: 'reconnect' }, true);
}

export { QuickMatchServiceError };
