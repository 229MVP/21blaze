import {
  DAILY_CHALLENGE_RULES_VERSION,
  DAILY_CHALLENGE_SCORING_VERSION,
  type DailyChallengeConfig,
} from './types';

export const DAILY_CHALLENGE_DURATION_SECONDS = 120;
export const DAILY_CHALLENGE_SUBMISSION_GRACE_SECONDS = 30;

/**
 * Derives a deterministic signed 32-bit seed from a UTC calendar date.
 * Same date ⇒ same seed for every player. Does not use device randomness.
 */
export function deriveDailyChallengeSeed(challengeDate: string): number {
  const input = `21blaze-daily-v1:${challengeDate}`;
  let hash = 2_166_136_261 >>> 0;

  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 1_677_761_9) >>> 0;
  }

  return (hash % 0x8000_0000) | 0;
}

/** Returns the UTC calendar date (YYYY-MM-DD) for a supplied epoch milliseconds value. */
export function getUtcChallengeDate(nowMs: number): string {
  return new Date(nowMs).toISOString().slice(0, 10);
}

/** UTC midnight for the supplied calendar date. */
export function utcMidnightForDate(challengeDate: string): Date {
  return new Date(`${challengeDate}T00:00:00.000Z`);
}

/** UTC midnight of the next calendar day. */
export function utcNextMidnightForDate(challengeDate: string): Date {
  const start = utcMidnightForDate(challengeDate);
  return new Date(start.getTime() + 24 * 60 * 60 * 1000);
}

export function createDailyChallengeConfig(
  challengeDate: string,
  challengeId = `local-${challengeDate}`,
): DailyChallengeConfig {
  const startsAt = utcMidnightForDate(challengeDate).toISOString();
  const endsAt = utcNextMidnightForDate(challengeDate).toISOString();

  return {
    challengeId,
    challengeDate,
    seed: deriveDailyChallengeSeed(challengeDate),
    rulesVersion: DAILY_CHALLENGE_RULES_VERSION,
    scoringVersion: DAILY_CHALLENGE_SCORING_VERSION,
    durationSeconds: DAILY_CHALLENGE_DURATION_SECONDS,
    startsAt,
    endsAt,
  };
}

export function isChallengeDateActive(
  challengeDate: string,
  nowMs: number,
): boolean {
  const today = getUtcChallengeDate(nowMs);
  return challengeDate === today;
}

export function millisecondsUntilChallengeEnds(
  challengeDate: string,
  nowMs: number,
): number {
  const endsAt = utcNextMidnightForDate(challengeDate).getTime();
  return Math.max(0, endsAt - nowMs);
}
