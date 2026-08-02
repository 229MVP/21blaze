/**
 * Version 1.1B "Blaze Locker" — pure, client-side mirror of the
 * server-authoritative `cosmetic_catalog` rows introduced for this
 * milestone (see `supabase/migrations/0009_v1_1b_blaze_locker.sql`).
 *
 * This module is intentionally free of React Native imports so it can be
 * unit tested with `tsx` (see `src/monetization/v1_1bLockerSelfTest.ts`).
 * It never trusts a client-held price as authoritative — costs shown here
 * are for optimistic UI copy only; the server always re-derives and
 * enforces the real price inside `purchase_cosmetic`.
 */

export type LockerCosmeticType =
  | 'card_face'
  | 'card_back'
  | 'arena'
  | 'profile_frame'
  | 'player_title'
  | 'lane_effect';

export type LockerUnlockMethod = 'free' | 'blaze_coins' | 'streak' | 'level';

export type LockerRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

export type LockerEquipSlot =
  | 'cardFaceId'
  | 'cardBackId'
  | 'arenaId'
  | 'profileFrameId'
  | 'playerTitleId'
  | 'laneEffectId';

export type LockerCatalogEntry = {
  id: string;
  name: string;
  description: string;
  cosmeticType: LockerCosmeticType;
  rarity: LockerRarity;
  unlockMethod: LockerUnlockMethod;
  blazeCoinCost: number | null;
  sortOrder: number;
};

/** Cosmetic type → the equipment slot key used by `equip_cosmetic`. */
export const SLOT_FOR_COSMETIC_TYPE: Record<LockerCosmeticType, LockerEquipSlot> = {
  card_face: 'cardFaceId',
  card_back: 'cardBackId',
  arena: 'arenaId',
  profile_frame: 'profileFrameId',
  player_title: 'playerTitleId',
  lane_effect: 'laneEffectId',
};

/** Legacy category strings (pre-1.1B) mapped onto the new equip slots, so
 * existing call sites (e.g. `BlazeStoreScreen`) keep working unchanged. */
export const SLOT_FOR_LEGACY_CATEGORY: Record<string, LockerEquipSlot | undefined> = {
  card_theme: 'cardFaceId',
  card_face: 'cardFaceId',
  card_back: 'cardBackId',
  arena: 'arenaId',
  profile_frame: 'profileFrameId',
  title: 'playerTitleId',
  player_title: 'playerTitleId',
  lane_effect: 'laneEffectId',
};

/** The five free defaults every player owns without any unlock action. */
export const FREE_DEFAULT_COSMETIC_IDS: readonly string[] = [
  'classic_card_face',
  'classic_card_back',
  'classic_arena',
  'default_profile_frame',
  'no_title',
];

/**
 * Client-side mirror of the Version 1.1B rows. Must stay in sync with the
 * seed values in `supabase/migrations/0009_v1_1b_blaze_locker.sql`.
 */
export const V1_1B_LOCKER_CATALOG: readonly LockerCatalogEntry[] = [
  {
    id: 'classic_card_face',
    name: 'Classic Card Face',
    description: 'The original 21 Blaze card face.',
    cosmeticType: 'card_face',
    rarity: 'common',
    unlockMethod: 'free',
    blazeCoinCost: null,
    sortOrder: 0,
  },
  {
    id: 'classic_card_back',
    name: 'Classic Card Back',
    description: 'The original 21 Blaze card back.',
    cosmeticType: 'card_back',
    rarity: 'common',
    unlockMethod: 'free',
    blazeCoinCost: null,
    sortOrder: 0,
  },
  {
    id: 'classic_arena',
    name: 'Classic Arena',
    description: 'Standard inferno backdrop.',
    cosmeticType: 'arena',
    rarity: 'common',
    unlockMethod: 'free',
    blazeCoinCost: null,
    sortOrder: 0,
  },
  {
    id: 'default_profile_frame',
    name: 'Default Frame',
    description: 'Simple profile frame.',
    cosmeticType: 'profile_frame',
    rarity: 'common',
    unlockMethod: 'free',
    blazeCoinCost: null,
    sortOrder: 0,
  },
  {
    id: 'no_title',
    name: 'No Title',
    description: 'No player title displayed.',
    cosmeticType: 'player_title',
    rarity: 'common',
    unlockMethod: 'free',
    blazeCoinCost: null,
    sortOrder: 0,
  },
  {
    id: 'ember_card_back',
    name: 'Ember Card Back',
    description:
      'Deep charcoal and ember-red gradient with a thin orange border and a centered flame mark.',
    cosmeticType: 'card_back',
    rarity: 'uncommon',
    unlockMethod: 'blaze_coins',
    blazeCoinCost: 150,
    sortOrder: 10,
  },
  {
    id: 'gold_lane_glow',
    name: 'Gold Lane Glow',
    description:
      'A controlled gold-orange lane border with a small pulse when a card is placed.',
    cosmeticType: 'lane_effect',
    rarity: 'rare',
    unlockMethod: 'blaze_coins',
    blazeCoinCost: 250,
    sortOrder: 20,
  },
  {
    id: 'midnight_card_style',
    name: 'Midnight Card Style',
    description:
      'Near-black card face with warm ivory ranks and bright, high-contrast suit colors.',
    cosmeticType: 'card_face',
    rarity: 'rare',
    unlockMethod: 'blaze_coins',
    blazeCoinCost: 350,
    sortOrder: 30,
  },
  {
    id: 'flame_profile_frame',
    name: 'Flame Profile Frame',
    description: 'Orange-to-gold profile frame with small flame accents at the top corners.',
    cosmeticType: 'profile_frame',
    rarity: 'epic',
    unlockMethod: 'blaze_coins',
    blazeCoinCost: 400,
    sortOrder: 40,
  },
  {
    id: 'lava_arena_tint',
    name: 'Lava Arena',
    description: 'Near-black background with a controlled lava glow near the bottom.',
    cosmeticType: 'arena',
    rarity: 'epic',
    unlockMethod: 'blaze_coins',
    blazeCoinCost: 500,
    sortOrder: 50,
  },
  {
    id: 'seven_day_blaze_title',
    name: 'Seven Day Blaze',
    description: 'Earned by completing a full seven-day daily reward streak.',
    cosmeticType: 'player_title',
    rarity: 'legendary',
    unlockMethod: 'streak',
    blazeCoinCost: null,
    sortOrder: 60,
  },
] as const;

