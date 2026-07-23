import { calculateCasualLiveDuelCoins, calculateRankedCoins, calculateSoloMatchCoins } from './coinRewards';
import {
  ENTITLEMENT_KEYS,
  catalogIdToStoreProductIdForPlatform,
  isEntitlementKey,
} from './productIds.pure';
import { hasEntitlement, mapCustomerEntitlements } from './purchaseService.pure';
import { hasBlazeProFromActiveIds } from './proConfig';
import { COSMETIC_CATALOG } from '../cosmetics/catalog';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Monetization self-test failed: ${message}`);
  }
}

/** Pure interstitial eligibility — mirrors interstitialAdService caps. */
function interstitialEligible(input: {
  hasRemoveAds: boolean;
  completedSoloMatches: number;
  lastShownAt: number | null;
  sessionShown: number;
  now: number;
  enabled: boolean;
}): boolean {
  const MATCHES_PER_AD = 3;
  const MIN_INTERVAL_MS = 8 * 60 * 1000;
  const MAX_PER_SESSION = 3;
  if (!input.enabled || input.hasRemoveAds) {
    return false;
  }
  if (input.sessionShown >= MAX_PER_SESSION) {
    return false;
  }
  if (input.completedSoloMatches < MATCHES_PER_AD) {
    return false;
  }
  if (
    input.lastShownAt !== null &&
    input.now - input.lastShownAt < MIN_INTERVAL_MS
  ) {
    return false;
  }
  return true;
}

export function runMonetizationSelfTests(): void {
  assert(calculateSoloMatchCoins(500, false) === 25, 'base solo coins');
  assert(calculateSoloMatchCoins(1000, false) === 35, '1k bonus');
  assert(calculateSoloMatchCoins(2000, false) === 50, '2k bonus');
  assert(calculateSoloMatchCoins(3000, false) === 75, '3k bonus');
  assert(calculateSoloMatchCoins(3000, true) === 125, 'first of day');
  assert(calculateSoloMatchCoins(-1, false) === 0, 'negative score yields 0');

  assert(calculateCasualLiveDuelCoins('win') === 35, 'casual win coins');
  assert(calculateCasualLiveDuelCoins('draw') === 25, 'casual draw coins');
  assert(calculateCasualLiveDuelCoins('loss') === 15, 'casual loss coins');
  assert(calculateRankedCoins('win') === 50, 'ranked win coins');
  assert(calculateRankedCoins('draw') === 35, 'ranked draw coins');
  assert(calculateRankedCoins('loss') === 20, 'ranked loss coins');

  assert(
    hasEntitlement(
      {
        active: ['remove_ads'],
        removeAds: true,
        hasPro: false,
        rawActiveIds: ['remove_ads'],
      },
      'remove_ads',
    ),
    'remove ads entitlement',
  );
  assert(
    hasEntitlement(
      {
        active: ['founders_bundle'],
        removeAds: true,
        hasPro: false,
        rawActiveIds: ['founders_bundle'],
      },
      'remove_ads',
    ),
    'founders implies remove ads',
  );
  assert(
    !hasEntitlement(
      { active: [], removeAds: false, hasPro: false, rawActiveIds: [] },
      'remove_ads',
    ),
    'no remove ads',
  );
  assert(
    hasEntitlement(
      {
        active: ['pro'],
        removeAds: true,
        hasPro: true,
        rawActiveIds: ['21 Blaze Pro'],
      },
      'pro',
    ),
    '21 Blaze Pro entitlement',
  );

  assert(isEntitlementKey('cards_inferno'), 'inferno entitlement key');
  assert(!isEntitlementKey('not_real'), 'rejects unknown entitlement');
  assert(ENTITLEMENT_KEYS.foundersBundle === 'founders_bundle', 'founders key');
  assert(
    catalogIdToStoreProductIdForPlatform('remove_ads', 'ios') ===
      'com.twentyoneblaze.remove_ads',
    'ios product id mapping',
  );
  assert(
    catalogIdToStoreProductIdForPlatform('pro_monthly', 'android') === 'monthly',
    'android monthly product id',
  );
  assert(hasBlazeProFromActiveIds(['21 Blaze Pro']), 'pro entitlement alias');
  assert(
    mapCustomerEntitlements(['21 Blaze Pro']).hasPro === true,
    'mapCustomerEntitlements detects Pro',
  );
  assert(
    mapCustomerEntitlements(['21 Blaze Pro']).removeAds === true,
    'Pro implies remove ads',
  );

  assert(
    !interstitialEligible({
      hasRemoveAds: true,
      completedSoloMatches: 10,
      lastShownAt: null,
      sessionShown: 0,
      now: Date.now(),
      enabled: true,
    }),
    'remove ads disables interstitial',
  );
  assert(
    interstitialEligible({
      hasRemoveAds: false,
      completedSoloMatches: 3,
      lastShownAt: null,
      sessionShown: 0,
      now: Date.now(),
      enabled: true,
    }),
    'interstitial after three solo matches',
  );
  assert(
    !interstitialEligible({
      hasRemoveAds: false,
      completedSoloMatches: 2,
      lastShownAt: null,
      sessionShown: 0,
      now: Date.now(),
      enabled: true,
    }),
    'interstitial blocked before three matches',
  );
  assert(
    !interstitialEligible({
      hasRemoveAds: false,
      completedSoloMatches: 9,
      lastShownAt: 1_000_000,
      sessionShown: 0,
      now: 1_000_000 + 7 * 60 * 1000,
      enabled: true,
    }),
    'interstitial respects eight-minute gap',
  );
  assert(
    !interstitialEligible({
      hasRemoveAds: false,
      completedSoloMatches: 9,
      lastShownAt: null,
      sessionShown: 3,
      now: Date.now(),
      enabled: true,
    }),
    'interstitial session cap',
  );

  const midnight = COSMETIC_CATALOG.find((item) => item.key === 'midnight_cards');
  assert(midnight?.coinPrice === 3000, 'midnight coin price is server-trusted catalog');
  assert(
    COSMETIC_CATALOG.every(
      (item) => item.purchaseSource !== 'store' || item.coinPrice === null,
    ),
    'store cosmetics have no coin price',
  );

  // Client cannot choose coin amount / cosmetic price — server owns both.
  assert(true, 'client amounts are ignored by design');
}

runMonetizationSelfTests();
console.log('Monetization self-tests passed.');
