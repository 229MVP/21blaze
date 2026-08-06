/** Version 1.3C — challenge reward policy tests (pure, no RN). */
import {
  CHALLENGE_PARTICIPATION_COINS,
  CHALLENGE_PARTICIPATION_XP,
  dailyPlacementCoinsForRank,
  dailyPlacementTierForRank,
  weeklyTierForChallengePoints,
  nextWeeklyTier,
  STREAK_MILESTONES,
} from '../challenge/challengeRewardPolicy';
import {
  isChallengeRewardsEnabled,
  isStorePurchasesEnabled,
} from '../config/featureFlags';
import { isInterstitialEligible } from '../monetization/interstitialPolicy';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Challenge reward self-test failed: ${message}`);
  }
}

export async function runChallengeRewardSelfTests(): Promise<void> {
  assert(CHALLENGE_PARTICIPATION_COINS === 20, 'participation coins');
  assert(CHALLENGE_PARTICIPATION_XP === 75, 'participation xp');
  assert(dailyPlacementCoinsForRank(1) === 200, 'first place');
  assert(dailyPlacementCoinsForRank(3) === 125, 'top 3');
  assert(dailyPlacementCoinsForRank(10) === 75, 'top 10');
  assert(dailyPlacementCoinsForRank(25) === 50, 'top 25');
  assert(dailyPlacementCoinsForRank(100) === 25, 'top 100');
  assert(dailyPlacementCoinsForRank(101) === 0, 'outside top 100');
  assert(dailyPlacementTierForRank(1) === 'first', 'tier first');
  assert(dailyPlacementTierForRank(101) === null, 'no tier outside 100');

  const bronze = weeklyTierForChallengePoints(80);
  assert(bronze?.id === 'bronze_blazer', 'bronze tier');
  const inferno = weeklyTierForChallengePoints(650);
  assert(inferno?.id === 'inferno_blazer', 'inferno tier highest');
  const next = nextWeeklyTier(100);
  assert(next?.id === 'silver_blazer', 'next tier from 100 pts');

  assert(STREAK_MILESTONES.length === 4, 'streak milestones defined');
  assert(STREAK_MILESTONES[0].days === 3, '3-day milestone');

  assert(!isStorePurchasesEnabled(), 'RevenueCat purchases disabled');
  assert(!isChallengeRewardsEnabled(), 'challenge rewards flag default off');

  const blockedResults = isInterstitialEligible({
    interstitialAdsEnabled: true,
    isWeb: false,
    hasRemoveAds: false,
    isFirstAppSession: false,
    completedEligibleMatches: 10,
    lastShownAtMs: null,
    nowMs: Date.UTC(2026, 7, 6),
    utcDailyCount: 0,
    utcDailyKey: null,
    todayUtcKey: '2026-08-06',
    currentScreen: 'results',
    lastRewardedAdAtMs: null,
  });
  assert(!blockedResults.eligible, 'no interstitial on results');

  console.log('Challenge reward self-tests passed.');
}

runChallengeRewardSelfTests().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
