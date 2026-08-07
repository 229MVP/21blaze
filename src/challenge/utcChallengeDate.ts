/**
 * UTC calendar date utilities for Daily Challenge.
 * Official challenge identity resets at 00:00 UTC — never device local midnight.
 */

/** Returns YYYY-MM-DD for the instant in UTC. */
export function getUtcChallengeDate(nowMs: number = Date.now()): string {
  return new Date(nowMs).toISOString().slice(0, 10);
}

export function utcMidnightForDate(challengeDate: string): Date {
  return new Date(`${challengeDate}T00:00:00.000Z`);
}

export function utcNextMidnightForDate(challengeDate: string): Date {
  return new Date(utcMidnightForDate(challengeDate).getTime() + 24 * 60 * 60 * 1000);
}

export function isUtcChallengeDate(challengeDate: string, nowMs: number = Date.now()): boolean {
  return challengeDate === getUtcChallengeDate(nowMs);
}

export function millisecondsUntilUtcChallengeEnd(
  challengeDate: string,
  nowMs: number = Date.now(),
): number {
  return Math.max(0, utcNextMidnightForDate(challengeDate).getTime() - nowMs);
}