export function getLockerCatalogEntry(id: string): LockerCatalogEntry | undefined {
  return V1_1B_LOCKER_CATALOG.find((entry) => entry.id === id);
}

export function isFreeDefaultCosmetic(id: string): boolean {
  return FREE_DEFAULT_COSMETIC_IDS.includes(id);
}

export type LockerTab = 'FEATURED' | 'CARDS' | 'ARENA' | 'PROFILE' | 'OWNED';

export function tabForCosmeticType(type: LockerCosmeticType): Exclude<LockerTab, 'FEATURED' | 'OWNED'> {
  if (type === 'card_face' || type === 'card_back' || type === 'lane_effect') {
    return 'CARDS';
  }
  if (type === 'arena') {
    return 'ARENA';
  }
  return 'PROFILE';
}

export type CosmeticButtonState =
  | { kind: 'equipped' }
  | { kind: 'equip' }
  | { kind: 'unlock'; cost: number }
  | { kind: 'needCoins'; missing: number }
  | { kind: 'streakLocked' }
  | { kind: 'levelLocked' };

/**
 * Pure decision for the Locker cosmetic card button. Never mutates state —
 * callers dispatch a purchase/equip request only in response to an
 * explicit tap, never merely from selecting or previewing an item.
 */
export function resolveCosmeticButtonState(input: {
  entry: Pick<LockerCatalogEntry, 'unlockMethod' | 'blazeCoinCost'>;
  owned: boolean;
  equipped: boolean;
  balance: number;
}): CosmeticButtonState {
  const { entry, owned, equipped, balance } = input;

  if (owned && equipped) {
    return { kind: 'equipped' };
  }
  if (owned) {
    return { kind: 'equip' };
  }
  if (entry.unlockMethod === 'streak') {
    return { kind: 'streakLocked' };
  }
  if (entry.unlockMethod === 'level') {
    return { kind: 'levelLocked' };
  }
  if (entry.unlockMethod === 'free') {
    return { kind: 'equip' };
  }
  const cost = entry.blazeCoinCost ?? 0;
  if (balance >= cost) {
    return { kind: 'unlock', cost };
  }
  return { kind: 'needCoins', missing: cost - balance };
}

export function cosmeticButtonLabel(state: CosmeticButtonState): string {
  switch (state.kind) {
    case 'equipped':
      return 'EQUIPPED';
    case 'equip':
      return 'EQUIP';
    case 'unlock':
      return `UNLOCK — ${state.cost.toLocaleString()} COINS`;
    case 'needCoins':
      return `NEED ${state.missing.toLocaleString()} MORE COINS`;
    case 'streakLocked':
      return 'COMPLETE A 7-DAY STREAK';
    case 'levelLocked':
      return 'LEVEL UP TO UNLOCK';
    default:
      return '';
  }
}

/** Whether tapping the resolved button state should ever send a purchase
 * request. Only 'unlock' does — selecting, previewing, or an insufficient
 * balance must never trigger a server call. */
export function buttonTriggersPurchase(state: CosmeticButtonState): boolean {
  return state.kind === 'unlock';
}

export function buttonTriggersEquip(state: CosmeticButtonState): boolean {
  return state.kind === 'equip';
}
