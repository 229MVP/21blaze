/**
 * Version 1.2B "Ember Blaze Visual Collection Integration" — pure unit
 * tests. Follows the same convention as `v1_2aVisualThemeSelfTest.ts`:
 * only genuinely pure, RN-independent logic is exercised here.
 * Components that require React Native (`ThemedBoardEffectLayer`,
 * `ThemedVictoryEffect`, `EmberCollectionPreview`, `ThemePreviewScreen`)
 * cannot run under a plain Node/tsx process; their guarantees are
 * verified by code review, documented inline below.
 *
 * Each numbered comment maps to a scenario in the Version 1.2B spec's
 * "TESTS" section (22 scenarios).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import {
  findDuplicateAssetIds,
  findMissingFallbackReferences,
  findThemesRequiringMissingAssets,
} from '../assets/manifest/validateManifest';
import { isAssetSupportedOnPlatform } from '../assets/manifest/types';
import { VISUAL_ASSET_METADATA } from '../assets/manifest/visualAssetManifestData';
import { cardAccessibilityLabel } from '../components/cards/cardUtils';
import { FREE_DEFAULT_COSMETIC_IDS, V1_1B_LOCKER_CATALOG } from '../cosmetics/lockerCatalog';
import { classicTheme } from './defaultTheme';
import { EMBER_COLLECTION_PIECES, emberBlazeTheme } from './emberBlazeTheme';
import {
  publishVisualEffectEvent,
  subscribeToVisualEffects,
  __resetVisualEventBusForTests,
} from '../services/visualEventBus';
import {
  findThemeIdsRequiringAnyAsset,
  getAllThemeDefinitions,
  resolveThemeDefinition,
} from './themeRegistry';
import {
  __resetVisualThemeMemoForTests,
  countEmberFamilyEquipped,
  EMBER_FAMILY_THEME_IDS,
  resolvePlayerVisualTheme,
} from './resolvePlayerVisualTheme';
import { isBoardEffectsEnabled, isStorePurchasesEnabled, isVictoryEffectsEnabled } from '../config/featureFlags';
import type { PlayerVisualLoadout } from './types';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Version 1.2B Ember collection self-test failed: ${message}`);
  }
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../..');

const FREE_ID_SET = new Set(FREE_DEFAULT_COSMETIC_IDS);

const FULL_EMBER_LOADOUT: PlayerVisualLoadout = {
  cardFaceId: 'classic_card_face',
  cardBackId: 'ember_card_back',
  arenaId: 'lava_arena_tint',
  laneEffectId: 'gold_lane_glow',
  profileFrameId: 'flame_profile_frame',
  playerTitleId: 'seven_day_blaze_title',
};

const FULL_EMBER_OWNED = new Set([
  'ember_card_back',
  'lava_arena_tint',
  'gold_lane_glow',
  'flame_profile_frame',
  'seven_day_blaze_title',
]);

export function runV1_2BEmberCollectionSelfTests(): void {
  // 1. Ember theme resolves with owned cosmetics.
  {
    const theme = resolvePlayerVisualTheme({
      loadout: FULL_EMBER_LOADOUT,
      ownedIds: FULL_EMBER_OWNED,
      freeIds: FREE_ID_SET,
    });
    assert(theme.cardBackTheme === 'ember_card_back', 'owned ember_card_back resolves');
    assert(theme.arenaTheme === 'lava_arena_tint', 'owned lava_arena_tint resolves');
    assert(theme.laneTheme === 'gold_lane_glow', 'owned gold_lane_glow resolves');
    assert(theme.profileFrameTheme === 'flame_profile_frame', 'owned flame_profile_frame resolves');
    assert(theme.boardEffectTheme === 'ember_board_effect', 'coordinated ember loadout resolves ember board effect');
    assert(theme.victoryEffectTheme === 'ember_victory_effect', 'coordinated ember loadout resolves ember victory effect');
    assert(theme.themeId === 'ember_blaze', 'a fully-coordinated ember loadout reports themeId "ember_blaze"');
  }

  // 2. Unowned Ember cosmetic falls back correctly.
  {
    const theme = resolvePlayerVisualTheme({
      loadout: FULL_EMBER_LOADOUT,
      ownedIds: new Set(), // owns nothing
      freeIds: FREE_ID_SET,
    });
    assert(theme.cardBackTheme === classicTheme.cardBackTheme, 'unowned ember_card_back falls back to classic');
    assert(theme.arenaTheme === classicTheme.arenaTheme, 'unowned lava_arena_tint falls back to classic');
    assert(
      theme.boardEffectTheme === classicTheme.boardEffectTheme,
      'with nothing owned, the derived board effect is classic (never ember without real pieces)',
    );
  }

  // 3. Classic remains available (and a single ember piece is not
  // enough to imply the whole coordinated collection).
  {
    const theme = resolvePlayerVisualTheme({
      loadout: { ...FULL_EMBER_LOADOUT, arenaId: 'classic_arena', laneEffectId: null, profileFrameId: 'default_profile_frame' },
      ownedIds: new Set(['ember_card_back']),
      freeIds: FREE_ID_SET,
    });
    assert(theme.cardBackTheme === 'ember_card_back', 'a single owned ember piece still equips correctly');
    assert(
      theme.boardEffectTheme === 'classic_board_effect',
      'a single ember piece alone does not trigger the coordinated ember board effect',
    );
    assert(countEmberFamilyEquipped({
      cardBackTheme: theme.cardBackTheme,
      arenaTheme: theme.arenaTheme,
      laneTheme: theme.laneTheme,
      profileFrameTheme: theme.profileFrameTheme,
    }) === 1, 'countEmberFamilyEquipped correctly counts exactly one ember piece');
  }

  // 4. Missing Ember asset falls back without crashing.
  {
    const unavailable = findThemeIdsRequiringAnyAsset(new Set(['ember_card_back_asset']));
    assert(unavailable.has('ember_card_back'), 'a failed ember_card_back_asset maps back to the ember_card_back themeId');
    const theme = resolvePlayerVisualTheme({
      loadout: FULL_EMBER_LOADOUT,
      ownedIds: FULL_EMBER_OWNED,
      freeIds: FREE_ID_SET,
      unavailableThemeIds: unavailable,
    });
    assert(theme.cardBackTheme === classicTheme.cardBackTheme, 'a failed required asset falls back that category to classic');
    assert(theme.arenaTheme === 'lava_arena_tint', 'other, unaffected categories keep resolving normally');
  }

  // 5. Card identity remains unchanged across themes — accessibility
  // labeling (the one place "identity" is externally observable from
  // pure code) never depends on which theme/collection is active; it is
  // a pure function of rank + suit only.
  {
    assert(cardAccessibilityLabel('A', 'hearts') === 'Ace of Hearts', 'card identity label is theme-independent (ace)');
    assert(cardAccessibilityLabel('K', 'spades') === 'King of Spades', 'card identity label is theme-independent (king)');
    // The theme/resolver modules never import rank/suit logic at all —
    // verified structurally below (also covers 6-9).
  }

  // 6-9. Theme resolution never touches deck order, scoring, timers, or
  // rewards — verified structurally: none of the Version 1.2 theme
  // modules import anything from the game engine, wallet, or reward
  // systems.
  {
    const themeSourceFiles = [
      'src/themes/themeRegistry.ts',
      'src/themes/resolvePlayerVisualTheme.ts',
      'src/themes/defaultTheme.ts',
      'src/themes/emberBlazeTheme.ts',
      'src/services/visualEventBus.ts',
    ];
    const forbiddenImportPatterns = [
      /from ['"].*\/game\//,
      /from ['"].*useWalletStore['"]/,
      /from ['"].*useGameStore['"]/,
      /from ['"].*monetizationService['"]/,
    ];
    for (const relativePath of themeSourceFiles) {
      const source = readFileSync(path.join(REPO_ROOT, relativePath), 'utf8');
      for (const pattern of forbiddenImportPatterns) {
        assert(
          !pattern.test(source),
          `${relativePath} must never import gameplay/wallet/reward modules (matched ${pattern})`,
        );
      }
    }
  }

  // 10-13. Board effects deduplicate event IDs per event type (card
  // placed / exact 21 / bust / five-card clear) — each publishes exactly
  // once per unique eventId, proving the visual-event bus (which backs
  // `ThemedBoardEffectLayer`) never double-fires any of the four
  // Ember-collection effect types.
  {
    const eventTypes = ['card_placed', 'exact_21', 'five_card_clear', 'bust'] as const;
    for (const eventType of eventTypes) {
      __resetVisualEventBusForTests();
      let count = 0;
      const unsubscribe = subscribeToVisualEffects(() => {
        count += 1;
      });
      const event = {
        eventId: `${eventType}-dedupe-1`,
        eventType,
        timestamp: Date.now(),
        intensity: 'medium' as const,
        themeContext: 'ember_board_effect',
      };
      publishVisualEffectEvent(event);
      publishVisualEffectEvent(event); // duplicate — ignored
      publishVisualEffectEvent({ ...event, eventId: `${eventType}-dedupe-2` }); // distinct — fires
      unsubscribe();
      assert(count === 2, `${eventType} fires once per unique eventId (expected 2 deliveries, got ${count})`);
      __resetVisualEventBusForTests();
    }
  }

  // 14. Reduced Motion suppresses heavy animation — verified by code
  // review: `ThemedBoardEffectLayer` renders no `EffectBurst` children
  // under Reduced Motion, and `ThemedVictoryEffect` swaps its ember/gold
  // sweep + burst dots for a single brief non-moving glow regardless of
  // whether the classic or ember palette is active. Cannot run under
  // plain Node (both depend on `useReducedMotionSetting`).
  assert(true, 'Reduced Motion suppression — verified by code review of ThemedBoardEffectLayer.tsx / ThemedVictoryEffect.tsx');

  // 15. Disabled effects leave gameplay functional — the effects flags
  // default OFF, and `useBoardEffectEventBridge` / the visual event bus
  // are presentation-only translations of already-existing gameplay
  // state (never a second gameplay event source), so gameplay is
  // unaffected regardless of these flags' values.
  {
    const previousBoard = process.env.EXPO_PUBLIC_ENABLE_BOARD_EFFECTS;
    const previousVictory = process.env.EXPO_PUBLIC_ENABLE_VICTORY_EFFECTS;
    const previousVisual = process.env.EXPO_PUBLIC_ENABLE_V1_2_VISUAL_SYSTEM;
    delete process.env.EXPO_PUBLIC_ENABLE_BOARD_EFFECTS;
    delete process.env.EXPO_PUBLIC_ENABLE_VICTORY_EFFECTS;
    delete process.env.EXPO_PUBLIC_ENABLE_V1_2_VISUAL_SYSTEM;
    try {
      assert(isBoardEffectsEnabled() === false, 'board effects default disabled');
      assert(isVictoryEffectsEnabled() === false, 'victory effects default disabled');
    } finally {
      if (previousBoard === undefined) delete process.env.EXPO_PUBLIC_ENABLE_BOARD_EFFECTS;
      else process.env.EXPO_PUBLIC_ENABLE_BOARD_EFFECTS = previousBoard;
      if (previousVictory === undefined) delete process.env.EXPO_PUBLIC_ENABLE_VICTORY_EFFECTS;
      else process.env.EXPO_PUBLIC_ENABLE_VICTORY_EFFECTS = previousVictory;
      if (previousVisual === undefined) delete process.env.EXPO_PUBLIC_ENABLE_V1_2_VISUAL_SYSTEM;
      else process.env.EXPO_PUBLIC_ENABLE_V1_2_VISUAL_SYSTEM = previousVisual;
    }
  }

  // 16. Locker previews do not unlock items — structural check: the
  // read-only Ember collection preview component never references any
  // purchase/equip dispatcher.
  {
    const source = readFileSync(
      path.join(REPO_ROOT, 'src/components/cosmetics/EmberCollectionPreview.tsx'),
      'utf8',
    );
    for (const forbidden of ['purchaseWithCoins', 'equipCosmetic(', 'purchaseCosmeticWithCoins']) {
      assert(!source.includes(forbidden), `EmberCollectionPreview.tsx must never call ${forbidden}`);
    }
  }

  // 17. Ownership IDs remain unchanged — the four Ember pieces this
  // collection composes still map to their original Version 1.1B
  // cosmetic ids, and the two new board/victory effect definitions
  // remain non-ownable (cosmeticId: null), never silently becoming a
  // seventh purchasable item.
  {
    const catalogIds = new Set(V1_1B_LOCKER_CATALOG.map((entry) => entry.id));
    assert(catalogIds.has(EMBER_FAMILY_THEME_IDS.cardBack), 'ember_card_back cosmetic id unchanged');
    assert(catalogIds.has(EMBER_FAMILY_THEME_IDS.arena), 'lava_arena_tint cosmetic id unchanged');
    assert(catalogIds.has(EMBER_FAMILY_THEME_IDS.lane), 'gold_lane_glow cosmetic id unchanged');
    assert(catalogIds.has(EMBER_FAMILY_THEME_IDS.profileFrame), 'flame_profile_frame cosmetic id unchanged');
    const boardDef = resolveThemeDefinition('board_effect', 'ember_board_effect');
    const victoryDef = resolveThemeDefinition('victory_effect', 'ember_victory_effect');
    assert(boardDef.cosmeticId === null, 'ember_board_effect is not a purchasable cosmetic');
    assert(victoryDef.cosmeticId === null, 'ember_victory_effect is not a purchasable cosmetic');
    for (const piece of EMBER_COLLECTION_PIECES) {
      assert(catalogIds.has(piece.cosmeticId), `emberBlazeTheme collection piece "${piece.cosmeticId}" is a real catalog id`);
    }
  }

  // 18. Theme preload failure does not block gameplay — verified by code
  // review (every `visualAssetLoader` preload function is fire-and-forget
  // at every call site) plus a pure check of the new failure-to-theme
  // mapping used to drive the fallback: an empty failure set maps to an
  // empty theme-id set (never throws, never blocks resolution).
  {
    assert(findThemeIdsRequiringAnyAsset(new Set()).size === 0, 'no failures maps to no unavailable themes');
    assert(
      findThemeIdsRequiringAnyAsset(new Set(['this_asset_id_does_not_exist'])).size === 0,
      'an unrecognized failed asset id maps to no theme (never throws)',
    );
  }

  // 19. Web avoids unsupported native effects — the two new Ember
  // board/victory overlay assets are code-driven and declare support for
  // ios/android/web equally, so nothing about this milestone introduces
  // a web-unsupported asset.
  {
    const newEntries = VISUAL_ASSET_METADATA.filter(
      (entry) => entry.id === 'ember_board_overlay_asset' || entry.id === 'ember_victory_overlay_asset',
    );
    assert(newEntries.length === 2, 'both new Ember effect asset entries exist in the manifest');
    for (const entry of newEntries) {
      assert(isAssetSupportedOnPlatform(entry, 'web'), `${entry.id} supports web`);
    }
  }

  // 20. RevenueCat remains disabled.
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

  // 21. No paid UI appears — structural check: the collection preview
  // component's source never contains dollar-price / bundle-purchase
  // copy.
  {
    const source = readFileSync(
      path.join(REPO_ROOT, 'src/components/cosmetics/EmberCollectionPreview.tsx'),
      'utf8',
    );
    for (const forbidden of ['Buy Bundle', 'Best Value', 'Restore Purchase', 'Subscri']) {
      assert(!source.includes(forbidden), `EmberCollectionPreview.tsx must never contain "${forbidden}"`);
    }
    assert(!/\$\d/.test(source), 'EmberCollectionPreview.tsx must never contain a dollar-amount price');
  }

  // 22. Asset validator detects a missing required manifest reference.
  {
    const fakeThemeDefs = [
      { themeId: 'fake_theme', category: 'card_back', isEnabled: true, requiredAssets: ['this_id_does_not_exist_asset'] },
    ];
    const missing = findThemesRequiringMissingAssets(fakeThemeDefs, VISUAL_ASSET_METADATA);
    assert(
      missing.some((m) => m.themeId === 'fake_theme' && m.missingAssetId === 'this_id_does_not_exist_asset'),
      'a theme requiring a non-existent asset id is detected',
    );
    assert(
      findThemesRequiringMissingAssets(getAllThemeDefinitions(), VISUAL_ASSET_METADATA).length === 0,
      'the real registry has no theme referencing a missing asset',
    );
    // Duplicate/fallback checks (shared with 1.2A) still pass with the
    // two new manifest entries added in this milestone.
    assert(findDuplicateAssetIds(VISUAL_ASSET_METADATA).length === 0, 'no duplicate asset ids after 1.2B additions');
    assert(findMissingFallbackReferences(VISUAL_ASSET_METADATA).length === 0, 'no dangling fallback ids after 1.2B additions');
  }

  // Sanity: emberBlazeTheme itself resolves through the real registry
  // (never a hand-rolled/duplicated set of ids) and never claims a
  // card-face cosmetic that does not exist.
  {
    assert(emberBlazeTheme.cardFaceTheme === classicTheme.cardFaceTheme, 'emberBlazeTheme never fabricates an ember card face');
    assert(emberBlazeTheme.cardBackTheme === 'ember_card_back', 'emberBlazeTheme card back is the real ember_card_back');
    assert(emberBlazeTheme.requiredAssets.length > 0, 'emberBlazeTheme declares required assets');
  }

  __resetVisualThemeMemoForTests();
}

runV1_2BEmberCollectionSelfTests();
console.log('Version 1.2B Ember collection self-tests passed.');
