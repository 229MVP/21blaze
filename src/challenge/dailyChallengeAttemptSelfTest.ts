import {
  evaluateRankedStartGate,
  parseDailyChallengeStartResult,
  validateCompletionPayload,
} from './dailyChallengeAttemptLogic';
import { deriveAuthoritativeSeed } from './seedDerivation';
import { getUtcChallengeDate } from './utcChallengeDate';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Daily Challenge attempt self-test failed: ${message}`);
  }
}

const challengeId = 'challenge-1';
const userA = 'user-a';
const userB = 'user-b';
const challengeDate = '2026-08-05';

function baseChallenge(status = 'active') {
  return {
    id: challengeId,
    challengeDate,
    rulesVersion: '1',
    status,
  };
}

export function runDailyChallengeAttemptSelfTests(): void {
  assert(
    evaluateRankedStartGate(null, baseChallenge()) === 'OK',
    'first ranked attempt succeeds',
  );

  assert(
    evaluateRankedStartGate(
      {
        status: 'completed',
        userId: userA,
        challengeId,
      },
      baseChallenge(),
    ) === 'ALREADY_PLAYED',
    'second ranked attempt for same challenge is rejected',
  );

  const doubleTapFirst = evaluateRankedStartGate(null, baseChallenge());
  const doubleTapSecond = evaluateRankedStartGate(
    {
      status: 'started',
      userId: userA,
      challengeId,
    },
    baseChallenge(),
  );
  assert(doubleTapFirst === 'OK', 'double tap first call can start');
  assert(doubleTapSecond === 'RESUME', 'double tap cannot create two attempts');

  const retryFirst = evaluateRankedStartGate(null, baseChallenge());
  const retrySecond = evaluateRankedStartGate(
    {
      status: 'started',
      userId: userA,
      challengeId,
    },
    baseChallenge(),
  );
  assert(retryFirst === 'OK' && retrySecond === 'RESUME', 'network retry resumes same attempt');

  assert(
    evaluateRankedStartGate(null, baseChallenge()) === 'OK',
    'another user can start their own attempt when no local record exists',
  );

  const completionPayload = {
    attemptId: 'attempt-1',
    score: 1200,
    exact21Count: 2,
    fiveCardClearCount: 1,
    bustCount: 1,
    cardsPlayed: 40,
    completionMs: 95_000,
    rulesVersion: '1',
  };

  assert(
    validateCompletionPayload(
      { status: 'started', userId: userA, challengeId },
      baseChallenge(),
      completionPayload,
      userB,
      Date.parse('2026-08-05T12:00:00.000Z'),
    ) === 'attempt_not_owned',
    'user cannot complete another user attempt',
  );

  assert(
    validateCompletionPayload(
      { status: 'completed', userId: userA, challengeId },
      baseChallenge(),
      completionPayload,
      userA,
      Date.parse('2026-08-05T12:00:00.000Z'),
    ) === 'already_completed',
    'attempt cannot complete twice',
  );

  assert(
    validateCompletionPayload(
      { status: 'started', userId: userA, challengeId },
      baseChallenge(),
      { ...completionPayload, score: -1 },
      userA,
      Date.parse('2026-08-05T12:00:00.000Z'),
    ) === 'invalid_score',
    'invalid score is rejected',
  );

  assert(
    validateCompletionPayload(
      { status: 'started', userId: userA, challengeId },
      baseChallenge(),
      { ...completionPayload, bustCount: -2 },
      userA,
      Date.parse('2026-08-05T12:00:00.000Z'),
    ) === 'invalid_counters',
    'invalid counters are rejected',
  );

  assert(
    validateCompletionPayload(
      { status: 'started', userId: userA, challengeId },
      baseChallenge(),
      { ...completionPayload, rulesVersion: '99' },
      userA,
      Date.parse('2026-08-05T12:00:00.000Z'),
    ) === 'rules_version_mismatch',
    'challenge rules version mismatch is rejected',
  );

  assert(
    evaluateRankedStartGate(null, baseChallenge('closed')) === 'CHALLENGE_DISABLED',
    'disabled challenge cannot start',
  );

  const utcInstant = Date.parse('2026-08-05T23:59:59.000Z');
  const nextUtcInstant = Date.parse('2026-08-06T00:00:01.000Z');
  assert(
    getUtcChallengeDate(utcInstant) === challengeDate,
    'UTC date before midnight maps to same challenge date',
  );
  assert(
    getUtcChallengeDate(nextUtcInstant) === '2026-08-06',
    'UTC date boundary advances challenge date at 00:00 UTC',
  );

  const seedTokyo = deriveAuthoritativeSeed(getUtcChallengeDate(utcInstant));
  const seedNewYork = deriveAuthoritativeSeed(getUtcChallengeDate(utcInstant));
  assert(seedTokyo === seedNewYork, 'same UTC instant yields same authoritative seed globally');

  const parsed = parseDailyChallengeStartResult({
    attemptId: 'a',
    challengeId: challengeId,
    challengeDate,
    seed: deriveAuthoritativeSeed(challengeDate),
    rulesVersion: '1',
    deckVersion: '1',
    durationSeconds: 120,
    bustLimit: 3,
    startedAt: '2026-08-05T00:00:00.000Z',
    resumed: false,
  });
  if ('error' in parsed) {
    throw new Error('expected successful start parse');
  }
  assert(parsed.attemptId === 'a', 'start response parser accepts valid payload');
}

void (async () => {
  runDailyChallengeAttemptSelfTests();
  console.log('Daily Challenge attempt self-tests passed.');
})().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
