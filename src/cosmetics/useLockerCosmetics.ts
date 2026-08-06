import { useEffect, useMemo, useRef } from 'react';

import type { CardBackVariant } from '../components/cards/CardBack';
import type { CardFaceVariant } from '../components/cards/PlayingCard';
import { isDailyRewardsEnabled, isV1_1LockerEnabled } from '../config/featureFlags';
import { trackEvent } from '../monetization/analytics';
import { memoizedResolvePlayerVisualTheme } from '../themes/resolvePlayerVisualTheme';
import type { PlayerVisualLoadout, VisualTheme } from '../themes/types';
import { FREE_DEFAULT_COSMETIC_IDS } from './lockerCatalog';
import { preloadThemeAssets } from '../services/visualAssetLoader';
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

/** The single resolved theme for the player's current equipped loadout. */
export function useResolvedVisualTheme(): VisualTheme {
  const equipped = useCosmeticStore((state) => state.equippedCosmetics);
  const owned = useCosmeticStore((state) => state.ownedCosmetics);

  return useMemo(() => {
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
    });
  }, [equipped, owned]);
}

/**
 * Preloads only the equipped theme's required assets (never every future
 * theme) — safe to call from any always-mounted screen (e.g. Home);
 * never blocks rendering since it fires-and-forgets.
 */
export function usePreloadEquippedVisualTheme(): void {
  const theme = useResolvedVisualTheme();
  useEffect(() => {
    void preloadThemeAssets(theme.requiredAssets);
  }, [theme.requiredAssets]);
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
