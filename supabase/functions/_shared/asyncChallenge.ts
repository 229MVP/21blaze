import { GAME_DURATION_SECONDS } from './game/constants.ts';

export const ASYNC_CHALLENGE_RULES_VERSION = 1;
export const ASYNC_CHALLENGE_SCORING_VERSION = 1;
export const ASYNC_CHALLENGE_FINALIZATION_VERSION = 1;
export const ASYNC_CHALLENGE_EXPIRY_HOURS = 48;
export const ASYNC_CHALLENGE_SUBMISSION_GRACE_SECONDS = 30;
export const ASYNC_CHALLENGE_COMPLETION_GRACE_MINUTES = 10;
export const ASYNC_CHALLENGE_RESUME_WINDOW_MS = 5 * 60 * 1000;
export const ASYNC_CHALLENGE_MAX_OPEN_OUTGOING = 5;
export const ASYNC_CHALLENGE_MAX_CREATES_PER_UTC_DAY = 10;
export const ASYNC_INVITE_LOOKUP_MAX_PER_HOUR = 30;

const INVITE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export type AsyncChallengeStatus =
  | 'open'
  | 'accepted'
  | 'in_progress'
  | 'awaiting_opponent'
  | 'verifying'
  | 'completed'
  | 'expired'
  | 'cancelled'
  | 'rejected';

export type AsyncChallengeResultType =
  | 'creator_win'
  | 'opponent_win'
  | 'draw'
  | 'expired'
  | 'cancelled'
  | 'invalid';

export type AsyncChallengeRow = {
  id: string;
  invite_code_hash: string;
  creator_user_id: string;
  opponent_user_id: string | null;
  status: AsyncChallengeStatus;
  seed: number;
  rules_version: number;
  scoring_version: number;
  duration_seconds: number;
  created_at: string;
  accepted_at: string | null;
  expires_at: string;
  completed_at: string | null;
  finalized_at: string | null;
  winner_user_id: string | null;
  result_type: AsyncChallengeResultType | null;
  finalization_version: number;
};

export type AsyncChallengeAttemptRow = {
  id: string;
  challenge_id: string;
  user_id: string;
  status: string;
  started_at: string | null;
  first_move_at: string | null;
  completed_at: string | null;
  verification_status: string;
  verified_score: number | null;
  verified_exact_21_count: number | null;
  verified_five_card_clears: number | null;
  verified_bust_count: number | null;
  verified_multiplier: number | null;
  verified_elapsed_time: number | null;
  verified_clears: number | null;
  rules_version: number | null;
  scoring_version: number | null;
  move_log: unknown;
  game_over_reason: string | null;
  created_at: string;
  updated_at: string;
};

export type VerifiedAsyncAttempt = {
  verified_score: number;
  verified_exact_21_count: number;
  verified_five_card_clears: number;
  verified_bust_count: number;
  verified_multiplier: number;
  verified_elapsed_time: number | null;
};

export function randomAsyncSeed(): number {
  const bytes = new Uint32Array(1);
  crypto.getRandomValues(bytes);
  return (bytes[0] % 0x8000_0000) | 0;
}

export function generateAsyncInviteCode(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  let part1 = '';
  let part2 = '';
  for (let index = 0; index < 4; index += 1) {
    part1 += INVITE_ALPHABET[bytes[index]! % INVITE_ALPHABET.length];
    part2 += INVITE_ALPHABET[bytes[index + 4]! % INVITE_ALPHABET.length];
  }
  return `BLAZE-${part1}-${part2}`;
}

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

export async function hashAsyncInviteCode(normalizedCode: string): Promise<string> {
  const data = new TextEncoder().encode(normalizedCode);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export function getUtcDayKey(nowMs = Date.now()): string {
  return new Date(nowMs).toISOString().slice(0, 10);
}

export function challengeExpiresAtIso(nowMs = Date.now()): string {
  return new Date(nowMs + ASYNC_CHALLENGE_EXPIRY_HOURS * 60 * 60 * 1000).toISOString();
}

export function attemptExpiresAtIso(startedAtIso: string, durationSeconds = GAME_DURATION_SECONDS): string {
  const startedMs = Date.parse(startedAtIso);
  const graceMs =
    (durationSeconds + ASYNC_CHALLENGE_SUBMISSION_GRACE_SECONDS) * 1000;
  return new Date(startedMs + graceMs).toISOString();
}

export function isPastChallengeExpiration(expiresAtIso: string, nowMs = Date.now()): boolean {
  return nowMs >= Date.parse(expiresAtIso);
}

export function isPastCompletionGrace(
  expiresAtIso: string,
  nowMs = Date.now(),
): boolean {
  const graceMs = ASYNC_CHALLENGE_COMPLETION_GRACE_MINUTES * 60 * 1000;
  return nowMs > Date.parse(expiresAtIso) + graceMs;
}

export function compareAsyncVerifiedAttempts(
  a: VerifiedAsyncAttempt,
  b: VerifiedAsyncAttempt,
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

export type PublicParticipantAttemptStatus = 'WAITING' | 'PLAYED' | 'VERIFIED';

export function mapPublicAttemptStatus(
  attempt: AsyncChallengeAttemptRow | null | undefined,
): PublicParticipantAttemptStatus {
  if (!attempt) {
    return 'WAITING';
  }
  if (attempt.verification_status === 'verified' && attempt.status === 'completed') {
    return 'VERIFIED';
  }
  if (
    attempt.status === 'completed' ||
    attempt.status === 'abandoned' ||
    attempt.status === 'rejected' ||
    attempt.first_move_at !== null
  ) {
    return 'PLAYED';
  }
  return 'WAITING';
}

export async function finalizeExpiredAsyncChallenges(
  admin: { rpc: (fn: string) => Promise<{ error: unknown }> },
): Promise<void> {
  const { error } = await admin.rpc('finalize_expired_async_challenges');
  if (error) {
    throw new Error('Unable to finalize expired async challenges.');
  }
}

export async function loadPublicProfile(
  admin: { from: (table: string) => any },
  userId: string,
): Promise<{
  displayName: string;
  profileFrameId: string;
  playerTitleId: string | null;
  level: number | null;
}> {
  const { data: profile } = await admin
    .from('profiles')
    .select('display_name')
    .eq('id', userId)
    .maybeSingle();

  const { data: equipped } = await admin
    .from('equipped_cosmetics')
    .select('profile_frame, player_title')
    .eq('user_id', userId)
    .maybeSingle();

  const { data: progression } = await admin
    .from('player_progression')
    .select('level')
    .eq('user_id', userId)
    .maybeSingle();

  const suffix = userId.replace(/-/g, '').slice(-4);
  const rawName = profile?.display_name ? String(profile.display_name).trim() : '';
  const displayName =
    rawName.length >= 3 ? rawName.slice(0, 20) : `Blazer ${suffix}`;

  return {
    displayName,
    profileFrameId: equipped?.profile_frame ?? 'default_profile_frame',
    playerTitleId: equipped?.player_title ?? null,
    level: progression?.level ?? null,
  };
}
