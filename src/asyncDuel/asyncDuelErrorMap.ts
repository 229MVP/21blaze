import type { AsyncDuelErrorCode } from './asyncDuelTypes';

const MESSAGES: Record<AsyncDuelErrorCode, string> = {
  SELF_CHALLENGE: 'You cannot challenge yourself.',
  PLAYER_NOT_FOUND: 'This player is no longer available.',
  PLAYER_NOT_ELIGIBLE: 'This player cannot receive challenges right now.',
  ACTIVE_DUEL_LIMIT: 'You have too many active challenges.',
  DUPLICATE_ACTIVE_DUEL: 'You already have an active duel with this player.',
  DUEL_NOT_FOUND: 'This challenge is no longer available.',
  NOT_PARTICIPANT: 'You are not part of this challenge.',
  INVALID_DUEL_STATE: 'This challenge is no longer available.',
  ALREADY_STARTED: 'This duel has already started.',
  ALREADY_COMPLETED: 'This duel is already complete.',
  DECLINED: 'This challenge was declined.',
  EXPIRED: 'This challenge has expired.',
  INVALID_RESULT: 'That result could not be verified.',
  ASYNC_DUEL_DISABLED: 'Async Duel is unavailable right now.',
  NOT_AUTHENTICATED: 'Sign in to play Async Duel.',
  UNKNOWN: 'Something went wrong. Please try again.',
};

export function mapAsyncDuelErrorMessage(code: AsyncDuelErrorCode | string): string {
  if (code in MESSAGES) {
    return MESSAGES[code as AsyncDuelErrorCode];
  }
  return MESSAGES.UNKNOWN;
}
