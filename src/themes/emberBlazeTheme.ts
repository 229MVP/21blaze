import { classicTheme } from './defaultTheme';
import { getClassicDefinition } from './themeRegistry';
import type { VisualTheme } from './types';

/**
 * Version 1.2B — the static "Ember Blaze Collection" preset shown in the
 * Locker's coordinated-collection preview and the developer
 * ThemePreviewScreen's Ember/Classic comparison. This is DISPLAY-ONLY:
 *
 *  - It is never what `resolvePlayerVisualTheme()` returns for a real
 *    player loadout (that always derives from the player's own equipped,
 *    owned cosmetics per slot — see `resolveEmberFamilyEffectThemes` in
 *    `resolvePlayerVisualTheme.ts`).
 *  - It never grants ownership, never bypasses the unlock economy, and
 *    is never rendered with a purchase affordance.
 *  - `cardFaceTheme` intentionally stays `classic_card_face`: no ember
 *    card-face cosmetic exists yet (see
 *    docs/V1_2B_MISSING_ASSET_REPORT.md) — this preset never claims a
 *    piece exists when it does not.
 */
export const emberBlazeTheme: VisualTheme = (() => {
  const cardFace = getClassicDefinition('card_face'); // no ember card-face cosmetic exists yet
  const requiredAssets = Array.from(
    new Set([
      ...cardFace.requiredAssets,
      'ember_card_back_asset',
      'lava_arena_tint_asset',
      'gold_lane_overlay_asset',
      'flame_profile_frame_asset',
      'ember_board_overlay_asset',
      'ember_victory_overlay_asset',
    ]),
  );

  return {
    themeId: 'ember_blaze',
    displayName: 'Ember Blaze Collection',
    rarity: 'epic',
    cardFaceTheme: cardFace.themeId,
    cardBackTheme: 'ember_card_back',
    arenaTheme: 'lava_arena_tint',
    laneTheme: 'gold_lane_glow',
    boardEffectTheme: 'ember_board_effect',
    victoryEffectTheme: 'ember_victory_effect',
    profileFrameTheme: 'flame_profile_frame',
    playerTitleTheme: 'seven_day_blaze_title',
    assetVersion: 1,
    requiredAssets,
    fallbackThemeId: classicTheme.themeId,
    isEnabled: true,
  };
})();

/** The four earnable pieces (plus the streak title) that make up the
 * collection, in display order — used by the Locker preview and dev
 * comparison grid so both stay in sync with this single list. */
export const EMBER_COLLECTION_PIECES: readonly {
  cosmeticId: string;
  cosmeticType: 'card_back' | 'lane_effect' | 'arena' | 'profile_frame' | 'player_title';
}[] = [
  { cosmeticId: 'ember_card_back', cosmeticType: 'card_back' },
  { cosmeticId: 'gold_lane_glow', cosmeticType: 'lane_effect' },
  { cosmeticId: 'lava_arena_tint', cosmeticType: 'arena' },
  { cosmeticId: 'flame_profile_frame', cosmeticType: 'profile_frame' },
  { cosmeticId: 'seven_day_blaze_title', cosmeticType: 'player_title' },
];
