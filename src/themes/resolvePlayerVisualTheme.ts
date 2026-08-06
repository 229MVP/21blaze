import { classicTheme } from './defaultTheme';
import { resolveThemeDefinition } from './themeRegistry';
import type { PlayerVisualLoadout, ThemeCategory, VisualTheme } from './types';

/**
 * Version 1.2A — resolves a player's equipped cosmetic ids into one
 * complete, stable, renderable `VisualTheme`. This is the ONLY function
 * production components should call to find out what to render — never
 * branch on a raw cosmetic id directly in a component.
 *
 * - Never trusts client ownership for anything server-authoritative
 *   (purchases/equips still go through the existing secure RPCs
 *   unchanged) — `ownedIds` here is the already-fetched, cached
 *   ownership snapshot, used for rendering safety only.
 * - Never crashes: any missing/disabled/unowned/unavailable category
 *   silently falls back to the classic definition for that category.
 * - Pure and side-effect free — callers are responsible for memoizing
 *   across renders (see `memoizedResolvePlayerVisualTheme` below).
 */
export function resolvePlayerVisualTheme(input: {
  loadout: PlayerVisualLoadout;
  ownedIds: ReadonlySet<string>;
  /** Cosmetic ids considered ownership-free (always resolvable). */
  freeIds: ReadonlySet<string>;
  /** Ids whose required assets are known to have failed to load — treated as unavailable. */
  unavailableThemeIds?: ReadonlySet<string>;
}): VisualTheme {
  try {
    const { loadout, ownedIds, freeIds } = input;
    const unavailable = input.unavailableThemeIds ?? new Set<string>();

    const resolveCategory = (category: ThemeCategory, equippedId: string | null): string => {
      if (!equippedId) {
        return classicIdFor(category);
      }
      const owned = freeIds.has(equippedId) || ownedIds.has(equippedId);
      if (!owned) {
        return classicIdFor(category);
      }
      if (unavailable.has(equippedId)) {
        return classicIdFor(category);
      }
      const resolved = resolveThemeDefinition(category, equippedId);
      return resolved.themeId;
    };

    const cardFaceTheme = resolveCategory('card_face', loadout.cardFaceId);
    const cardBackTheme = resolveCategory('card_back', loadout.cardBackId);
    const arenaTheme = resolveCategory('arena', loadout.arenaId);
    const laneTheme = resolveCategory('lane_effect', loadout.laneEffectId);
    const profileFrameTheme = resolveCategory('profile_frame', loadout.profileFrameId);
    const playerTitleTheme = resolveCategory('player_title', loadout.playerTitleId);
    // No ownable board/victory effect cosmetics exist yet (Version 1.2A
    // foundation) — always classic until a future milestone adds one.
    const boardEffectTheme = classicIdFor('board_effect');
    const victoryEffectTheme = classicIdFor('victory_effect');

    const requiredAssets = Array.from(
      new Set([
        ...assetsFor('card_face', cardFaceTheme),
        ...assetsFor('card_back', cardBackTheme),
        ...assetsFor('arena', arenaTheme),
        ...assetsFor('lane_effect', laneTheme),
        ...assetsFor('board_effect', boardEffectTheme),
        ...assetsFor('victory_effect', victoryEffectTheme),
        ...assetsFor('profile_frame', profileFrameTheme),
        ...assetsFor('player_title', playerTitleTheme),
      ]),
    );

    const isAllClassic =
      cardFaceTheme === classicTheme.cardFaceTheme &&
      cardBackTheme === classicTheme.cardBackTheme &&
      arenaTheme === classicTheme.arenaTheme &&
      laneTheme === classicTheme.laneTheme &&
      profileFrameTheme === classicTheme.profileFrameTheme &&
      playerTitleTheme === classicTheme.playerTitleTheme;

    return {
      themeId: isAllClassic ? 'classic' : 'custom',
      displayName: isAllClassic ? 'Classic' : 'Custom Loadout',
      rarity: 'common',
      cardFaceTheme,
      cardBackTheme,
      arenaTheme,
      laneTheme,
      boardEffectTheme,
      victoryEffectTheme,
      profileFrameTheme,
      playerTitleTheme,
      assetVersion: 1,
      requiredAssets,
      fallbackThemeId: isAllClassic ? null : 'classic',
      isEnabled: true,
    };
  } catch {
    // Absolute safety net — resolution must never crash the app.
    return classicTheme;
  }
}

function classicIdFor(category: ThemeCategory): string {
  switch (category) {
    case 'card_face':
      return classicTheme.cardFaceTheme;
    case 'card_back':
      return classicTheme.cardBackTheme;
    case 'arena':
      return classicTheme.arenaTheme;
    case 'lane_effect':
      return classicTheme.laneTheme;
    case 'board_effect':
      return classicTheme.boardEffectTheme;
    case 'victory_effect':
      return classicTheme.victoryEffectTheme;
    case 'profile_frame':
      return classicTheme.profileFrameTheme;
    case 'player_title':
      return classicTheme.playerTitleTheme;
    default:
      return classicTheme.cardFaceTheme;
  }
}

function assetsFor(category: ThemeCategory, themeId: string): readonly string[] {
  return resolveThemeDefinition(category, themeId).requiredAssets;
}

let lastKey: string | null = null;
let lastResult: VisualTheme = classicTheme;

/**
 * Memoized wrapper — avoids repeated resolution on every card render.
 * Callers (e.g. a Zustand selector hook) should call this rather than
 * `resolvePlayerVisualTheme` directly whenever the resolution runs on
 * every render pass.
 */
export function memoizedResolvePlayerVisualTheme(input: {
  loadout: PlayerVisualLoadout;
  ownedIds: ReadonlySet<string>;
  freeIds: ReadonlySet<string>;
  unavailableThemeIds?: ReadonlySet<string>;
}): VisualTheme {
  const key = JSON.stringify({
    loadout: input.loadout,
    owned: Array.from(input.ownedIds).sort(),
    unavailable: Array.from(input.unavailableThemeIds ?? []).sort(),
  });
  if (key === lastKey) {
    return lastResult;
  }
  lastKey = key;
  lastResult = resolvePlayerVisualTheme(input);
  return lastResult;
}

export function __resetVisualThemeMemoForTests(): void {
  lastKey = null;
  lastResult = classicTheme;
}
