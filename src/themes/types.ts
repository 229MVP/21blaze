/**
 * Version 1.2A "Visual Theme System Foundation" — strongly typed theme
 * model. Pure types/data only; zero React Native imports so this file
 * (and everything that only depends on it) can be unit tested with `tsx`.
 *
 * IMPORTANT: themes are visual-only. Nothing in this file, or anything
 * that consumes it, may read or influence card values, card order,
 * score, multiplier math, timers, bust rules, matchmaking, rewards, XP,
 * or wallet values. See docs/V1_2A_THEME_ARCHITECTURE.md.
 */

export type ThemeCategory =
  | 'card_face'
  | 'card_back'
  | 'arena'
  | 'lane_effect'
  | 'board_effect'
  | 'victory_effect'
  | 'profile_frame'
  | 'player_title';

export type ThemeRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

/**
 * One registry row — a single equippable visual style scoped to exactly
 * one `ThemeCategory`. Most rows correspond 1:1 with a
 * `src/cosmetics/lockerCatalog.ts` cosmetic id (`cosmeticId` links them),
 * but `board_effect` / `victory_effect` rows may exist with no cosmetic
 * yet (nothing is ownable/purchasable there until a future milestone —
 * they always resolve to the classic definition today).
 */
export type ThemeDefinition = {
  themeId: string;
  category: ThemeCategory;
  displayName: string;
  rarity: ThemeRarity;
  /** Bumped whenever this theme's required assets change shape/content. */
  assetVersion: number;
  /** Ids into the asset manifest (`src/assets/manifest/visualAssetManifest.ts`). */
  requiredAssets: readonly string[];
  /** Always resolvable — every non-classic definition ultimately chains to a classic one. */
  fallbackThemeId: string;
  isEnabled: boolean;
  /** Links back to `src/cosmetics/lockerCatalog.ts`; null for cosmetic-free internal themes. */
  cosmeticId: string | null;
};

/**
 * The composite, fully-resolved theme for one player loadout — exactly
 * what `resolvePlayerVisualTheme()` returns. One stable object per
 * resolution; every field is a `ThemeDefinition.themeId` (except the
 * aggregate metadata fields), never a raw cosmetic id, so renderers never
 * need to know about cosmetics/ownership at all.
 */
export type VisualTheme = {
  themeId: string;
  displayName: string;
  rarity: ThemeRarity;
  cardFaceTheme: string;
  cardBackTheme: string;
  arenaTheme: string;
  laneTheme: string;
  boardEffectTheme: string;
  victoryEffectTheme: string;
  profileFrameTheme: string;
  playerTitleTheme: string;
  assetVersion: number;
  requiredAssets: readonly string[];
  fallbackThemeId: string | null;
  isEnabled: boolean;
};

/** The six independently-equippable slots, matching `LockerEquipSlot`. */
export type PlayerVisualLoadout = {
  cardFaceId: string;
  cardBackId: string;
  arenaId: string;
  laneEffectId: string | null;
  profileFrameId: string;
  playerTitleId: string | null;
};

export const THEME_CATEGORIES: readonly ThemeCategory[] = [
  'card_face',
  'card_back',
  'arena',
  'lane_effect',
  'board_effect',
  'victory_effect',
  'profile_frame',
  'player_title',
] as const;
