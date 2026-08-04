import { getClassicDefinition } from './themeRegistry';
import type { VisualTheme } from './types';

/**
 * Version 1.2A — the universal fallback theme. Preserves every existing
 * working visual exactly as-is (current card faces/backs, current board,
 * current lanes, current backgrounds, current profile frame, current
 * Reduced Motion behavior) — this is what every category resolves to
 * when a requested theme is missing, disabled, fails to load, or is
 * unavailable on the current platform.
 */
export const classicTheme: VisualTheme = (() => {
  const cardFace = getClassicDefinition('card_face');
  const cardBack = getClassicDefinition('card_back');
  const arena = getClassicDefinition('arena');
  const lane = getClassicDefinition('lane_effect');
  const boardEffect = getClassicDefinition('board_effect');
  const victoryEffect = getClassicDefinition('victory_effect');
  const profileFrame = getClassicDefinition('profile_frame');
  const playerTitle = getClassicDefinition('player_title');

  const requiredAssets = Array.from(
    new Set([
      ...cardFace.requiredAssets,
      ...cardBack.requiredAssets,
      ...arena.requiredAssets,
      ...lane.requiredAssets,
      ...boardEffect.requiredAssets,
      ...victoryEffect.requiredAssets,
      ...profileFrame.requiredAssets,
      ...playerTitle.requiredAssets,
    ]),
  );

  return {
    themeId: 'classic',
    displayName: 'Classic',
    rarity: 'common',
    cardFaceTheme: cardFace.themeId,
    cardBackTheme: cardBack.themeId,
    arenaTheme: arena.themeId,
    laneTheme: lane.themeId,
    boardEffectTheme: boardEffect.themeId,
    victoryEffectTheme: victoryEffect.themeId,
    profileFrameTheme: profileFrame.themeId,
    playerTitleTheme: playerTitle.themeId,
    assetVersion: 1,
    requiredAssets,
    fallbackThemeId: null,
    isEnabled: true,
  };
})();
