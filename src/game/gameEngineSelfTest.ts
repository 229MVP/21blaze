import { GAME_DURATION_SECONDS } from './constants';
import {
  calculateElapsedGameMilliseconds,
  calculateTimeRemainingSeconds,
  isTimerExpired,
} from './timerEngine';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Self-test failed: ${message}`);
  }
}

export function runGameEngineSelfTests(): void {
  assert(
    calculateTimeRemainingSeconds(GAME_DURATION_SECONDS, 0) === 120,
    'A new timer starts at 120 seconds',
  );

  assert(
    calculateTimeRemainingSeconds(GAME_DURATION_SECONDS, 0) === 120,
    'Zero elapsed milliseconds returns 120 seconds',
  );

  assert(
    calculateTimeRemainingSeconds(GAME_DURATION_SECONDS, 30_000) === 90,
    '30,000 elapsed milliseconds returns 90 seconds',
  );

  assert(
    calculateTimeRemainingSeconds(GAME_DURATION_SECONDS, 119_100) === 1,
    '119,100 elapsed milliseconds returns 1 second',
  );

  assert(
    calculateTimeRemainingSeconds(GAME_DURATION_SECONDS, 120_000) === 0,
    '120,000 elapsed milliseconds returns 0 seconds',
  );

  assert(
    calculateTimeRemainingSeconds(GAME_DURATION_SECONDS, 150_000) === 0,
    'Remaining time never becomes negative',
  );

  const elapsedWithPause = calculateElapsedGameMilliseconds(100_000, 0, 30_000);
  assert(
    elapsedWithPause === 70_000,
    'Paused milliseconds are excluded from elapsed game time',
  );
  assert(
    calculateTimeRemainingSeconds(GAME_DURATION_SECONDS, elapsedWithPause) === 50,
    'Paused time yields the correct remaining seconds',
  );

  assert(isTimerExpired(0) === true, 'Timer expiration is true at zero');
  assert(isTimerExpired(1) === false, 'Timer expiration is false above zero');
}

runGameEngineSelfTests();
