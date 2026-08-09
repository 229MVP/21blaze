import { applyXpGrant } from '../progression/levelEngine';
import { getLevelFromLifetimeXp, getXpRequiredForLevel } from '../progression/xpCurve';
import { xpAmountForSource, XP_SOURCES } from '../progression/xpSources';
import { getNextUnlockEntry } from '../progression/progressionRewardRegistry';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Phase 4 progression self-test failed: ${message}`);
  }
}

export function runDailyChallengePhase4SelfTests(): void {
  assert(XP_SOURCES.length >= 4, 'XP source registry populated');
  assert(xpAmountForSource('SOLO_COMPLETION') === 25, 'solo XP amount');
  assert(xpAmountForSource('DAILY_CHALLENGE_COMPLETION') === 75, 'daily XP amount');

  const soloOnce = applyXpGrant(
    { level: 1, totalXp: 0, currentLevelXp: 0, highestLevelReached: 1 },
    25,
  );
  assert(soloOnce.xpGranted === 25 && !soloOnce.alreadyProcessed, 'solo grant once');

  const soloDup = applyXpGrant(
    { level: 1, totalXp: 25, currentLevelXp: 25, highestLevelReached: 1 },
    25,
    true,
  );
  assert(soloDup.alreadyProcessed && soloDup.xpGranted === 0, 'repeated results no duplicate');

  const incomplete = applyXpGrant(
    { level: 1, totalXp: 0, currentLevelXp: 0, highestLevelReached: 1 },
    0,
  );
  assert(incomplete.xpGranted === 0, 'incomplete grants no XP');

  const dailyXp = xpAmountForSource('DAILY_CHALLENGE_COMPLETION');
  const afterDaily = applyXpGrant(
    { level: 1, totalXp: 0, currentLevelXp: 0, highestLevelReached: 1 },
    dailyXp,
  );
  assert(afterDaily.xpGranted === 75, 'daily ranked completion XP');

  const practiceXp = applyXpGrant(
    { level: 1, totalXp: 0, currentLevelXp: 0, highestLevelReached: 1 },
    0,
  );
  assert(practiceXp.xpGranted === 0, 'practice path uses zero client grant');

  const bigGrant = applyXpGrant(
    { level: 4, totalXp: 2000, currentLevelXp: 100, highestLevelReached: 4 },
    900,
  );
  assert(bigGrant.levelAfter > 4, 'large XP may cross multiple levels');

  const levelFromXp = getLevelFromLifetimeXp(500 + 600 + 500);
  assert(levelFromXp.level === 3 && levelFromXp.currentLevelXp === 500, 'deterministic level math');

  const next = getNextUnlockEntry(9);
  assert(next?.level === 10, 'next unlock after level 9 is level 10');

  const deferred = getNextUnlockEntry(4);
  assert(deferred?.level === 5 && deferred.deferred === true, 'level 5 board skin deferred');

  assert(getXpRequiredForLevel(1) + getXpRequiredForLevel(2) === 1100, 'curve sums');
}

runDailyChallengePhase4SelfTests();
