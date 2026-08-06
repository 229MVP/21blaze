import type {
  AsyncChallengeSummary,
  AsyncChallengeStatus,
  PublicAttemptStatus,
} from './types';

export function normalizeAsyncInviteCode(raw: string): string {
  const stripped = raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (stripped.startsWith('BLAZE')) {
    const body = stripped.slice(5);
    if (body.length === 8) {
      return `BLAZE-${body.slice(0, 4)}-${body.slice(4)}`;
    }
    return stripped;
  }
  if (stripped.length === 8) {
    return `BLAZE-${stripped.slice(0, 4)}-${stripped.slice(4)}`;
  }
  return stripped;
}

export function isValidAsyncInviteCodeFormat(code: string): boolean {
  return /^BLAZE-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/.test(code);
}

export type AsyncVerifiedAttemptCompare = {
  verified_score: number;
  verified_exact_21_count: number;
  verified_five_card_clears: number;
  verified_bust_count: number;
  verified_multiplier: number;
  verified_elapsed_time: number | null;
};

export function compareAsyncVerifiedAttempts(
  a: AsyncVerifiedAttemptCompare,
  b: AsyncVerifiedAttemptCompare,
): number {
  if (a.verified_score !== b.verified_score) {
    return a.verified_score > b.verified_score ? 1 : -1;
  }
  if (a.verified_exact_21_count !== b.verified_exact_21_count) {
    return a.verified_exact_21_count > b.verified_exact_21_count ? 1 : -1;
  }
  if (a.verified_five_card_clears !== b.verified_five_card_clears) {
    return a.verified_five_card_clears > b.verified_five_card_clears ? 1 : -1;
  }
  if (a.verified_bust_count !== b.verified_bust_count) {
    return a.verified_bust_count < b.verified_bust_count ? 1 : -1;
  }
  if (a.verified_multiplier !== b.verified_multiplier) {
    return a.verified_multiplier > b.verified_multiplier ? 1 : -1;
  }
  const aElapsed = a.verified_elapsed_time ?? Number.MAX_SAFE_INTEGER;
  const bElapsed = b.verified_elapsed_time ?? Number.MAX_SAFE_INTEGER;
  if (aElapsed !== bElapsed) {
    return aElapsed < bElapsed ? 1 : -1;
  }
  return 0;
}

export function millisecondsUntilExpiration(expiresAt: string, nowMs = Date.now()): number {
  return Math.max(0, Date.parse(expiresAt) - nowMs);
}

export function formatAsyncTimeRemaining(ms: number): string {
  const totalMinutes = Math.max(0, Math.ceil(ms / 60_000));
  if (totalMinutes >= 60) {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return minutes > 0 ? `${hours}H ${minutes}M` : `${hours}H`;
  }
  return `${totalMinutes}M`;
}

const ACTIVE_STATUSES: ReadonlySet<AsyncChallengeStatus> = new Set([
  'open',
  'accepted',
  'in_progress',
  'awaiting_opponent',
  'verifying',
]);

export function isActiveAsyncChallenge(status: AsyncChallengeStatus): boolean {
  return ACTIVE_STATUSES.has(status);
}

export function shouldShowAsyncHubBadge(challenges: AsyncChallengeSummary[]): boolean {
  return challenges.some((challenge) => {
    if (challenge.status === 'completed' && challenge.finalizedAt) {
      return true;
    }
    if (challenge.isYourTurn) {
      return true;
    }
    if (
      challenge.yourAttemptStatus === 'VERIFIED' &&
      challenge.opponent?.attemptStatus !== 'VERIFIED'
    ) {
      return true;
    }
    if (
      challenge.opponent?.attemptStatus === 'VERIFIED' &&
      challenge.yourAttemptStatus !== 'VERIFIED'
    ) {
      return true;
    }
    return false;
  });
}

export function hubSectionForChallenge(
  challenge: AsyncChallengeSummary,
  viewerUserId: string | null,
): 'active' | 'waiting' | 'your_turn' | 'opponent_turn' | 'completed' | 'expired' {
  if (challenge.status === 'expired' || challenge.status === 'cancelled') {
    return 'expired';
  }
  if (challenge.status === 'completed') {
    return 'completed';
  }
  if (challenge.isYourTurn) {
    return 'your_turn';
  }
  if (
    challenge.yourAttemptStatus === 'VERIFIED' &&
    challenge.opponent?.attemptStatus !== 'VERIFIED'
  ) {
    return 'waiting';
  }
  if (
    challenge.opponent?.attemptStatus === 'PLAYED' ||
    challenge.opponent?.attemptStatus === 'VERIFIED'
  ) {
    return 'opponent_turn';
  }
  if (viewerUserId === challenge.creator.userId && !challenge.opponent) {
    return 'waiting';
  }
  return 'active';
}

export function attemptStatusLabel(status: PublicAttemptStatus): string {
  switch (status) {
    case 'WAITING':
      return 'WAITING';
    case 'PLAYED':
      return 'PLAYED';
    case 'VERIFIED':
      return 'VERIFIED';
    default:
      return status;
  }
}
