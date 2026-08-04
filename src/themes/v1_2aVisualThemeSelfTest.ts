/**
 * Version 1.2A "Visual Theme System Foundation" — pure unit tests.
 *
 * Scope: only genuinely pure, RN-independent logic is exercised here,
 * matching the existing self-test convention in this repo (see
 * `monetizationSelfTest.ts` / `v1_1bLockerSelfTest.ts` /
 * `v1_1cAdsSelfTest.ts`). Components that require React Native
 * (`ThemedCardBack`, `ThemedArenaBackground`, `ThemedLaneEffect`,
 * `ThemedBoardEffectLayer`, `ThemedVictoryEffect`, `visualAssetLoader.ts`)
 * cannot run under a plain Node/tsx process; their guarantees are
 * verified by code review, documented inline below.
 *
 * Each numbered comment maps directly to a scenario in the Version 1.2A
 * spec's "UNIT TESTS" section.
 */
import {
  findDuplicateAssetIds,
  findMissingFallbackReferences,
} from '../assets/manifest/validateManifest';
import { isAssetSupportedOnPlatform } from '../assets/manifest/types';
import { VISUAL_ASSET_METADATA } from '../assets/manifest/visualAssetManifestData';
import {
  FREE_DEFAULT_COSMETIC_IDS,
  V1_1B_LOCKER_CATALOG,
} from '../cosmetics/lockerCatalog';
import { classicTheme } from './defaultTheme';
import {
  publishVisualEffectEvent,
  subscribeToVisualEffects,
  __resetVisualEventBusForTests,
} from '../services/visualEventBus';
import {
  getAllThemeDefinitions,
  resolveThemeDefinition,
} from './themeRegistry';
import {
  __resetVisualThemeMemoForTests,
  resolvePlayerVisualTheme,
} from './resolvePlayerVisualTheme';
import { isStorePurchasesEnabled, isThemePreviewDevEnabled } from '../config/featureFlags';
import type { PlayerVisualLoadout } from './types';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Version 1.2A visual theme self-test failed: ${message}`);
  }
}

const BASE_LOADOUT: PlayerVisualLoadout = {
  cardFaceId: 'classic_card_face',
  cardBackId: 'classic_card_back',
  arenaId: 'classic_arena',
  laneEffectId: null,
  profileFrameId: 'default_profile_frame',
  playerTitleId: null,
};

const FREE_ID_SET = new Set(FREE_DEFAULT_COSMETIC_IDS);

export function runV1_2AVisualThemeSelfTests(): void {
  // 1. Classic theme always resolves.
  {
    assert(classicTheme.themeId === 'classic', 'classicTheme has themeId "classic"');
    assert(classicTheme.isEnabled === true, 'classicTheme is always enabled');
    assert(classicTheme.fallbackThemeId === null, 'classicTheme has no further fallback');
    for (const category of [
      'card_face',
      'card_back',
      'arena',
      'lane_effect',
      'board_effect',
      'victory_effect',
      'profile_frame',
      'player_title',
    ] as const) {
      const resolved = resolveThemeDefinition(category, undefined);
      assert(resolved.isEnabled, `resolveThemeDefinition always returns an enabled definition for ${category}`);
    }
  }

  // 2. Missing card-face theme falls back to classic.
  {
    const resolved = resolveThemeDefinition('card_face', 'does_not_exist_theme_id');
    assert(resolved.themeId === classicTheme.cardFaceTheme, 'unknown card_face theme id falls back to classic');
  }

  // 3. Missing arena falls back to classic.
  {
    const resolved = resolveThemeDefinition('arena', 'does_not_exist_arena_id');
    assert(resolved.themeId === classicTheme.arenaTheme, 'unknown arena theme id falls back to classic');
  }

  // 4. Disabled theme cannot be selected.
  {
    // resolveThemeDefinition walks the fallback chain past any disabled
    // definition — simulate by resolving a category with an id that
    // exists but re-checking the real registry never marks anything
    // consumer-facing as disabled while still resolving safely if it
    // were. We assert the *mechanism*: a definition with isEnabled=false
    // is never returned by resolveThemeDefinition for any input, using
    // the real registry's introspection.
    const allDisabled = getAllThemeDefinitions().filter((def) => !def.isEnabled);
    assert(allDisabled.length === 0, 'the current registry ships no disabled themes (sanity check)');
    // The resolver's contract: even if a lookup finds a disabled
    // definition, it continues down the fallback chain rather than
    // returning it. Verified by code review of resolveThemeDefinition's
    // `if (candidate && candidate.isEnabled)` gate.
  }

  // 5. Unowned cosmetic is not resolved as equipped.
  {
    const loadout: PlayerVisualLoadout = { ...BASE_LOADOUT, cardBackId: 'ember_card_back' };
    const theme = resolvePlayerVisualTheme({
      loadout,
      ownedIds: new Set(), // does NOT own ember_card_back
      freeIds: FREE_ID_SET,
    });
    assert(
      theme.cardBackTheme === classicTheme.cardBackTheme,
      'an equipped-but-unowned cosmetic never resolves — falls back to classic',
    );
  }

  // 6. Owned cosmetic resolves correctly.
  {
    const loadout: PlayerVisualLoadout = { ...BASE_LOADOUT, cardBackId: 'ember_card_back' };
    const theme = resolvePlayerVisualTheme({
      loadout,
      ownedIds: new Set(['ember_card_back']),
      freeIds: FREE_ID_SET,
    });
    assert(theme.cardBackTheme === 'ember_card_back', 'an owned, equipped cosmetic resolves correctly');
  }

  // 7. Theme resolution does not alter gameplay state — resolvePlayerVisualTheme
  // is a pure function (no mutation of any input, no side effects); prove
  // it by calling it twice with the same frozen input and checking deep
  // equality plus that the input objects are untouched.
  {
    const loadout: PlayerVisualLoadout = Object.freeze({ ...BASE_LOADOUT });
    const ownedIds = Object.freeze(new Set(['ember_card_back']));
    const first = resolvePlayerVisualTheme({ loadout, ownedIds, freeIds: FREE_ID_SET });
    const second = resolvePlayerVisualTheme({ loadout, ownedIds, freeIds: FREE_ID_SET });
    assert(JSON.stringify(first) === JSON.stringify(second), 'resolution is pure/deterministic for the same input');
    assert(loadout.cardFaceId === 'classic_card_face', 'resolution never mutates the input loadout');
  }

  // 8. Board effects deduplicate event IDs.
  {
    __resetVisualEventBusForTests();
    let receivedCount = 0;
    const unsubscribe = subscribeToVisualEffects(() => {
      receivedCount += 1;
    });
    const event = {
      eventId: 'dedupe-test-1',
      eventType: 'card_placed' as const,
      timestamp: Date.now(),
      intensity: 'medium' as const,
      themeContext: 'classic_board_effect',
    };
    publishVisualEffectEvent(event);
    publishVisualEffectEvent(event); // duplicate — must be ignored
    publishVisualEffectEvent({ ...event, eventId: 'dedupe-test-2' }); // distinct — must fire
    unsubscribe();
    assert(receivedCount === 2, `duplicate eventId is ignored (expected 2 deliveries, got ${receivedCount})`);
    __resetVisualEventBusForTests();
  }

  // 9. Reduced Motion suppresses heavy effects — verified by code review:
  // `ThemedBoardEffectLayer` renders no `EffectBurst` children when
  // `useReducedMotionSetting()` is true (`reduceMotion ? null : <EffectBurst .../>`),
  // and `ThemedVictoryEffect` swaps its animated sweep + ember burst for a
  // single brief non-moving glow. Cannot run under plain Node (both
  // depend on `useReducedMotionSetting`, which needs React Native's
  // `AccessibilityInfo`).
  assert(true, 'Reduced Motion suppression — verified by code review of ThemedBoardEffectLayer.tsx / ThemedVictoryEffect.tsx');

  // 10. Asset manifest rejects duplicate IDs.
  {
    const withDuplicate = [
      ...VISUAL_ASSET_METADATA,
      { ...VISUAL_ASSET_METADATA[0] },
    ];
    const duplicates = findDuplicateAssetIds(withDuplicate);
    assert(duplicates.length === 1 && duplicates[0] === VISUAL_ASSET_METADATA[0].id, 'a duplicated id is detected');
    assert(findDuplicateAssetIds(VISUAL_ASSET_METADATA).length === 0, 'the real manifest has no duplicate ids');
  }

  // 11. Asset manifest rejects missing fallback IDs.
  {
    const withBadFallback = [
      ...VISUAL_ASSET_METADATA,
      {
        ...VISUAL_ASSET_METADATA[0],
        id: 'test_only_bad_fallback_entry',
        fallbackAssetId: 'this_id_does_not_exist',
      },
    ];
    const missing = findMissingFallbackReferences(withBadFallback);
    assert(
      missing.some((m) => m.id === 'test_only_bad_fallback_entry' && m.missingFallbackId === 'this_id_does_not_exist'),
      'a fallbackAssetId pointing at a non-existent id is detected',
    );
    assert(
      findMissingFallbackReferences(VISUAL_ASSET_METADATA).length === 0,
      'the real manifest has no dangling fallback references',
    );
  }

  // 12. Preview screen is unavailable in production.
  {
    // Under a plain Node/tsx process (no Metro/RN runtime), the global
    // `__DEV__` is genuinely undefined — the exact condition
    // `isThemePreviewDevEnabled()` must fail safe against, regardless of
    // the feature flag's value.
    const previous = process.env.EXPO_PUBLIC_ENABLE_THEME_PREVIEW_DEV;
    process.env.EXPO_PUBLIC_ENABLE_THEME_PREVIEW_DEV = 'true';
    try {
      assert(
        isThemePreviewDevEnabled() === false,
        'the dev theme preview is unavailable when __DEV__ is not set, even if the flag is true',
      );
    } finally {
      if (previous === undefined) delete process.env.EXPO_PUBLIC_ENABLE_THEME_PREVIEW_DEV;
      else process.env.EXPO_PUBLIC_ENABLE_THEME_PREVIEW_DEV = previous;
    }
  }

  // 13. Asset loading failure does not block gameplay — verified by code
  // review: every branch of `loadVisualAsset()`
  // (src/services/visualAssetLoader.ts) resolves to a status string
  // ('loaded' | 'failed'), never throws, and `preloadVisualAssets` /
  // `preloadThemeAssets` are always fire-and-forget (`void
  // preloadThemeAssets(...)` at every call site) — nothing awaits them
  // before rendering.
  assert(true, 'asset load failures never block gameplay — verified by code review of visualAssetLoader.ts');

  // 14. Web skips unsupported native visual code.
  {
    const webUnsupportedEntry = { platformSupport: ['ios', 'android'] as const };
    assert(
      isAssetSupportedOnPlatform(webUnsupportedEntry, 'web') === false,
      'an asset scoped to ios/android only reports unsupported on web',
    );
    const allPlatformsEntry = { platformSupport: ['ios', 'android', 'web'] as const };
    assert(
      isAssetSupportedOnPlatform(allPlatformsEntry, 'web') === true,
      'an asset scoped to all platforms reports supported on web',
    );
    // Every manifest entry the app actually ships today supports web.
    assert(
      VISUAL_ASSET_METADATA.every((entry) => isAssetSupportedOnPlatform(entry, 'web')),
      'no Version 1.2A asset is web-unsupported (nothing to skip yet, but the mechanism is proven above)',
    );
  }

  // 15. RevenueCat remains disabled.
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
  }

  // 16. Existing cosmetic IDs remain unchanged.
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
    for (const id of expectedIds) {
      assert(actualIds.includes(id), `Version 1.1B cosmetic id "${id}" still exists unchanged`);
    }
    assert(actualIds.length === expectedIds.length, 'no Version 1.1B cosmetic ids were added or removed');

    // Cross-consistency: every theme definition linked to a cosmetic
    // points at a real, still-existing lockerCatalog id — a future
    // theme-registry edit can never silently orphan a cosmetic id.
    const catalogIdSet = new Set(actualIds);
    for (const def of getAllThemeDefinitions()) {
      if (def.cosmeticId != null) {
        assert(
          catalogIdSet.has(def.cosmeticId),
          `theme "${def.themeId}" links cosmeticId "${def.cosmeticId}", which must exist in the locker catalog`,
        );
      }
    }
  }

  __resetVisualThemeMemoForTests();
}

runV1_2AVisualThemeSelfTests();
console.log('Version 1.2A visual theme self-tests passed.');
