import { useEffect, useMemo, useRef, useState } from 'react';

import type { CardBackVariant } from '../components/cards/CardBack';
import type { CardFaceVariant } from '../components/cards/PlayingCard';
import { isDailyRewardsEnabled, isStartupVisualPreloadDisabled, isV1_1LockerEnabled } from '../config/featureFlags';
import { trackEvent } from '../monetization/analytics';
import { classicTheme } from '../themes/defaultTheme';
import { memoizedResolvePlayerVisualTheme } from '../themes/resolvePlayerVisualTheme';
import type { PlayerVisualLoadout, VisualTheme } from '../themes/types';
import { isBasicStartupModeActive } from '../startup/basicStartupMode';
import { shouldForceClassicVisuals } from '../startup/visualStartupOverride';
import { FREE_DEFAULT_COSMETIC_IDS, V1_1B_LOCKER_CATALOG } from './lockerCatalog';
import {
  getAssetFailureVersion,
  getFailedAssetIds,
  preloadLaunchCriticalThemeAssets,
  preloadLazyVisualAssets,
  preloadThemeAssets,
  subscribeToAssetFailures,
} from '../services/visualAssetLoader';
import { findThemeIdsRequiringAnyAsset, resolveThemeDefinition } from '../themes/themeRegistry';
import type { ThemeCategory } from '../themes/types';
import { useCosmeticStore } from '../store/useCosmeticStore';
import { useProgressionStore } from '../store/useProgressionStore';
import { useWalletStore } from '../store/useWalletStore';

/**
 * Version 1.1B "Blaze Locker" (extended in Version 1.2A) — small, focused
 * selector hooks that map the equipped cosmetic ids onto the lightweight,
 * code-driven visual variants consumed by the existing production
 * card / lane / arena components.
 *
 * Every hook returns the Version 1.0 default when the Locker feature flag
 * is off, so disabling the flag fully restores prior behavior regardless
 * of whatever is stored server-side.
 *
 * Version 1.2A: these now derive from `resolvePlayerVisualTheme()`
 * (`src/themes/`) instead of ad-hoc `cosmeticId === '...'` string
 * comparisons, so a future professional-asset swap in 1.2B never
 * requires touching these call sites again. The public function
 * signatures and return values are unchanged.
 */

const FREE_ID_SET = new Set(FREE_DEFAULT_COSMETIC_IDS);

/**
 * The single resolved theme for the player's current equipped loadout.
 *
 * Version 1.2B: also subscribes to real asset-load failures
 * (`visualAssetLoader.subscribeToAssetFailures`) so a genuinely broken or
 * missing bundled asset causes an automatic re-resolution that falls
 * back to classic for just that category — closing the gap where the
 * 1.2A `unavailableThemeIds` parameter existed but was never populated
 * from live load results.
 */
