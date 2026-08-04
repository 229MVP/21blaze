import { calculateCasualLiveDuelCoins, calculateRankedCoins, calculateSoloMatchCoins } from './coinRewards';
import {
  ENTITLEMENT_KEYS,
  RC_OFFERING_ID,
  RC_PACKAGE_IDS,
  RC_PRODUCTS,
  catalogIdToStoreProductIdForPlatform,
  isEntitlementKey,
  packageIdentifierToCatalogId,
} from './productIds.pure';
import { hasEntitlement, mapCustomerEntitlements } from './purchaseService.pure';
import { hasBlazeProFromActiveIds } from './proConfig';
import { COSMETIC_CATALOG } from '../cosmetics/catalog';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Monetization self-test failed: ${message}`);
  }
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

  assert(RC_OFFERING_ID === 'default', 'offering id');
  assert(RC_PRODUCTS.adFree === 'blaze_ad_free', 'ad free product id');
  assert(RC_PRODUCTS.infernoPack === 'blaze_inferno_pack', 'inferno product id');
  assert(RC_PRODUCTS.neonPack === 'blaze_neon_pack', 'neon product id');
  assert(RC_PRODUCTS.foundersPack === 'blaze_founders_pack', 'founders product id');
  assert(RC_PACKAGE_IDS.adFree === 'ad_free', 'ad_free package');
  assert(RC_PACKAGE_IDS.inferno === 'inferno', 'inferno package');
  assert(RC_PACKAGE_IDS.neon === 'neon', 'neon package');
  assert(RC_PACKAGE_IDS.founders === 'founders', 'founders package');
  assert(packageIdentifierToCatalogId('founders') === 'blaze_founders_pack', 'package map');

  assert(
    hasEntitlement(
      {
        active: ['ad_free', 'remove_ads'],
        removeAds: true,
        hasPro: false,
        rawActiveIds: ['ad_free'],
      },
      'ad_free',
    ),
    'ad_free entitlement',
  );
  assert(
    hasEntitlement(
      {
        active: ['founders_pack', 'ad_free', 'remove_ads'],
        removeAds: true,
        hasPro: false,
        rawActiveIds: ['founders_pack'],
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

  const foundersMapped = mapCustomerEntitlements(['founders_pack']);
  assert(foundersMapped.removeAds === true, 'founders_pack maps to ad-free');
  assert(foundersMapped.active.includes('inferno_pack'), 'founders expands inferno');
  assert(foundersMapped.active.includes('neon_pack'), 'founders expands neon');
  assert(foundersMapped.active.includes('ad_free'), 'founders expands ad_free');
  assert(
    mapCustomerEntitlements(['inferno_pack']).active.includes('cards_inferno'),
    'inferno_pack expands to cards_inferno',
  );
  assert(
    mapCustomerEntitlements(['neon_pack']).active.includes('arena_neon_casino'),
    'neon_pack expands to neon arena',
  );

  assert(isEntitlementKey('inferno_pack'), 'inferno_pack entitlement key');
  assert(isEntitlementKey('cards_inferno'), 'legacy inferno entitlement key');
  assert(!isEntitlementKey('not_real'), 'rejects unknown entitlement');
  assert(ENTITLEMENT_KEYS.foundersPack === 'founders_pack', 'founders key');
  assert(
    catalogIdToStoreProductIdForPlatform('blaze_ad_free', 'ios') === 'blaze_ad_free',
    'ios ad free product id mapping',
  );
  assert(
    catalogIdToStoreProductIdForPlatform('remove_ads', 'ios') === 'blaze_ad_free',
    'legacy remove_ads maps to blaze_ad_free',
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

  // Interstitial eligibility itself moved to the dedicated, SDK-independent
  // `src/monetization/interstitialPolicy.ts` (`isInterstitialEligible`),
  // exercised by `v1_1cAdsSelfTest.ts` — see that file for the current
  // approved policy (Solo-only, 3 matches, 10-minute cooldown, 3/UTC-day
  // cap, first-session block, "never during" screen list, and the
  // post-rewarded-ad buffer). This file no longer duplicates that policy.

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
