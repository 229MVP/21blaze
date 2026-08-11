import type { LiveMatchErrorCode } from './livePvpTypes';

const MESSAGES: Record<LiveMatchErrorCode, string> = {
  LIVE_PVP_DISABLED: 'Live PvP is temporarily unavailable.',
  SELF_INVITE: 'You cannot challenge yourself.',
  PLAYER_NOT_FOUND: 'This player is no longer available.',
  PLAYER_NOT_ELIGIBLE: 'This player cannot receive Live challenges right now.',
  ACTIVE_MATCH_LIMIT: 'You already have an active Live match.',
  INVITE_LIMIT: 'You have too many pending Live invitations.',
  DUPLICATE_INVITE: 'You already have a Live match with this player.',
  MATCH_NOT_FOUND: 'This Live match is no longer available.',
  NOT_PARTICIPANT: 'You are not part of this Live match.',
  INVALID_MATCH_STATE: 'This Live match is no longer available.',
  INVITE_EXPIRED: 'This invitation expired.',
  ALREADY_ACCEPTED: 'This invitation was already accepted.',
  ALREADY_READY: 'You are already ready.',
  COUNTDOWN_ALREADY_SCHEDULED: 'The match is already starting.',
  MATCH_NOT_ACTIVE: 'This Live match is not active yet.',
  PROGRESS_RATE_LIMITED: 'Live score updates are catching up.',
  STALE_PROGRESS_SEQUENCE: 'Live score updates are catching up.',
  ATTEMPT_ALREADY_COMPLETED: 'Your Live result was already submitted.',
  SUBMISSION_TOO_LATE: 'The official match deadline passed.',
  MATCH_ALREADY_SETTLED: 'This match is already complete.',
  PROTOCOL_VERSION_UNSUPPORTED: 'Update 21 Blaze to play this Live match.',
  REMATCH_NOT_ELIGIBLE: 'This match cannot be rematched.',
  NOT_AUTHENTICATED: 'Sign in to play Live PvP.',
  UNKNOWN: 'Something went wrong. Please try again.',
};

export function mapLivePvpErrorMessage(code: LiveMatchErrorCode | string): string {
  if (code in MESSAGES) {
    return MESSAGES[code as LiveMatchErrorCode];
  }
  if (code === 'CHANNEL_AUTH_FAILED') {
    return 'We couldn’t securely join this match.';
  }
  if (code === 'CONNECTION_TIMEOUT') {
    return 'The live connection timed out.';
  }
  return MESSAGES.UNKNOWN;
}
