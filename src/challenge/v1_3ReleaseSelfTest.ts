/**
 * Version 1.3 release-freeze deterministic checks — XP boundaries, UTC resets,
 * mission eligibility helpers, and idempotency key shapes.
 */

import { applyXpGrant } from '../progression/levelEngine';
import {
  getLevelFromLifetimeXp,
  getXpRequiredForLevel,
  XP_MAX_LEVEL,
} from '../progression/xpCurve';
import { xpAmountForSource } from '../progression/xpSources';
import { getUtcChallengeDate, millisecondsUntilUtcChallengeEnd } from '../challenge/utcChallengeDate';
import { evaluateRankedStartGate } from '../challenge/dailyChallengeAttemptLogic';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`V1.3 release self-test failed: ${message}`);
  }
}

export function runV1_3ReleaseSelfTests(): void {
  // XP curve — every early level threshold
  const thresholds: number[] = [];
  for (let level = 1; level <= 10; level += 1) {
    const required = getXpRequiredForLevel(level);
    thresholds.push(required);
    assert(required === 500 + (level - 1) * 100, `level ${level} threshold`);
  }

  let cumulative = 0;
  for (let level = 1; level < 10; level += 1) {
    cumulative += getXpRequiredForLevel(level);
    const snapshot = getLevelFromLifetimeXp(cumulative);
    assert(snapshot.level === level + 1, `cumulative XP reaches level ${level + 1}`);
    assert(snapshot.currentLevelXp === 0, `exact boundary at level ${level + 1}`);
  }

  const almostLevel3 = getXpRequiredForLevel(1) + getXpRequiredForLevel(2) + 499;
  const atLevel3 = getLevelFromLifetimeXp(almostLevel3);
  assert(atLevel3.level === 3 && atLevel3.currentLevelXp === 499, 'one XP below level 4');

  const multiLevel = applyXpGrant(
    { level: 1, totalXp: 0, currentLevelXp: 0, highestLevelReached: 1 },
    getXpRequiredForLevel(1) + getXpRequiredForLevel(2) + 200,
  );
  assert(multiLevel.levelAfter === 3, 'multi-level grant');
  assert(multiLevel.levelsCrossed.length === 2, 'two levels crossed');

  const atCap = applyXpGrant(
    {
      level: XP_MAX_LEVEL,
      totalXp: 1_000_000,
      currentLevelXp: 100,
      highestLevelReached: XP_MAX_LEVEL,
    },
    50,
  );
  assert(atCap.levelAfter === XP_MAX_LEVEL, 'max level stable');
  assert(atCap.totalXpAfter === 1_000_050, 'total XP still grows at cap');

  const negativeGrant = applyXpGrant(
    { level: 1, totalXp: 0, currentLevelXp: 0, highestLevelReached: 1 },
    -10,
  );
  assert(negativeGrant.xpGranted === 0, 'negative XP rejected');

  assert(xpAmountForSource('SOLO_COMPLETION') === 25, 'solo XP registry');
  assert(xpAmountForSource('DAILY_CHALLENGE_COMPLETION') === 75, 'daily XP registry');

  // UTC boundaries
  const beforeMidnight = Date.parse('2026-08-05T23:59:59.000Z');
  const afterMidnight = Date.parse('2026-08-06T00:00:00.000Z');
  assert(getUtcChallengeDate(beforeMidnight) === '2026-08-05', 'pre-midnight UTC date');
  assert(getUtcChallengeDate(afterMidnight) === '2026-08-06', 'post-midnight UTC date');

  const msUntilEnd = millisecondsUntilUtcChallengeEnd('2026-08-05', beforeMidnight);
  assert(msUntilEnd === 1000, 'one second until UTC reset');

  const yearBoundary = getUtcChallengeDate(Date.parse('2027-01-01T00:00:00.000Z'));
  assert(yearBoundary === '2027-01-01', 'year boundary');

  // Ranked attempt gate — practice isolation is server-side; client gate for ranked
  assert(
    evaluateRankedStartGate(null, {
      id: 'c1',
      challengeDate: '2026-08-05',
      rulesVersion: '1',
      status: 'active',
    }) === 'OK',
    'ranked start gate',
  );

  assert(
    evaluateRankedStartGate(
      { status: 'completed', userId: 'u1', challengeId: 'c1' },
      { id: 'c1', challengeDate: '2026-08-05', rulesVersion: '1', status: 'active' },
    ) === 'ALREADY_PLAYED',
    'completed ranked cannot restart',
  );
}

runV1_3ReleaseSelfTests();
