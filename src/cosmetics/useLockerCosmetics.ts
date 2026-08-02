import type { CardBackVariant } from '../components/cards/CardBack';
import type { CardFaceVariant } from '../components/cards/PlayingCard';
import { isDailyRewardsEnabled, isV1_1LockerEnabled } from '../config/featureFlags';
import { useCosmeticStore } from '../store/useCosmeticStore';
import { useProgressionStore } from '../store/useProgressionStore';
import { useWalletStore } from '../store/useWalletStore';

/**
 * Version 1.1B "Blaze Locker" — small, focused selector hooks that map the
 * equipped cosmetic ids onto the lightweight, code-driven visual variants
 * consumed by the existing production card / lane / arena components.
 *
 * Every hook returns the Version 1.0 default when the Locker feature flag
 * is off, so disabling the flag fully restores prior behavior regardless
 * of whatever is stored server-side.
 */

export function useActiveCardFaceVariant(): CardFaceVariant {
  const cardFace = useCosmeticStore((state) => state.equippedCosmetics.cardFace);
  if (isV1_1LockerEnabled() && cardFace === 'midnight_card_style') {
    return 'midnight';
  }
  return 'classic';
}

export function useActiveCardBackVariant(): CardBackVariant {
  const cardBack = useCosmeticStore((state) => state.equippedCosmetics.cardBack);
  if (isV1_1LockerEnabled() && cardBack === 'ember_card_back') {
    return 'ember';
  }
  return 'classic';
}

export function useActiveLaneEffect(): 'gold_lane_glow' | null {
  const laneEffect = useCosmeticStore((state) => state.equippedCosmetics.laneEffect);
  if (isV1_1LockerEnabled() && laneEffect === 'gold_lane_glow') {
    return 'gold_lane_glow';
  }
  return null;
}

export function useIsLavaArenaTintActive(): boolean {
  const arena = useCosmeticStore((state) => state.equippedCosmetics.arena);
  return isV1_1LockerEnabled() && arena === 'lava_arena_tint';
}

export function useActiveProfileFrame(): 'flame' | 'default' {
  const profileFrame = useCosmeticStore((state) => state.equippedCosmetics.profileFrame);
  if (isV1_1LockerEnabled() && profileFrame === 'flame_profile_frame') {
    return 'flame';
  }
  return 'default';
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
