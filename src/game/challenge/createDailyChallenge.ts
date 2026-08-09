import {
  DAILY_CHALLENGE_BUST_LIMIT,
  DAILY_CHALLENGE_DECK_VERSION,
  DAILY_CHALLENGE_DURATION_SECONDS,
  DAILY_CHALLENGE_RULES_VERSION,
} from '../../challenge/dailyChallengeRegistry';
import { deriveNumericSeedFromAuthoritative, deriveAuthoritativeSeed } from '../../challenge/seedDerivation';
import {
  getUtcChallengeDate,
  isUtcChallengeDate,
  millisecondsUntilUtcChallengeEnd,
  utcMidnightForDate,
  utcNextMidnightForDate,
} from '../../challenge/utcChallengeDate';
import type { DailyChallengeConfig } from './types';

export const DAILY_CHALLENGE_SUBMISSION_GRACE_SECONDS = 30;

export {
  getUtcChallengeDate,
  utcMidnightForDate,
  utcNextMidnightForDate,
};

/** Legacy numeric seed helper for tests comparing deck derivation. */
export function deriveDailyChallengeSeed(challengeDate: string): number {
  return deriveNumericSeedFromAuthoritative(deriveAuthoritativeSeed(challengeDate));
}

export function createDailyChallengeConfig(
  challengeDate: string,
  challengeId = `local-${challengeDate}`,
): DailyChallengeConfig {
  return {
    challengeId,
    challengeDate,
    rulesVersion: String(DAILY_CHALLENGE_RULES_VERSION),
    deckVersion: String(DAILY_CHALLENGE_DECK_VERSION),
    durationSeconds: DAILY_CHALLENGE_DURATION_SECONDS,
    bustLimit: DAILY_CHALLENGE_BUST_LIMIT,
    status: 'active',
    authoritativeSeed: deriveAuthoritativeSeed(challengeDate),
  };
}

export function isChallengeDateActive(
  challengeDate: string,
  nowMs: number,
): boolean {
  return isUtcChallengeDate(challengeDate, nowMs);
}

export function millisecondsUntilChallengeEnds(
  challengeDate: string,
  nowMs: number,
): number {
  return millisecondsUntilUtcChallengeEnd(challengeDate, nowMs);
}
