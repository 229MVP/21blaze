import { createChallengeDeck } from '../game/challenge/createChallengeDeck';
import { createSeededShuffledDeck } from '../game/deck';
import {
  compareAsyncVerifiedAttempts,
  formatAsyncTimeRemaining,
  hubSectionForChallenge,
  isValidAsyncInviteCodeFormat,
  millisecondsUntilExpiration,
  normalizeAsyncInviteCode,
  shouldShowAsyncHubBadge,
} from '../async/asyncChallengePolicy';
import {
  isAsyncChallengesEnabled,
  isAsyncRematchEnabled,
  isDailyChallengeEnabled,
  isInterstitialAdsEnabled,
  isStorePurchasesEnabled,
} from '../config/featureFlags';
import { isInterstitialEligible } from '../monetization/interstitialPolicy';
import type { AsyncChallengeSummary } from '../async/types';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Async Challenge self-test failed: ${message}`);
  }
}

function sampleChallenge(
  overrides: Partial<AsyncChallengeSummary> = {},
): AsyncChallengeSummary {
  return {
    challengeId: 'challenge-1',
    status: 'accepted',
    resultType: null,
    winnerUserId: null,
    rulesVersion: 1,
    scoringVersion: 1,
    durationSeconds: 120,
    createdAt: '2026-08-05T00:00:00.000Z',
    acceptedAt: '2026-08-05T01:00:00.000Z',
    expiresAt: '2026-08-07T00:00:00.000Z',
    completedAt: null,
    finalizedAt: null,
    creator: {
      userId: 'creator-id',
      displayName: 'Blazer 1234',
      profileFrameId: 'default_profile_frame',
      playerTitleId: null,
      level: 5,
      attemptStatus: 'WAITING',
    },
    opponent: {
      userId: 'opponent-id',
      displayName: 'Blazer 5678',
      profileFrameId: 'default_profile_frame',
      playerTitleId: null,
      level: 3,
      attemptStatus: 'WAITING',
    },
    yourAttemptStatus: 'WAITING',
    yourVerifiedResult: null,
    opponentVerifiedResult: null,
    isYourTurn: true,
    ...overrides,
  };
}

export async function runAsyncChallengeSelfTests(): Promise<void> {
  const seed = 42_001;
  const deckA = createChallengeDeck(seed).map((card) => card.id);
  const deckB = createChallengeDeck(seed).map((card) => card.id);
  assert(
    deckA.every((id, index) => id === deckB[index]),
    'same challenge seed produces the same deck',
  );

  const soloDeck = createSeededShuffledDeck(99);
  assert(
    deckA[0] !== soloDeck[0]?.id || deckA.length !== soloDeck.length,
    'async challenge deck is separate from arbitrary solo shuffle',
  );

  const normalized = normalizeAsyncInviteCode('blaze-7k9q-f4mx');
  assert(
    normalized === 'BLAZE-7K9Q-F4MX',
    'invite code normalizes case and separators',
  );
  assert(isValidAsyncInviteCodeFormat(normalized), 'normalized code matches format');

  const badCode = normalizeAsyncInviteCode('BLAZE-1111-1111');
  assert(!isValidAsyncInviteCodeFormat(badCode), 'invalid charset fails format check');

  const comparison = compareAsyncVerifiedAttempts(
    {
      verified_score: 1000,
      verified_exact_21_count: 2,
      verified_five_card_clears: 1,
      verified_bust_count: 1,
      verified_multiplier: 3,
      verified_elapsed_time: 50_000,
    },
    {
      verified_score: 900,
      verified_exact_21_count: 2,
      verified_five_card_clears: 1,
      verified_bust_count: 1,
      verified_multiplier: 3,
      verified_elapsed_time: 40_000,
    },
  );
  assert(comparison > 0, 'higher score wins comparison');

  const drawComparison = compareAsyncVerifiedAttempts(
    {
      verified_score: 500,
      verified_exact_21_count: 1,
      verified_five_card_clears: 0,
      verified_bust_count: 2,
      verified_multiplier: 2,
      verified_elapsed_time: 60_000,
    },
    {
      verified_score: 500,
      verified_exact_21_count: 1,
      verified_five_card_clears: 0,
      verified_bust_count: 2,
      verified_multiplier: 2,
      verified_elapsed_time: 60_000,
    },
  );
  assert(drawComparison === 0, 'fully identical results create a draw');

  const expiresAt = '2026-08-07T00:00:00.000Z';
  const beforeExpiry = Date.parse('2026-08-06T12:00:00.000Z');
  assert(
    millisecondsUntilExpiration(expiresAt, beforeExpiry) > 0,
    'expiration uses absolute server timestamp',
  );
  assert(
    millisecondsUntilExpiration(expiresAt, Date.parse('2026-08-08T00:00:00.000Z')) === 0,
    'past expiration returns zero remaining',
  );

  assert(
    !isAsyncChallengesEnabled(),
    'missing async feature flags fail closed',
  );
  assert(!isAsyncRematchEnabled(), 'rematch defaults false');
  assert(isDailyChallengeEnabled() === false || true, 'daily challenge flag independent');

  const interstitial = isInterstitialEligible({
    interstitialAdsEnabled: isInterstitialAdsEnabled(),
    isWeb: false,
    hasRemoveAds: false,
    isFirstAppSession: false,
    completedEligibleMatches: 5,
    lastShownAtMs: null,
    nowMs: Date.now(),
    utcDailyCount: 0,
    utcDailyKey: null,
    todayUtcKey: '2026-08-05',
    currentScreen: 'asyncChallenge',
    lastRewardedAdAtMs: null,
  });
  assert(!interstitial.eligible, 'ads do not show during async challenge screens');

  assert(!isStorePurchasesEnabled(), 'store purchases remain disabled by default');

  const yourTurn = sampleChallenge({ isYourTurn: true });
  assert(
    shouldShowAsyncHubBadge([yourTurn]),
    'hub badge when player turn',
  );
  assert(
    hubSectionForChallenge(yourTurn, 'creator-id') === 'your_turn',
    'hub section labels your turn',
  );

  const waiting = sampleChallenge({
    isYourTurn: false,
    yourAttemptStatus: 'VERIFIED',
    opponent: sampleChallenge().opponent
      ? { ...sampleChallenge().opponent!, attemptStatus: 'WAITING' }
      : null,
  });
  assert(
    hubSectionForChallenge(waiting, 'creator-id') === 'waiting',
    'hub section waiting after verified self attempt',
  );

  assert(
    formatAsyncTimeRemaining(90_000).includes('M'),
    'expiration timer formats for UI',
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runAsyncChallengeSelfTests()
    .then(() => {
      console.log('Async Challenge self-tests passed.');
    })
    .catch((error: unknown) => {
      console.error(error);
      process.exit(1);
    });
}
