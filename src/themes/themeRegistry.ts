import type { ThemeCategory, ThemeDefinition } from './types';

/**
 * Version 1.2A — per-category theme registry.
 *
 * `themeId` matches the corresponding `src/cosmetics/lockerCatalog.ts`
 * cosmetic id 1:1 wherever a cosmetic exists (`cosmeticId` mirrors it) —
 * ownership IDs never change when this registry is extended in 1.2B.
 * `board_effect` / `victory_effect` have no cosmetic yet (nothing is
 * ownable there today); their classic entries always resolve.
 *
 * Every non-classic row's `fallbackThemeId` points at a classic row in
 * the same category, and every classic row's `fallbackThemeId` points at
 * itself — `resolveThemeDefinition` always terminates.
 */
const REGISTRY: readonly ThemeDefinition[] = [
  // card_face
  {
    themeId: 'classic_card_face',
    category: 'card_face',
    displayName: 'Classic Card Face',
    rarity: 'common',
    assetVersion: 1,
    requiredAssets: ['classic_card_face_asset'],
    fallbackThemeId: 'classic_card_face',
    isEnabled: true,
    cosmeticId: 'classic_card_face',
  },
  {
    themeId: 'midnight_card_style',
    category: 'card_face',
    displayName: 'Midnight Card Style',
    rarity: 'rare',
    assetVersion: 1,
    requiredAssets: ['midnight_card_face_asset'],
    fallbackThemeId: 'classic_card_face',
    isEnabled: true,
    cosmeticId: 'midnight_card_style',
  },

  // card_back
  {
    themeId: 'classic_card_back',
    category: 'card_back',
    displayName: 'Classic Card Back',
    rarity: 'common',
    assetVersion: 1,
    requiredAssets: ['classic_card_back_asset'],
    fallbackThemeId: 'classic_card_back',
    isEnabled: true,
    cosmeticId: 'classic_card_back',
  },
  {
    themeId: 'ember_card_back',
    category: 'card_back',
    displayName: 'Ember Card Back',
    rarity: 'uncommon',
    assetVersion: 1,
    requiredAssets: ['ember_card_back_asset'],
    fallbackThemeId: 'classic_card_back',
    isEnabled: true,
    cosmeticId: 'ember_card_back',
  },

  // arena
  {
    themeId: 'classic_arena',
    category: 'arena',
    displayName: 'Classic Arena',
    rarity: 'common',
    assetVersion: 1,
    requiredAssets: [
      'classic_arena_home_asset',
      'classic_arena_gameplay_asset',
      'classic_arena_gameplay_subtle_asset',
    ],
    fallbackThemeId: 'classic_arena',
    isEnabled: true,
    cosmeticId: 'classic_arena',
  },
  {
    themeId: 'lava_arena_tint',
    category: 'arena',
    displayName: 'Lava Arena',
    rarity: 'epic',
    assetVersion: 1,
    requiredAssets: ['lava_arena_tint_asset'],
    fallbackThemeId: 'classic_arena',
    isEnabled: true,
    cosmeticId: 'lava_arena_tint',
  },

  // lane_effect (no free default cosmetic exists — 'none' is represented
  // by a null equipped id and handled directly in resolvePlayerVisualTheme)
  {
    themeId: 'classic_lane_effect',
    category: 'lane_effect',
    displayName: 'Classic Lane',
    rarity: 'common',
    assetVersion: 1,
    requiredAssets: ['classic_lane_overlay_asset'],
    fallbackThemeId: 'classic_lane_effect',
    isEnabled: true,
    cosmeticId: null,
  },
  {
    themeId: 'gold_lane_glow',
    category: 'lane_effect',
    displayName: 'Gold Lane Glow',
    rarity: 'rare',
    assetVersion: 1,
    requiredAssets: ['gold_lane_overlay_asset'],
    fallbackThemeId: 'classic_lane_effect',
    isEnabled: true,
    cosmeticId: 'gold_lane_glow',
  },

  // board_effect (no ownable cosmetic — never directly equipped. Version
  // 1.2B derives this slot from whether the player's *other* equipped
  // slots form a coordinated Ember Blaze loadout; see
  // `resolvePlayerVisualTheme.ts`'s `resolveEmberFamilyEffectThemes`.)
  {
    themeId: 'classic_board_effect',
    category: 'board_effect',
    displayName: 'Classic Board Effects',
    rarity: 'common',
    assetVersion: 1,
    requiredAssets: ['classic_board_overlay_asset'],
    fallbackThemeId: 'classic_board_effect',
    isEnabled: true,
    cosmeticId: null,
  },
  {
    themeId: 'ember_board_effect',
    category: 'board_effect',
    displayName: 'Ember Blaze Board Effects',
    rarity: 'epic',
    assetVersion: 1,
    requiredAssets: ['ember_board_overlay_asset'],
    fallbackThemeId: 'classic_board_effect',
    isEnabled: true,
    cosmeticId: null,
  },

  // victory_effect (same non-ownable, coordinated-loadout-derived rule).
  {
    themeId: 'classic_victory_effect',
    category: 'victory_effect',
    displayName: 'Classic Victory',
    rarity: 'common',
    assetVersion: 1,
    requiredAssets: ['classic_victory_overlay_asset'],
    fallbackThemeId: 'classic_victory_effect',
    isEnabled: true,
    cosmeticId: null,
  },
  {
    themeId: 'ember_victory_effect',
    category: 'victory_effect',
    displayName: 'Ember Blaze Victory',
    rarity: 'epic',
    assetVersion: 1,
    requiredAssets: ['ember_victory_overlay_asset'],
    fallbackThemeId: 'classic_victory_effect',
    isEnabled: true,
    cosmeticId: null,
  },

  // profile_frame
  {
    themeId: 'default_profile_frame',
    category: 'profile_frame',
    displayName: 'Default Frame',
    rarity: 'common',
    assetVersion: 1,
    requiredAssets: ['classic_profile_frame_asset'],
    fallbackThemeId: 'default_profile_frame',
    isEnabled: true,
    cosmeticId: 'default_profile_frame',
  },
  {
    themeId: 'flame_profile_frame',
    category: 'profile_frame',
    displayName: 'Flame Profile Frame',
    rarity: 'epic',
    assetVersion: 1,
    requiredAssets: ['flame_profile_frame_asset'],
    fallbackThemeId: 'default_profile_frame',
    isEnabled: true,
    cosmeticId: 'flame_profile_frame',
  },

  // player_title
  {
    themeId: 'no_title',
    category: 'player_title',
    displayName: 'No Title',
    rarity: 'common',
    assetVersion: 1,
    requiredAssets: [],
    fallbackThemeId: 'no_title',
    isEnabled: true,
    cosmeticId: 'no_title',
  },
  {
    themeId: 'seven_day_blaze_title',
    category: 'player_title',
    displayName: 'Seven Day Blaze',
    rarity: 'legendary',
    assetVersion: 1,
    requiredAssets: [],
    fallbackThemeId: 'no_title',
    isEnabled: true,
    cosmeticId: 'seven_day_blaze_title',
  },
];

