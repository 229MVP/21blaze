import {
  DAILY_CHALLENGE_DURATION_SECONDS,
  DAILY_CHALLENGE_RULES_VERSION,
} from '../../challenge/dailyChallengeRegistry';
import { deriveDailyChallengeSeed } from '../../challenge/seedDerivation';
import {
  getUtcChallengeDate,
  isUtcChallengeDate,
  millisecondsUntilUtcChallengeEnd,
  utcMidnightForDate,
  utcNextMidnightForDate,
} from '../../challenge/utcChallengeDate';
import {
  DAILY_CHALLENGE_SCORING_VERSION,
  type DailyChallengeConfig,
} from './types';

export const DAILY_CHALLENGE_SUBMISSION_GRACE_SECONDS = 30;

export {
  getUtcChallengeDate,
  utcMidnightForDate,
  utcNextMidnightForDate,
  deriveDailyChallengeSeed,
};

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
    rulesVersion: Number(DAILY_CHALLENGE_RULES_VERSION),
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
  return isUtcChallengeDate(challengeDate, nowMs);
}

export function millisecondsUntilChallengeEnds(
  challengeDate: string,
  nowMs: number,
): number {
  return millisecondsUntilUtcChallengeEnd(challengeDate, nowMs);
}
