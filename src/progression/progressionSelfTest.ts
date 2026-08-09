import { xpRequiredForLevel } from '../config/progressionConfig';
import { applyXpGrant } from './levelEngine';
import { evaluateDailyClaim, matchXpForMode } from './dailyClaimEngine';
import {
  cosmeticsGrantedAtLevel,
  dailyRewardForStreakDay,
  getLevelReward,
} from './rewards';
import {
  getLevelFromLifetimeXp,
  getXpRequiredForLevel,
  getProgressToNextLevel,
} from './xpCurve';
import { xpAmountForSource } from './xpSources';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Progression self-test failed: ${message}`);
  }
}

export function runProgressionSelfTests(): void {
  assert(getXpRequiredForLevel(1) === 500, 'Level 1 requires 500 XP');
  assert(getXpRequiredForLevel(2) === 600, 'Level 2 requires 600 XP');
  assert(getXpRequiredForLevel(3) === 700, 'Level 3 requires 700 XP');
  assert(getXpRequiredForLevel(4) === 800, 'Level 4 requires 800 XP');
  assert(getXpRequiredForLevel(50) === 0, 'Level 50 has no next requirement');
  assert(xpRequiredForLevel(1) === 500, 'config curve matches registry');

  const fromLifetime = getLevelFromLifetimeXp(500);
  assert(fromLifetime.level === 2, '500 lifetime XP is level 2');
  assert(fromLifetime.currentLevelXp === 0, 'exact level boundary');

  const progress = getProgressToNextLevel(500 + 600 + 500);
  assert(progress.level === 3, 'progress at level 3');
  assert(progress.currentLevelXp === 500, '500 XP into level 3');

  const carry = applyXpGrant(
    { level: 1, totalXp: 0, currentLevelXp: 0, highestLevelReached: 1 },
    550,
  );
  assert(carry.levelAfter === 2, '550 XP reaches level 2');
  assert(carry.currentLevelXp === 50, 'excess XP carries (550-500=50)');

  const multi = applyXpGrant(
    { level: 1, totalXp: 0, currentLevelXp: 0, highestLevelReached: 1 },
    500 + 600 + 50,
  );
  assert(multi.levelAfter === 3, 'large grant crosses multiple levels');
  assert(multi.levelsCrossed.length === 2, 'crossed 2 and 3');

  const nearCap = applyXpGrant(
    {
      level: 49,
      totalXp: 10_000,
      currentLevelXp: 0,
      highestLevelReached: 49,
    },
    10_000,
  );
  assert(nearCap.levelAfter === 50, 'level cannot exceed 50');

  const dup = applyXpGrant(
    { level: 1, totalXp: 0, currentLevelXp: 0, highestLevelReached: 1 },
    50,
    true,
  );
  assert(dup.alreadyProcessed && dup.xpGranted === 0, 'duplicate idempotent');

  assert(matchXpForMode('solo') === 25, 'solo 25 XP');
  assert(matchXpForMode('casual') === 75, 'casual 75 XP');
  assert(matchXpForMode('ranked') === 100, 'ranked 100 XP');
  assert(
    xpAmountForSource('DAILY_CHALLENGE_COMPLETION') === 75,
    'daily challenge 75 XP',
  );

  const now = Date.parse('2026-07-22T12:00:00.000Z');
  const tooSoon = evaluateDailyClaim({
    nowMs: now,
    lastClaimAtMs: now - 5 * 60 * 60 * 1000,
    currentStreak: 2,
  });
  assert(!tooSoon.eligible && tooSoon.reason === 'too_soon', '20h gate');

  const continueStreak = evaluateDailyClaim({
    nowMs: now,
    lastClaimAtMs: now - 24 * 60 * 60 * 1000,
    currentStreak: 3,
  });
  assert(continueStreak.eligible === true, 'claim after 20h');

  const reset = evaluateDailyClaim({
    nowMs: now,
    lastClaimAtMs: now - 49 * 60 * 60 * 1000,
    currentStreak: 6,
  });
  assert(reset.eligible === true, 'claim after reset window');

  const day7 = dailyRewardForStreakDay(7);
  assert(day7.day === 7 && day7.cosmeticId === 'seven_day_blaze_title', 'day 7 cosmetic');

  const level3 = getLevelReward(3);
  assert(level3?.cosmeticId === 'rookie_blazer_title', 'level 3 title');

  const cosmetics50 = cosmeticsGrantedAtLevel(50);
  assert(cosmetics50.length >= 2, 'level 50 grants two cosmetics');
}

runProgressionSelfTests();
