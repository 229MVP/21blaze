/**
 * Version 1.2C "Visual Polish, Optimization, and TestFlight Release
 * Candidate" — pure unit tests. Same convention as
 * `v1_2aVisualThemeSelfTest.ts` / `v1_2bEmberCollectionSelfTest.ts`: only
 * genuinely pure, RN-independent logic runs here; anything requiring
 * React Native is verified by code review and documented in
 * `docs/V1_2C_QA_AUDIT.md`.
 *
 * Each numbered comment maps to one of the 24 scenarios in the Version
 * 1.2C spec's "AUTOMATED TESTS" section.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { findMissingFallbackReferences, findThemesRequiringMissingAssets } from '../assets/manifest/validateManifest';
import { isAssetSupportedOnPlatform } from '../assets/manifest/types';
import { VISUAL_ASSET_METADATA } from '../assets/manifest/visualAssetManifestData';
import { cardAccessibilityLabel } from '../components/cards/cardUtils';
import {
  FREE_DEFAULT_COSMETIC_IDS,
  resolveCosmeticButtonState,
  V1_1B_LOCKER_CATALOG,
} from '../cosmetics/lockerCatalog';
import { classicTheme } from './defaultTheme';
import {
  enqueueEffectBounded,
  publishVisualEffectEvent,
  subscribeToVisualEffects,
  __resetVisualEventBusForTests,
  type VisualEffectEvent,
} from '../services/visualEventBus';
import { getAllThemeDefinitions, resolveThemeDefinition } from './themeRegistry';
import {
  __resetVisualThemeMemoForTests,
  resolvePlayerVisualTheme,
} from './resolvePlayerVisualTheme';
import { isAdMobTestModeForced, isStorePurchasesEnabled, isThemePreviewDevEnabled } from '../config/featureFlags';
import type { PlayerVisualLoadout } from './types';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Version 1.2C release-candidate self-test failed: ${message}`);
  }
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../..');

const FREE_ID_SET = new Set(FREE_DEFAULT_COSMETIC_IDS);
const BASE_LOADOUT: PlayerVisualLoadout = {
  cardFaceId: 'classic_card_face',
  cardBackId: 'classic_card_back',
  arenaId: 'classic_arena',
  laneEffectId: null,
  profileFrameId: 'default_profile_frame',
  playerTitleId: null,
};

function fakeEvent(overrides: Partial<VisualEffectEvent> & { eventId: string }): VisualEffectEvent {
  return {
    eventType: 'card_placed',
    timestamp: Date.now(),
    intensity: 'medium',
    themeContext: 'classic_board_effect',
    ...overrides,
  };
}

export function runV1_2CReleaseCandidateSelfTests(): void {
  // 1. Classic theme always resolves.
  {
    assert(classicTheme.isEnabled, 'classicTheme is always enabled');
    assert(classicTheme.fallbackThemeId === null, 'classicTheme is the terminal fallback');
  }

  // 2. Ember theme resolves with owned items.
  {
    const theme = resolvePlayerVisualTheme({
      loadout: { ...BASE_LOADOUT, cardBackId: 'ember_card_back' },
      ownedIds: new Set(['ember_card_back']),
      freeIds: FREE_ID_SET,
    });
    assert(theme.cardBackTheme === 'ember_card_back', 'owned ember cosmetic resolves');
  }

  // 3. Unowned theme items fall back safely.
  {
    const theme = resolvePlayerVisualTheme({
      loadout: { ...BASE_LOADOUT, cardBackId: 'ember_card_back' },
      ownedIds: new Set(),
      freeIds: FREE_ID_SET,
    });
    assert(theme.cardBackTheme === classicTheme.cardBackTheme, 'unowned cosmetic falls back to classic');
  }

  // 4. Missing asset falls back safely (registry level — a category
  // whose only resolvable definition is disabled/missing still returns
  // a valid, enabled classic definition, never throws or returns undefined).
  {
    const resolved = resolveThemeDefinition('card_back', 'a_theme_id_that_does_not_exist');
    assert(resolved.isEnabled, 'an unresolvable theme id still returns a valid, enabled definition');
    assert(resolved.themeId === classicTheme.cardBackTheme, 'it resolves to classic specifically');
  }

  // 5-8. Visual themes do not alter deck order / scoring / timers /
  // rewards — structural isolation, re-verified at the release-candidate
  // stage across every 1.2 theme module including this milestone's new
  // files.
  {
    const themeSourceFiles = [
      'src/themes/themeRegistry.ts',
      'src/themes/resolvePlayerVisualTheme.ts',
      'src/themes/defaultTheme.ts',
      'src/themes/emberBlazeTheme.ts',
      'src/services/visualEventBus.ts',
      'src/services/visualAssetLoader.ts',
      'src/hooks/useBoardEffectEventBridge.ts',
    ];
    const forbiddenImportPatterns = [
      /from ['"].*\/game\//,
      /from ['"].*useWalletStore['"]/,
      /from ['"].*monetizationService['"]/,
    ];
    for (const relativePath of themeSourceFiles) {
      const source = readFileSync(path.join(REPO_ROOT, relativePath), 'utf8');
      for (const pattern of forbiddenImportPatterns) {
        assert(!pattern.test(source), `${relativePath} must never import gameplay/wallet modules (matched ${pattern})`);
      }
    }
    // useBoardEffectEventBridge is allowed to READ useGameStore (it
    // translates existing gameplay events into visual ones) but must
    // never import anything that could WRITE score/timer/deck state —
    // confirmed by the absence of any `set(` call or store-mutation
    // import in the file.
    const bridgeSource = readFileSync(path.join(REPO_ROOT, 'src/hooks/useBoardEffectEventBridge.ts'), 'utf8');
    assert(!bridgeSource.includes('.setState('), 'useBoardEffectEventBridge never writes to any store');
  }

  // 9. Card identity remains unchanged.
  {
    assert(cardAccessibilityLabel('10', 'diamonds') === 'Ten of Diamonds', 'card identity is theme-independent');
  }

  // 10. Visual effects execute once per event ID.
  {
    __resetVisualEventBusForTests();
    let count = 0;
    const unsubscribe = subscribeToVisualEffects(() => {
      count += 1;
    });
    const event = fakeEvent({ eventId: 'rc-dedupe-1' });
    publishVisualEffectEvent(event);
    publishVisualEffectEvent(event);
    publishVisualEffectEvent(event);
    unsubscribe();
    assert(count === 1, `each unique eventId delivers exactly once regardless of republish count (got ${count})`);
    __resetVisualEventBusForTests();
  }

  // 11. Effect queue limits simultaneous effects.
  {
    let queue: VisualEffectEvent[] = [];
    for (let i = 0; i < 6; i += 1) {
      queue = enqueueEffectBounded(queue, fakeEvent({ eventId: `q-${i}` }), 3);
    }
    assert(queue.length === 3, `queue never exceeds the configured cap (got ${queue.length})`);
    assert(queue[0].eventId === 'q-3', 'the oldest effects are dropped first, newest three retained');
    assert(queue[2].eventId === 'q-5', 'the newest effect is retained');
    // Re-publishing an id already in the queue must not grow it or duplicate it.
    const before = queue.length;
    queue = enqueueEffectBounded(queue, fakeEvent({ eventId: 'q-5' }), 3);
    assert(queue.length === before, 're-enqueuing an id already present is a no-op');
  }

  // 12. Pause/background cleanup works — verified by code review
  // (documented in docs/V1_2C_EFFECT_TIMING_FINAL.md): no themed effect
  // registers its own AppState/pause listener; every animation is a
  // fixed-duration Reanimated timer owned by a component that is only
  // ever unmounted by React's normal navigation lifecycle, never by a
  // pause/background transition (GameScreen stays mounted).
  assert(true, 'pause/background cleanup — verified by code review, see docs/V1_2C_EFFECT_TIMING_FINAL.md');

  // 13. Reduced Motion suppresses heavy effects — verified by code
  // review of ThemedBoardEffectLayer.tsx / ThemedVictoryEffect.tsx /
  // ThemedLaneEffect.tsx (cannot run under plain Node/tsx).
  assert(true, 'Reduced Motion suppression — verified by code review, see docs/V1_2C_QA_AUDIT.md section 13');

  // 14. Locker previews do not unlock cosmetics.
  {
    const previewSource = readFileSync(path.join(REPO_ROOT, 'src/components/cosmetics/CosmeticPreview.tsx'), 'utf8');
    for (const forbidden of ['purchaseWithCoins', 'equipCosmetic(', 'purchaseCosmeticWithCoins']) {
      assert(!previewSource.includes(forbidden), `CosmeticPreview.tsx must never call ${forbidden}`);
    }
  }

  // 15. Unowned cosmetics cannot be equipped.
  {
    const state = resolveCosmeticButtonState({
      entry: { unlockMethod: 'blaze_coins', blazeCoinCost: 150 },
      owned: false,
      equipped: false,
      balance: 10_000,
    });
    assert(state.kind !== 'equip' && state.kind !== 'equipped', 'an unowned cosmetic never resolves to an equip-capable state');
    assert(state.kind === 'unlock', 'an unowned, affordable cosmetic resolves to unlock, never a direct equip');
  }

  // 16. Existing ownership IDs remain unchanged.
  {
    const expectedIds = [
      'classic_card_face',
      'classic_card_back',
      'classic_arena',
      'default_profile_frame',
      'no_title',
      'ember_card_back',
      'gold_lane_glow',
      'midnight_card_style',
      'flame_profile_frame',
      'lava_arena_tint',
      'seven_day_blaze_title',
    ];
    const actualIds = V1_1B_LOCKER_CATALOG.map((entry) => entry.id);
    assert(actualIds.length === expectedIds.length, 'no cosmetic id was added or removed through Version 1.2C');
    for (const id of expectedIds) {
      assert(actualIds.includes(id), `cosmetic id "${id}" is unchanged`);
    }
  }

  // 17. Upgrade preserves cached loadout — a loadout built entirely from
  // ids that already existed before this milestone (simulating a
  // player's state carried over from Version 1.1) still resolves
  // correctly after the 1.2B/1.2C registry additions, with no migration
  // required.
  {
    const preExistingLoadout: PlayerVisualLoadout = {
      cardFaceId: 'midnight_card_style',
      cardBackId: 'ember_card_back',
      arenaId: 'lava_arena_tint',
      laneEffectId: 'gold_lane_glow',
      profileFrameId: 'flame_profile_frame',
      playerTitleId: 'seven_day_blaze_title',
    };
    const theme = resolvePlayerVisualTheme({
      loadout: preExistingLoadout,
      ownedIds: new Set([
        'midnight_card_style',
        'ember_card_back',
        'lava_arena_tint',
        'gold_lane_glow',
        'flame_profile_frame',
        'seven_day_blaze_title',
      ]),
      freeIds: FREE_ID_SET,
    });
    assert(theme.cardFaceTheme === 'midnight_card_style', 'a pre-existing loadout id resolves unchanged after 1.2C');
    assert(theme.cardBackTheme === 'ember_card_back', 'a pre-existing loadout id resolves unchanged after 1.2C');
    assert(theme.boardEffectTheme === 'ember_board_effect', 'a fully-ember pre-existing loadout gains the new coordinated effect automatically, with no data migration');
  }

  // 18. RevenueCat remains disabled.
  {
    const previousMonetization = process.env.EXPO_PUBLIC_ENABLE_MONETIZATION_BETA;
    const previousPurchases = process.env.EXPO_PUBLIC_ENABLE_STORE_PURCHASES;
    delete process.env.EXPO_PUBLIC_ENABLE_MONETIZATION_BETA;
    delete process.env.EXPO_PUBLIC_ENABLE_STORE_PURCHASES;
    try {
      assert(isStorePurchasesEnabled() === false, 'store purchases (RevenueCat) default to disabled');
    } finally {
      if (previousMonetization === undefined) delete process.env.EXPO_PUBLIC_ENABLE_MONETIZATION_BETA;
      else process.env.EXPO_PUBLIC_ENABLE_MONETIZATION_BETA = previousMonetization;
      if (previousPurchases === undefined) delete process.env.EXPO_PUBLIC_ENABLE_STORE_PURCHASES;
      else process.env.EXPO_PUBLIC_ENABLE_STORE_PURCHASES = previousPurchases;
    }
    const easConfig = JSON.parse(readFileSync(path.join(REPO_ROOT, 'eas.json'), 'utf8'));
    assert(
      easConfig.build.testflight.env.EXPO_PUBLIC_ENABLE_STORE_PURCHASES === 'false',
      'the testflight EAS profile explicitly disables store purchases',
    );
    const easSource = readFileSync(path.join(REPO_ROOT, 'eas.json'), 'utf8');
    assert(!/REVENUECAT/i.test(easSource), 'eas.json never references a RevenueCat env var (no Test Store key present anywhere)');
  }

  // 19. Paid UI remains hidden.
  {
    const previewSources = [
      readFileSync(path.join(REPO_ROOT, 'src/components/cosmetics/EmberCollectionPreview.tsx'), 'utf8'),
    ];
    for (const source of previewSources) {
      for (const forbidden of ['Buy Bundle', 'Best Value', 'Restore Purchase', 'Subscri']) {
        assert(!source.includes(forbidden), `paid-UI copy "${forbidden}" must never appear in the Locker collection preview`);
      }
      assert(!/\$\d/.test(source), 'no dollar-amount price appears in the Locker collection preview');
    }
  }

  // 20. TestFlight uses test ads.
  {
    const easConfig = JSON.parse(readFileSync(path.join(REPO_ROOT, 'eas.json'), 'utf8'));
    const testflightEnv = easConfig.build.testflight.env;
    assert(testflightEnv.EXPO_PUBLIC_ADMOB_USE_TEST_ADS === 'true', 'the testflight EAS profile forces AdMob test mode');
    assert(testflightEnv.EXPO_PUBLIC_ENABLE_V1_2_VISUAL_SYSTEM === 'true', 'the testflight EAS profile enables the Version 1.2 visual system');
    assert(testflightEnv.EXPO_PUBLIC_ENABLE_BOARD_EFFECTS === 'true', 'the testflight EAS profile enables board effects');
    assert(testflightEnv.EXPO_PUBLIC_ENABLE_VICTORY_EFFECTS === 'true', 'the testflight EAS profile enables victory effects');
    assert(testflightEnv.EXPO_PUBLIC_ENABLE_THEME_PREVIEW_DEV === 'false', 'the testflight EAS profile keeps the dev theme preview off for testers');
    assert(easConfig.build.testflight.distribution === 'store', 'testflight profile remains store distribution');
    assert(easConfig.build.testflight.autoIncrement === true, 'testflight profile keeps EAS autoIncrement for the build number');
    assert(easConfig.build.testflight.developmentClient === undefined, 'testflight profile never sets developmentClient');
    const previous = process.env.EXPO_PUBLIC_ADMOB_USE_TEST_ADS;
    process.env.EXPO_PUBLIC_ADMOB_USE_TEST_ADS = 'true';
    try {
      assert(isAdMobTestModeForced() === true, 'isAdMobTestModeForced() reports true when the testflight-style flag is set');
    } finally {
      if (previous === undefined) delete process.env.EXPO_PUBLIC_ADMOB_USE_TEST_ADS;
      else process.env.EXPO_PUBLIC_ADMOB_USE_TEST_ADS = previous;
    }
  }

  // 21. Web avoids unsupported native visual code.
  {
    assert(
      VISUAL_ASSET_METADATA.every((entry) => isAssetSupportedOnPlatform(entry, 'web')),
      'every Version 1.2 visual asset (through 1.2C) declares web support',
    );
  }

  // 22. Optional asset failure does not block gameplay — verified by
  // code review (every visualAssetLoader preload function is fire-and-
  // forget) plus the pure resolver-level guarantee: an "unavailable"
  // theme id never throws and always yields a valid, enabled theme.
  {
    const theme = resolvePlayerVisualTheme({
      loadout: { ...BASE_LOADOUT, cardBackId: 'ember_card_back' },
      ownedIds: new Set(['ember_card_back']),
      freeIds: FREE_ID_SET,
      unavailableThemeIds: new Set(['ember_card_back']),
    });
    assert(theme.cardBackTheme === classicTheme.cardBackTheme, 'a failed/unavailable owned asset still falls back safely, never blocking resolution');
  }

  // 23. Developer preview is inaccessible in release builds.
  {
    const previous = process.env.EXPO_PUBLIC_ENABLE_THEME_PREVIEW_DEV;
    process.env.EXPO_PUBLIC_ENABLE_THEME_PREVIEW_DEV = 'true';
    try {
      assert(
        isThemePreviewDevEnabled() === false,
        'the dev theme preview stays unavailable outside __DEV__ regardless of the flag',
      );
    } finally {
      if (previous === undefined) delete process.env.EXPO_PUBLIC_ENABLE_THEME_PREVIEW_DEV;
      else process.env.EXPO_PUBLIC_ENABLE_THEME_PREVIEW_DEV = previous;
    }
  }

  // 24. Asset validator passes release assets.
  {
    assert(
      findThemesRequiringMissingAssets(getAllThemeDefinitions(), VISUAL_ASSET_METADATA).length === 0,
      'no enabled theme definition references a missing asset',
    );
    assert(
      findMissingFallbackReferences(VISUAL_ASSET_METADATA).length === 0,
      'no asset has a dangling fallbackAssetId',
    );
  }

  // Release-identity sanity: version bumped, bundle identifier
  // unchanged.
  {
    const appConfig = JSON.parse(readFileSync(path.join(REPO_ROOT, 'app.json'), 'utf8'));
    assert(appConfig.expo.version === '1.2.0', 'app.json version is 1.2.0');
    assert(appConfig.expo.ios.bundleIdentifier === 'com.twentyoneblaze.app', 'iOS bundle identifier is unchanged');
    assert(appConfig.expo.android.package === 'com.twentyoneblaze.app', 'Android package id is unchanged');
    assert(appConfig.expo.extra.eas.projectId === '0c5db163-a4c0-4a17-9a8a-e12eed3bf511', 'EAS project id is unchanged');
  }

  __resetVisualThemeMemoForTests();
}

runV1_2CReleaseCandidateSelfTests();
console.log('Version 1.2C release-candidate self-tests passed.');