export function useResolvedVisualTheme(): VisualTheme {
  const equipped = useCosmeticStore((state) => state.equippedCosmetics);
  const owned = useCosmeticStore((state) => state.ownedCosmetics);
  const [failureVersion, setFailureVersion] = useState(() => getAssetFailureVersion());
  const lastFallbackSignature = useRef<string | null>(null);

  useEffect(() => subscribeToAssetFailures(() => setFailureVersion(getAssetFailureVersion())), []);

  const theme = useMemo(() => {
    // Version 1.2.0 startup hotfix — a hard kill switch, checked first
    // and unconditionally: with the visual system disabled (the
    // TestFlight isolation flag) or the in-session "start with classic"
    // recovery override active, resolution never even attempts to read
    // equipped/owned cosmetic state or theme-registry data. Ownership is
    // untouched either way — this only changes what is rendered.
    if (shouldForceClassicVisuals()) {
      return classicTheme;
    }
    const unavailableThemeIds = findThemeIdsRequiringAnyAsset(new Set(getFailedAssetIds()));
    if (!isV1_1LockerEnabled()) {
      return memoizedResolvePlayerVisualTheme({
        loadout: {
          cardFaceId: 'classic_card_face',
          cardBackId: 'classic_card_back',
          arenaId: 'classic_arena',
          laneEffectId: null,
          profileFrameId: 'default_profile_frame',
          playerTitleId: null,
        },
        ownedIds: new Set(),
        freeIds: FREE_ID_SET,
        unavailableThemeIds,
      });
    }
    const loadout: PlayerVisualLoadout = {
      cardFaceId: equipped.cardFace,
      cardBackId: equipped.cardBack,
      arenaId: equipped.arena,
      laneEffectId: equipped.laneEffect,
      profileFrameId: equipped.profileFrame,
      playerTitleId: equipped.playerTitle,
    };
    return memoizedResolvePlayerVisualTheme({
      loadout,
      ownedIds: new Set(owned),
      freeIds: FREE_ID_SET,
      unavailableThemeIds,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [equipped, owned, failureVersion]);

  useEffect(() => {
    // Version 1.2C analytics: a category equipped to a non-classic id
    // that nonetheless resolved to its classic definition means
    // ownership/asset-availability forced a fallback (never fired for a
    // player who genuinely has Classic equipped by choice).
    const equippedByCategory: Array<[string, string | null, string]> = [
      ['card_face', equipped.cardFace, theme.cardFaceTheme],
      ['card_back', equipped.cardBack, theme.cardBackTheme],
      ['arena', equipped.arena, theme.arenaTheme],
      ['lane_effect', equipped.laneEffect, theme.laneTheme],
      ['profile_frame', equipped.profileFrame, theme.profileFrameTheme],
      ['player_title', equipped.playerTitle, theme.playerTitleTheme],
    ];
    const fallbacks = equippedByCategory.filter(
      ([, equippedId, resolvedId]) => equippedId != null && equippedId !== resolvedId,
    );
    if (fallbacks.length === 0) {
      lastFallbackSignature.current = null;
      return;
    }
    const signature = fallbacks.map(([category, equippedId]) => `${category}:${equippedId}`).join(',');
    if (signature === lastFallbackSignature.current) {
      return;
    }
    lastFallbackSignature.current = signature;
    for (const [category, equippedId, resolvedId] of fallbacks) {
      trackEvent('visual_fallback_used', { category, equippedId: equippedId ?? '', resolvedId });
    }
  }, [equipped, theme]);

  return theme;
}

/**
 * Version 1.2B — "launch" preload tier. Preloads only the critical/high
 * priority assets among the equipped theme's requirements (never every
 * future theme, and never the full set at this stage) — safe to call
 * from any always-mounted screen (e.g. Home); never blocks rendering
 * since it fires-and-forgets.
 */
export function usePreloadEquippedVisualTheme(): void {
  const theme = useResolvedVisualTheme();
  useEffect(() => {
    if (isStartupVisualPreloadDisabled() || isBasicStartupModeActive()) {
      return;
    }
    void preloadLaunchCriticalThemeAssets(theme.requiredAssets);
  }, [theme.requiredAssets]);
}

/**
 * Version 1.2B — "before gameplay" preload tier. Ensures every remaining
 * required asset for the equipped theme (including normal/low priority
 * ones the launch tier skipped) is loaded before the match starts
 * rendering effects. Ids the launch tier already preloaded are skipped
 * automatically by the loader's cache, so this never re-downloads
 * anything. Call once from the gameplay screen's mount.
 */
export function usePreloadGameplayCriticalVisualAssets(): void {
  const theme = useResolvedVisualTheme();
  useEffect(() => {
    void preloadThemeAssets(theme.requiredAssets);
  }, [theme.requiredAssets]);
}

/**
 * Version 1.2B — "lazy" preload tier for the Blaze Locker. Preloads the
 * required assets for every catalog entry's theme definition (owned or
 * not) only while the Locker screen itself is mounted, so unowned
 * preview art / alternate themes are never fetched at app launch or
 * during gameplay.
 */
export function usePreloadLockerPreviewAssets(): void {
  useEffect(() => {
    const ids = new Set<string>();
    for (const entry of V1_1B_LOCKER_CATALOG) {
      const category = entry.cosmeticType as ThemeCategory;
      const definition = resolveThemeDefinition(category, entry.id);
      for (const assetId of definition.requiredAssets) {
        ids.add(assetId);
      }
    }
    void preloadLazyVisualAssets(Array.from(ids));
  }, []);
}

export function useActiveCardFaceVariant(): CardFaceVariant {
  const theme = useResolvedVisualTheme();
  return theme.cardFaceTheme === 'midnight_card_style' ? 'midnight' : 'classic';
}

export function useActiveCardBackVariant(): CardBackVariant {
  const theme = useResolvedVisualTheme();
  return theme.cardBackTheme === 'ember_card_back' ? 'ember' : 'classic';
}

export function useActiveLaneEffect(): 'gold_lane_glow' | null {
  const theme = useResolvedVisualTheme();
  return theme.laneTheme === 'gold_lane_glow' ? 'gold_lane_glow' : null;
}

export function useIsLavaArenaTintActive(): boolean {
  const theme = useResolvedVisualTheme();
  return theme.arenaTheme === 'lava_arena_tint';
}

export function useActiveProfileFrame(): 'flame' | 'default' {
  const theme = useResolvedVisualTheme();
  return theme.profileFrameTheme === 'flame_profile_frame' ? 'flame' : 'default';
}

/**
 * Home navigation badge — true when there is a newly unlocked cosmetic to
 * acknowledge, a claimable 7-day streak title, or at least one locked
 * cosmetic the player can currently afford. Never derived from a stale or
 * fabricated balance — always the live wallet/catalog/ownership state.
 */
export function useLockerBadgeVisible(): boolean {
  const pendingUnlock = useCosmeticStore((state) => state.pendingUnlock);
  const catalog = useCosmeticStore((state) => state.catalog);
  const owned = useCosmeticStore((state) => state.ownedCosmetics);
  const balance = useWalletStore((state) => state.balance);
  const dailyRewardStatus = useProgressionStore((state) => state.dailyRewardStatus);

  if (!isV1_1LockerEnabled()) {
    return false;
  }
  if (pendingUnlock) {
    return true;
  }
  if (
    isDailyRewardsEnabled() &&
    dailyRewardStatus?.isAvailable &&
    dailyRewardStatus.nextStreakDay === 7 &&
    !owned.includes('seven_day_blaze_title')
  ) {
    return true;
  }
  return catalog.some(
    (entry) =>
      entry.unlockMethod === 'blaze_coins' &&
      entry.blazeCoinCost != null &&
      !owned.includes(entry.id) &&
      balance >= entry.blazeCoinCost,
  );
}

/**
 * Fires `locker_affordability_reached` exactly once per transition into
 * "can afford at least one locked cosmetic" (never repeatedly while it
 * stays true, and re-arms only after affordability drops and rises again).
 */
export function useTrackLockerAffordability(): void {
  const catalog = useCosmeticStore((state) => state.catalog);
  const owned = useCosmeticStore((state) => state.ownedCosmetics);
  const balance = useWalletStore((state) => state.balance);
  const wasAffordable = useRef(false);

  useEffect(() => {
    if (!isV1_1LockerEnabled()) {
      return;
    }
    const affordable = catalog.some(
      (entry) =>
        entry.unlockMethod === 'blaze_coins' &&
        entry.blazeCoinCost != null &&
        !owned.includes(entry.id) &&
        balance >= entry.blazeCoinCost,
    );
    if (affordable && !wasAffordable.current) {
      trackEvent('locker_affordability_reached');
    }
    wasAffordable.current = affordable;
  }, [catalog, owned, balance]);
}