export function getThemeDefinitionsByCategory(category: ThemeCategory): ThemeDefinition[] {
  return REGISTRY.filter((entry) => entry.category === category);
}

export function findThemeDefinition(
  category: ThemeCategory,
  themeId: string | null | undefined,
): ThemeDefinition | undefined {
  if (!themeId) {
    return undefined;
  }
  return REGISTRY.find((entry) => entry.category === category && entry.themeId === themeId);
}

export function getClassicDefinition(category: ThemeCategory): ThemeDefinition {
  const classic = REGISTRY.find(
    (entry) => entry.category === category && entry.fallbackThemeId === entry.themeId,
  );
  if (!classic) {
    throw new Error(`No classic (self-fallback) theme definition registered for ${category}`);
  }
  return classic;
}

/**
 * Resolves `themeId` within `category`, walking the fallback chain when
 * the requested theme is missing, disabled, or not found — never throws,
 * never returns undefined. Bounded to avoid an infinite loop on a
 * corrupt/cyclic registry entry (defensive; the static registry above is
 * always acyclic).
 */
export function resolveThemeDefinition(
  category: ThemeCategory,
  themeId: string | null | undefined,
): ThemeDefinition {
  const classic = getClassicDefinition(category);
  let candidateId = themeId ?? classic.themeId;
  const visited = new Set<string>();

  for (let hops = 0; hops < THEME_FALLBACK_MAX_HOPS; hops += 1) {
    if (visited.has(candidateId)) {
      break;
    }
    visited.add(candidateId);

    const candidate = findThemeDefinition(category, candidateId);
    if (candidate && candidate.isEnabled) {
      return candidate;
    }
    if (!candidate) {
      break;
    }
    candidateId = candidate.fallbackThemeId;
  }

  return classic;
}

const THEME_FALLBACK_MAX_HOPS = 8;

export function getAllThemeDefinitions(): readonly ThemeDefinition[] {
  return REGISTRY;
}

/**
 * Version 1.2B — maps a set of FAILED asset ids (from
 * `visualAssetLoader.getFailedAssetIds()`) onto the theme ids that
 * require any of them, so a real load failure can be fed into
 * `resolvePlayerVisualTheme({ unavailableThemeIds })` and actually fall
 * back to classic for that category — closing the gap where 1.2A wired
 * the parameter but nothing populated it from real load failures.
 */
export function findThemeIdsRequiringAnyAsset(failedAssetIds: ReadonlySet<string>): Set<string> {
  if (failedAssetIds.size === 0) {
    return new Set();
  }
  const themeIds = new Set<string>();
  for (const def of REGISTRY) {
    if (def.requiredAssets.some((assetId) => failedAssetIds.has(assetId))) {
      themeIds.add(def.themeId);
    }
  }
  return themeIds;
}
