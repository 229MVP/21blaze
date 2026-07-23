import { GAME_DURATION_SECONDS } from './constants';

export function calculateElapsedGameMilliseconds(
  now: number,
  gameStartedAt: number,
  totalPausedMilliseconds: number,
): number {
  const elapsed = now - gameStartedAt - totalPausedMilliseconds;
  return Math.max(0, elapsed);
}

export function calculateTimeRemainingSeconds(
  durationSeconds: number,
  elapsedMilliseconds: number,
): number {
  const remainingMilliseconds = durationSeconds * 1000 - elapsedMilliseconds;

  if (remainingMilliseconds <= 0) {
    return 0;
  }

  const remainingSeconds = Math.ceil(remainingMilliseconds / 1000);
  return Math.min(durationSeconds, Math.max(0, remainingSeconds));
}

export function isTimerExpired(timeRemainingSeconds: number): boolean {
  return timeRemainingSeconds <= 0;
}

export function getClampedMatchRemainingSeconds(
  now: number,
  gameStartedAt: number,
  totalPausedMilliseconds: number,
  durationSeconds: number = GAME_DURATION_SECONDS,
): number {
  const elapsed = calculateElapsedGameMilliseconds(
    now,
    gameStartedAt,
    totalPausedMilliseconds,
  );
  return calculateTimeRemainingSeconds(durationSeconds, elapsed);
}

export function formatTimerSeconds(totalSeconds: number): string {
  const clamped = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(clamped / 60);
  const seconds = clamped % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}
