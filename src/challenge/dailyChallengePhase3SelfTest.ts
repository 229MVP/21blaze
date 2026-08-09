import {
  DAILY_STREAK_MILESTONES,
  DAILY_STREAK_REWARD_REGISTRY,
  getNextStreakMilestone,
  getStreakRewardForMilestone,
} from './dailyStreakRewardRegistry';
import {
  utcWeekEndForDate,
  utcWeekStartForDate,
} from './utcResetCountdown';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Daily Challenge Phase 3 self-test failed: ${message}`);
  }
}

export function runDailyChallengePhase3SelfTests(): void {
  assert(DAILY_STREAK_MILESTONES.length === 6, 'six streak milestones defined');
  assert(
    getStreakRewardForMilestone(7)?.blazeCoins === 100,
    '7-day milestone awards 100 Blaze Coins in registry',
  );
  assert(
    getStreakRewardForMilestone(14)?.cosmeticEntitlement != null,
    '14-day milestone includes future cosmetic hook',
  );
  assert(
    getNextStreakMilestone(4)?.milestone === 5,
    'next milestone after 4 is 5 days',
  );

  assert(
    utcWeekStartForDate('2026-08-09') === '2026-08-03',
    'Sunday Aug 9 belongs to week starting Monday Aug 3',
  );
  assert(
    utcWeekEndForDate('2026-08-09') === '2026-08-09',
    'week end is Sunday of the same UTC week',
  );
  assert(
    utcWeekStartForDate('2026-08-04') === '2026-08-03',
    'Tuesday belongs to week starting prior Monday',
  );

  const registrySum = DAILY_STREAK_REWARD_REGISTRY.reduce(
    (sum, row) => sum + (row.blazeCoins ?? 0),
    0,
  );
  assert(registrySum > 0, 'reward registry defines Blaze Coin amounts centrally');

  assert(
    !DAILY_STREAK_REWARD_REGISTRY.some((r) => r.futureSabotageUnlock != null),
    'sabotage rewards are not exposed in Phase 3 registry',
  );
}

runDailyChallengePhase3SelfTests();
console.log('Daily Challenge Phase 3 self-tests passed.');
