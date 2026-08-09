import { getUtcChallengeDate, utcNextMidnightForDate } from './utcChallengeDate';

export function millisecondsUntilUtcChallengeReset(nowMs: number = Date.now()): number {
  const today = getUtcChallengeDate(nowMs);
  return Math.max(0, utcNextMidnightForDate(today).getTime() - nowMs);
}

export function formatUtcResetCountdown(nowMs: number = Date.now()): string {
  const totalSeconds = Math.floor(millisecondsUntilUtcChallengeReset(nowMs) / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function formatFriendlyChallengeDate(challengeDate: string): string {
  const parts = challengeDate.split('-').map((part) => Number(part));
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) {
    return challengeDate;
  }
  const [year, month, day] = parts;
  const utcDate = new Date(Date.UTC(year, month - 1, day));
  return utcDate.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

export function formatDurationSeconds(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}
