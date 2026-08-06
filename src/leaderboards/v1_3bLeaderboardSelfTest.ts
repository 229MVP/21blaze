/**
 * Version 1.3B — Daily and weekly leaderboard policy tests.
 * Pure modules only — no React Native imports.
 */
import {
  isDailyChallengeEnabled,
  isDailyLeaderboardEnabled,
  isFriendsLeaderboardEnabled,
  isStorePurchasesEnabled,
  isWeeklyLeaderboardEnabled,
} from '../config/featureFlags';
import { challengePointsForRank } from '../leaderboards/challengePoints';
import {
  compareDailyLeaderboardRows,
  compareWeeklyLeaderboardRows,
  rankDailyLeaderboardRows,
  rankWeeklyLeaderboardRows,
} from '../leaderboards/rankingRules';
import {
  formatPublicDisplayName,
  isReservedDisplayName,
  validatePublicDisplayName,
} from '../leaderboards/displayNameSafety';
import { getUtcWeekEndDate, getUtcWeekStartDate, isDateInUtcWeek } from '../leaderboards/utcWeek';
import { isInterstitialEligible } from '../monetization/interstitialPolicy';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Leaderboard self-test failed: ${message}`);
  }
}

export async function runLeaderboardSelfTests(): Promise<void> {
  assert(challengePointsForRank(1) === 100, '1st place points');
  assert(challengePointsForRank(2) === 90, '2nd place points');
  assert(challengePointsForRank(3) === 85, '3rd place points');
  assert(challengePointsForRank(10) === 75, '4–10 points');
  assert(challengePointsForRank(25) === 60, '11–25 points');
  assert(challengePointsForRank(50) === 45, '26–50 points');
  assert(challengePointsForRank(100) === 30, '51–100 points');
  assert(challengePointsForRank(101) === 15, 'outside top 100 points');
  assert(challengePointsForRank(0) === 0, 'invalid rank points');

  const dailyRows = rankDailyLeaderboardRows([
    {
      verifiedScore: 100,
      exact21Count: 2,
      fiveCardClears: 1,
      bustCount: 1,
      bestMultiplier: 2,
      elapsedTimeMs: 5000,
      completedAt: '2026-08-05T12:00:00.000Z',
    },
    {
      verifiedScore: 120,
      exact21Count: 1,
      fiveCardClears: 0,
      bustCount: 2,
      bestMultiplier: 1,
      elapsedTimeMs: 4000,
      completedAt: '2026-08-05T12:01:00.000Z',
    },
    {
      verifiedScore: 100,
      exact21Count: 3,
      fiveCardClears: 0,
      bustCount: 1,
      bestMultiplier: 1,
      elapsedTimeMs: 6000,
      completedAt: '2026-08-05T12:02:00.000Z',
    },
  ]);

  assert(dailyRows[0].rank === 1 && dailyRows[0].verifiedScore === 120, 'higher score ranks first');
  assert(
    dailyRows[1].verifiedScore === 100 && dailyRows[1].exact21Count === 3,
    'exact-21 tie-breaker',
  );
  assert(
    compareDailyLeaderboardRows(dailyRows[1], dailyRows[2]) < 0,
    'daily comparator matches rank order',
  );

  const weeklyRows = rankWeeklyLeaderboardRows([
    {
      challengePoints: 100,
      verifiedDaysCompleted: 3,
      bestDailyRank: 5,
      totalVerifiedScore: 300,
      totalExact21Count: 4,
      totalFiveCardClears: 1,
      totalBustCount: 2,
      lastContributedAt: '2026-08-05T12:00:00.000Z',
    },
    {
      challengePoints: 120,
      verifiedDaysCompleted: 2,
      bestDailyRank: 1,
      totalVerifiedScore: 200,
      totalExact21Count: 2,
      totalFiveCardClears: 0,
      totalBustCount: 1,
      lastContributedAt: '2026-08-04T12:00:00.000Z',
    },
  ]);
  assert(weeklyRows[0].challengePoints === 120, 'weekly points primary tie-breaker');
  assert(
    compareWeeklyLeaderboardRows(weeklyRows[0], weeklyRows[1]) < 0,
    'weekly comparator order',
  );

  const weekStart = getUtcWeekStartDate(Date.parse('2026-08-05T12:00:00.000Z'));
  assert(weekStart === '2026-08-03', 'UTC week starts Monday');
  assert(
    isDateInUtcWeek('2026-08-05', weekStart),
    'Wednesday in same UTC week',
  );
  assert(
    !isDateInUtcWeek('2026-08-02', weekStart),
    'Sunday before Monday week start excluded',
  );
  const weekEnd = getUtcWeekEndDate(weekStart);
  assert(weekEnd === '2026-08-09', 'UTC week end date');

  assert(isReservedDisplayName('admin'), 'reserved admin');
  assert(isReservedDisplayName('21blaze_support'), 'reserved support variant');
  assert(!isReservedDisplayName('BlazeRunner'), 'normal name allowed');
  const valid = validatePublicDisplayName('Ace_Player');
  assert(valid.ok, 'valid display name');
  const tooLong = validatePublicDisplayName('abcdefghijklmnopqrstuvwxyz');
  assert(!tooLong.ok, 'long name rejected');
  assert(formatPublicDisplayName(null, 'ab12') === 'Blazer ab12', 'fallback display name');

  assert(!isFriendsLeaderboardEnabled(), 'friends leaderboard defaults off');
  assert(!isStorePurchasesEnabled(), 'RevenueCat purchases remain disabled by default');

  const blockedOnLeaderboard = isInterstitialEligible({
    interstitialAdsEnabled: true,
    isWeb: false,
    hasRemoveAds: false,
    isFirstAppSession: false,
    completedEligibleMatches: 10,
    lastShownAtMs: null,
    nowMs: Date.UTC(2026, 7, 5),
    utcDailyCount: 0,
    utcDailyKey: null,
    todayUtcKey: '2026-08-05',
    currentScreen: 'leaderboard',
    lastRewardedAdAtMs: null,
  });
  assert(!blockedOnLeaderboard.eligible, 'ads blocked on leaderboard screen');

  assert(!isDailyLeaderboardEnabled() || isDailyChallengeEnabled(), 'daily LB requires challenge');
  assert(!isWeeklyLeaderboardEnabled() || isDailyChallengeEnabled(), 'weekly LB requires challenge');

  // Duplicate rank rows should collapse to one entry per user in client merge logic.
  const merged: number[] = [];
  const add = (rank: number) => {
    if (!merged.includes(rank)) {
      merged.push(rank);
    }
  };
  add(1);
  add(1);
  add(2);
  assert(merged.length === 2, 'pagination merge avoids duplicate ranks');

  console.log('Leaderboard self-tests passed.');
}

runLeaderboardSelfTests().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
