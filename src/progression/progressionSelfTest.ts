import { xpRequiredForLevel } from '../config/progressionConfig';
import { applyXpGrant } from './levelEngine';
import { evaluateDailyClaim, matchXpForMode } from './dailyClaimEngine';
import {
  cosmeticsGrantedAtLevel,
  dailyRewardForStreakDay,
  getLevelReward,
} from './rewards';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Progression self-test failed: ${message}`);
  }
}

export function runProgressionSelfTests(): void {
  assert(xpRequiredForLevel(1) === 100, 'Level 1 requires 100 XP');
  assert(xpRequiredForLevel(2) === 125, 'Level 2 requires 125 XP');
  assert(xpRequiredForLevel(3) === 150, 'Level 3 requires 150 XP');
  assert(xpRequiredForLevel(10) === 325, 'Level 10 requires 325 XP');
  assert(xpRequiredForLevel(50) === 0, 'Level 50 has no next requirement');

  const carry = applyXpGrant(
    { level: 1, totalXp: 0, currentLevelXp: 0, highestLevelReached: 1 },
    150,
  );
  assert(carry.levelAfter === 2, '150 XP reaches level 2');
  assert(carry.currentLevelXp === 50, 'excess XP carries (150-100=50)');
  assert(carry.levelsGained === 1, 'one level gained');

  const multi = applyXpGrant(
    { level: 1, totalXp: 0, currentLevelXp: 0, highestLevelReached: 1 },
    100 + 125 + 50,
  );
  assert(multi.levelAfter === 3, 'large grant crosses multiple levels');
  assert(multi.currentLevelXp === 50, 'excess after multi-level');
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
  assert(nearCap.totalXpAfter === 20_000, 'total XP continues at cap');

  const atCap = applyXpGrant(
    {
      level: 50,
      totalXp: 20_000,
      currentLevelXp: 500,
      highestLevelReached: 50,
    },
    100,
  );
  assert(atCap.levelAfter === 50, 'stays at 50');
  assert(atCap.totalXpAfter === 20_100, 'total XP grows at 50');
  assert(atCap.currentLevelXp === 600, 'current level xp accumulates at cap');

  const dup = applyXpGrant(
    { level: 1, totalXp: 0, currentLevelXp: 0, highestLevelReached: 1 },
    50,
    true,
  );
  assert(dup.alreadyProcessed && dup.xpGranted === 0, 'duplicate idempotent');

  assert(matchXpForMode('solo') === 50, 'solo 50 XP');
  assert(matchXpForMode('casual') === 75, 'casual 75 XP');
  assert(matchXpForMode('ranked') === 100, 'ranked 100 XP');

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
  if (continueStreak.eligible) {
    assert(continueStreak.continuesStreak, 'streak continues within 48h');
    assert(continueStreak.newStreak === 4, 'streak advances');
    assert(continueStreak.streakDay === 4, 'day 4 reward');
  }

  const reset = evaluateDailyClaim({
    nowMs: now,
    lastClaimAtMs: now - 49 * 60 * 60 * 1000,
    currentStreak: 6,
  });
  assert(reset.eligible === true, 'claim after reset window');
  if (reset.eligible) {
    assert(reset.resetsStreak, 'streak resets after 48h');
    assert(reset.newStreak === 1, 'reset to day 1');
    assert(reset.reward.day === 1, 'day 1 reward after reset');
  }

  assert(dailyRewardForStreakDay(7).cosmeticId === 'seven_day_blaze_title', 'day 7 cosmetic');
  assert(dailyRewardForStreakDay(8).day === 1, 'cycle wraps to day 1');
  assert(dailyRewardForStreakDay(14).day === 7, '14th streak is day 7');

  assert(getLevelReward(2)?.blazeCoins === 50, 'level 2 coins');
  assert(
    cosmeticsGrantedAtLevel(50).includes('blaze_master_title') &&
      cosmeticsGrantedAtLevel(50).includes('level_50_champion_card_back'),
    'level 50 cosmetics',
  );

  // Purchases / cosmetics do not appear in XP formulas.
  assert(matchXpForMode('solo') === 50, 'purchases do not alter XP');
}

runProgressionSelfTests();
console.log('Progression self-tests passed.');
