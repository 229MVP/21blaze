import { createShuffledDeck, createSeededShuffledDeck } from '../game/deck';
import { createChallengeDeck } from '../game/challenge/createChallengeDeck';
import {
  createDailyChallengeConfig,
  deriveDailyChallengeSeed,
  getUtcChallengeDate,
  isChallengeDateActive,
} from '../game/challenge/createDailyChallenge';
import {
  isDailyChallengeEnabled,
  isDailyChallengePracticeEnabled,
  isDailyChallengeRankedEnabled,
  isDailyLeaderboardEnabled,
  isStorePurchasesEnabled,
} from '../config/featureFlags';
import { isInterstitialEligible } from '../monetization/interstitialPolicy';
import {
  deriveDailyChallengeUiStatus,
  isCachedDailyChallengeValid,
} from './dailyChallengePolicy';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Daily Challenge self-test failed: ${message}`);
  }
}

export async function runDailyChallengeSelfTests(): Promise<void> {
  const dateA = '2026-08-05';
  const dateB = '2026-08-06';
  const seedA = deriveDailyChallengeSeed(dateA);
  const seedB = deriveDailyChallengeSeed(dateB);

  const deckA1 = createChallengeDeck(seedA).map((card) => card.id);
  const deckA2 = createChallengeDeck(seedA).map((card) => card.id);
  const deckB = createChallengeDeck(seedB).map((card) => card.id);

  assert(
    deckA1.every((id, index) => id === deckA2[index]),
    'same seed produces the same deck',
  );
  assert(
    deckB.some((id, index) => id !== deckA1[index]),
    'different seeds produce different deterministic decks',
  );

  const soloDeck = createShuffledDeck(() => 0.42);
  const soloDeck2 = createShuffledDeck(() => 0.42);
  assert(
    soloDeck.every((card, index) => card.id === soloDeck2[index]?.id),
    'regular Solo shuffle still honors injected RNG',
  );
  assert(
    deckA1[0] !== soloDeck[0]?.id || deckA1.length !== soloDeck.length,
    'challenge deck helper uses deterministic seeded path separate from Solo RNG injection',
  );

  const config = createDailyChallengeConfig(dateA);
  assert(config.seed === seedA, 'challenge config uses derived seed');
  assert(config.scoringVersion === 1, 'challenge config exposes scoring version');

  assert(
    getUtcChallengeDate(Date.parse('2026-08-05T23:59:00.000Z')) === dateA,
    'UTC challenge date ignores local presentation',
  );
  assert(
    isChallengeDateActive(dateA, Date.parse('2026-08-05T12:00:00.000Z')),
    'active challenge date matches UTC day',
  );
  assert(
    !isChallengeDateActive(dateA, Date.parse('2026-08-06T00:00:01.000Z')),
    'next UTC day is not the previous challenge',
  );

  assert(
    deriveDailyChallengeUiStatus({
      challenge: config,
      rankedAttempt: null,
      activeSession: null,
      offline: false,
      errorMessage: null,
    }) === 'available',
    'fresh challenge shows ranked availability',
  );
  assert(
    deriveDailyChallengeUiStatus({
      challenge: config,
      rankedAttempt: { status: 'completed' } as never,
      activeSession: null,
      offline: false,
      errorMessage: null,
    }) === 'completed',
    'completed ranked attempt maps to completed UI state',
  );
  assert(
    deriveDailyChallengeUiStatus({
      challenge: null,
      rankedAttempt: null,
      activeSession: null,
      offline: true,
      errorMessage: 'offline',
    }) === 'offline',
    'offline without challenge falls back safely',
  );

  assert(
    isCachedDailyChallengeValid(
      {
        challenge: config,
        cachedAtMs: Date.parse('2026-08-05T12:00:00.000Z'),
      },
      Date.parse('2026-08-05T20:00:00.000Z'),
    ),
    'valid cached challenge data accepted for the same UTC day',
  );
  assert(
    !isCachedDailyChallengeValid(
      {
        challenge: config,
        cachedAtMs: Date.parse('2026-08-05T12:00:00.000Z'),
      },
      Date.parse('2026-08-06T01:00:00.000Z'),
    ),
    'invalid cached challenge data rejected on the next UTC day',
  );

  const previousDailyChallenge = process.env.EXPO_PUBLIC_ENABLE_DAILY_CHALLENGE;
  const previousRanked = process.env.EXPO_PUBLIC_ENABLE_DAILY_CHALLENGE_RANKED;
  const previousPractice = process.env.EXPO_PUBLIC_ENABLE_DAILY_CHALLENGE_PRACTICE;
  const previousLeaderboard = process.env.EXPO_PUBLIC_ENABLE_DAILY_LEADERBOARD;
  const previousPurchases = process.env.EXPO_PUBLIC_ENABLE_STORE_PURCHASES;
  const previousMonetization = process.env.EXPO_PUBLIC_ENABLE_MONETIZATION_BETA;

  delete process.env.EXPO_PUBLIC_ENABLE_DAILY_CHALLENGE;
  delete process.env.EXPO_PUBLIC_ENABLE_DAILY_CHALLENGE_RANKED;
  delete process.env.EXPO_PUBLIC_ENABLE_DAILY_CHALLENGE_PRACTICE;
  delete process.env.EXPO_PUBLIC_ENABLE_DAILY_LEADERBOARD;
  process.env.EXPO_PUBLIC_ENABLE_STORE_PURCHASES = 'false';
  process.env.EXPO_PUBLIC_ENABLE_MONETIZATION_BETA = 'false';

  assert(!isDailyChallengeEnabled(), 'missing master flag disables Daily Challenge safely');
  assert(!isDailyChallengeRankedEnabled(), 'missing ranked flag disables ranked safely');
  assert(!isDailyChallengePracticeEnabled(), 'missing practice flag disables practice safely');
  assert(!isDailyLeaderboardEnabled(), 'missing leaderboard flag disables leaderboard safely');
  assert(!isStorePurchasesEnabled(), 'RevenueCat purchases remain disabled');

  process.env.EXPO_PUBLIC_ENABLE_DAILY_CHALLENGE = 'true';
  process.env.EXPO_PUBLIC_ENABLE_DAILY_CHALLENGE_RANKED = 'true';
  assert(
    isDailyChallengeEnabled() && isDailyChallengeRankedEnabled(),
    'explicit flags enable ranked challenge UX only',
  );

  const blockedDuringChallenge = isInterstitialEligible({
    interstitialAdsEnabled: true,
    isWeb: false,
    hasRemoveAds: false,
    isFirstAppSession: false,
    completedEligibleMatches: 99,
    lastShownAtMs: null,
    nowMs: Date.now(),
    utcDailyCount: 0,
    utcDailyKey: null,
    todayUtcKey: getUtcChallengeDate(Date.now()),
    currentScreen: 'dailyChallenge',
    lastRewardedAdAtMs: null,
  });
  assert(!blockedDuringChallenge.eligible, 'ads do not show during daily challenge screens');
  assert(!isStorePurchasesEnabled(), 'RevenueCat purchases remain disabled in default env');

  if (previousDailyChallenge === undefined) {
    delete process.env.EXPO_PUBLIC_ENABLE_DAILY_CHALLENGE;
  } else {
    process.env.EXPO_PUBLIC_ENABLE_DAILY_CHALLENGE = previousDailyChallenge;
  }
  if (previousRanked === undefined) {
    delete process.env.EXPO_PUBLIC_ENABLE_DAILY_CHALLENGE_RANKED;
  } else {
    process.env.EXPO_PUBLIC_ENABLE_DAILY_CHALLENGE_RANKED = previousRanked;
  }
  if (previousPractice === undefined) {
    delete process.env.EXPO_PUBLIC_ENABLE_DAILY_CHALLENGE_PRACTICE;
  } else {
    process.env.EXPO_PUBLIC_ENABLE_DAILY_CHALLENGE_PRACTICE = previousPractice;
  }
  if (previousLeaderboard === undefined) {
    delete process.env.EXPO_PUBLIC_ENABLE_DAILY_LEADERBOARD;
  } else {
    process.env.EXPO_PUBLIC_ENABLE_DAILY_LEADERBOARD = previousLeaderboard;
  }
  if (previousPurchases === undefined) {
    delete process.env.EXPO_PUBLIC_ENABLE_STORE_PURCHASES;
  } else {
    process.env.EXPO_PUBLIC_ENABLE_STORE_PURCHASES = previousPurchases;
  }
  if (previousMonetization === undefined) {
    delete process.env.EXPO_PUBLIC_ENABLE_MONETIZATION_BETA;
  } else {
    process.env.EXPO_PUBLIC_ENABLE_MONETIZATION_BETA = previousMonetization;
  }

  assert(
    createSeededShuffledDeck(seedA).length === 52,
    'challenge deck length remains 52 cards',
  );
}

void runDailyChallengeSelfTests()
  .then(() => {
    console.log('Daily Challenge self-tests passed.');
  })
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
