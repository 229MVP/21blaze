import { supabase } from '../lib/supabase';
import type {
  EquippedCosmetics,
  WalletSnapshot,
  WalletTransaction,
} from '../monetization/types';

const TIMEOUT_MS = 10000;

class MonetizationServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MonetizationServiceError';
  }
}

function withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new MonetizationServiceError(`${label} timed out.`));
    }, TIMEOUT_MS);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error: unknown) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

async function invoke<T extends Record<string, unknown>>(
  name: string,
  body: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await withTimeout(
    supabase.functions.invoke(name, { body }),
    name,
  );
  if (error) {
    throw new MonetizationServiceError(error.message || `${name} failed.`);
  }
  if (data && typeof data === 'object' && 'error' in data && !('ok' in data)) {
    const message = (data as { error?: unknown }).error;
    throw new MonetizationServiceError(
      typeof message === 'string' ? message : `${name} failed.`,
    );
  }
  return data as T;
}

export async function fetchWallet(): Promise<WalletSnapshot | null> {
  const { data, error } = await supabase
    .from('player_wallets')
    .select('blaze_coins, lifetime_coins_earned, lifetime_coins_spent')
    .maybeSingle();
  if (error || !data) {
    return null;
  }
  return {
    balance: Number(data.blaze_coins),
    lifetimeEarned: Number(data.lifetime_coins_earned),
    lifetimeSpent: Number(data.lifetime_coins_spent),
  };
}

export async function fetchWalletTransactions(
  limit = 20,
): Promise<WalletTransaction[]> {
  const { data, error } = await supabase
    .from('wallet_transactions')
    .select('id, transaction_type, amount, balance_after, source_key, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error || !data) {
    return [];
  }
  return data.map((row) => ({
    id: String(row.id),
    transactionType: row.transaction_type as WalletTransaction['transactionType'],
    amount: Number(row.amount),
    balanceAfter: Number(row.balance_after),
    sourceKey: String(row.source_key),
    createdAt: String(row.created_at),
  }));
}

export async function claimSoloMatchCoins(input: {
  matchId: string;
  score: number;
  gameOverReason: string;
}): Promise<{ balance: number; granted: number }> {
  return invoke('claim-match-coins', {
    matchId: input.matchId,
    score: input.score,
    gameOverReason: input.gameOverReason,
  });
}

export async function claimAdReward(input: {
  rewardType: string;
  clientRewardId: string;
  matchId?: string;
}): Promise<{ balance: number; granted: number }> {
  return invoke('claim-ad-reward', input);
}

export type V1_1MatchRewardResult = {
  ok: boolean;
  alreadyProcessed: boolean;
  matchCoins: number;
  firstMatchBonusCoins: number;
  activeTimeCoins: number;
  activeTimeSeconds: number;
  xpGranted: number;
  totalCoins: number;
  balance: number;
};

/**
 * Version 1.1A — single secure Solo match reward call. The server computes
 * and verifies every amount; the client sends only the matchId.
 */
export async function claimV1_1MatchReward(
  matchId: string,
): Promise<V1_1MatchRewardResult> {
  return invoke('claim-match-rewards', { matchId });
}

export async function purchaseCosmeticWithCoins(
  cosmeticKey: string,
): Promise<{ balance: number; cosmeticKey: string; alreadyOwned: boolean }> {
  const data = await invoke<{
    balance: number;
    cosmeticId: string;
    alreadyOwned?: boolean;
  }>('purchase-cosmetic', { cosmeticId: cosmeticKey });
  return {
    balance: data.balance,
    cosmeticKey: data.cosmeticId,
    alreadyOwned: Boolean(data.alreadyOwned),
  };
}

/** Version 1.1B equip slots — see src/cosmetics/lockerCatalog.ts. */
export type EquipSlot =
  | 'cardFaceId'
  | 'cardBackId'
  | 'arenaId'
  | 'profileFrameId'
  | 'playerTitleId'
  | 'laneEffectId';

export type FullLoadout = {
  cardFaceId: string;
  cardBackId: string;
  arenaId: string;
  profileFrameId: string;
  playerTitleId: string | null;
  laneEffectId: string | null;
};

export async function equipCosmeticRemote(
  cosmeticKey: string,
  slot: EquipSlot,
): Promise<FullLoadout> {
  const data = await invoke<{
    equipped: {
      cardFaceId: string | null;
      cardBackId: string | null;
      arenaId: string | null;
      profileFrameId: string | null;
      playerTitleId: string | null;
      laneEffectId: string | null;
    };
  }>('equip-cosmetic', { cosmeticId: cosmeticKey, slot });
  return {
    cardFaceId: data.equipped.cardFaceId ?? 'classic_card_face',
    cardBackId: data.equipped.cardBackId ?? 'classic_card_back',
    arenaId: data.equipped.arenaId ?? 'classic_arena',
    profileFrameId: data.equipped.profileFrameId ?? 'default_profile_frame',
    playerTitleId: data.equipped.playerTitleId,
    laneEffectId: data.equipped.laneEffectId,
  };
}

export type CosmeticCatalogRow = {
  id: string;
  name: string;
  description: string;
  cosmeticType: string;
  rarity: string;
  unlockMethod: string;
  blazeCoinCost: number | null;
  sortOrder: number;
};

/** Version 1.1B — the real, server-driven catalog (never a hardcoded client list). */
export async function fetchCosmeticCatalog(): Promise<CosmeticCatalogRow[]> {
  const { data, error } = await supabase
    .from('cosmetic_catalog')
    .select(
      'id, name, description, cosmetic_type, rarity, unlock_method, blaze_coin_cost, sort_order, is_enabled',
    )
    .eq('is_enabled', true)
    .not('cosmetic_type', 'is', null)
    // Version 1.1B's Locker surfaces free/coin/streak cosmetics only.
    // Level-reward achievement cosmetics belong to the still-disabled
    // progression system (EXPO_PUBLIC_ENABLE_PROGRESSION_BETA) and are
    // intentionally out of scope for this milestone's catalog.
    .neq('unlock_method', 'level')
    .order('sort_order', { ascending: true });
  if (error || !data) {
    return [];
  }
  return data
    .filter((row) => row.unlock_method != null)
    .map((row) => ({
      id: String(row.id),
      name: String(row.name),
      description: String(row.description ?? ''),
      cosmeticType: String(row.cosmetic_type),
      rarity: String(row.rarity ?? 'common'),
      unlockMethod: String(row.unlock_method),
      blazeCoinCost: row.blaze_coin_cost == null ? null : Number(row.blaze_coin_cost),
      sortOrder: Number(row.sort_order ?? 0),
    }));
}

export async function syncEntitlementsRemote(
  activeEntitlementKeys: string[],
): Promise<void> {
  await invoke('sync-entitlements', { activeEntitlementKeys });
}

export async function fetchOwnedCosmetics(): Promise<string[]> {
  const { data, error } = await supabase
    .from('player_cosmetics')
    .select('cosmetic_key');
  if (error || !data) {
    return [];
  }
  return data.map((row) => String(row.cosmetic_key));
}

export async function fetchEquippedCosmetics(): Promise<EquippedCosmetics | null> {
  const { data, error } = await supabase
    .from('equipped_cosmetics')
    .select(
      'card_theme, arena, profile_frame, player_title, victory_effect, card_face, card_back, lane_effect',
    )
    .maybeSingle();
  if (error || !data) {
    return null;
  }
  return {
    cardTheme: String(data.card_theme),
    arena: String(data.arena),
    profileFrame: String(data.profile_frame),
    playerTitle: data.player_title ? String(data.player_title) : null,
    victoryEffect: data.victory_effect ? String(data.victory_effect) : null,
    cardFace: data.card_face ? String(data.card_face) : 'classic_card_face',
    cardBack: data.card_back ? String(data.card_back) : 'classic_card_back',
    laneEffect: data.lane_effect ? String(data.lane_effect) : null,
  };
}

export async function fetchServerEntitlements(): Promise<string[]> {
  const { data, error } = await supabase
    .from('player_entitlements')
    .select('entitlement_key')
    .is('revoked_at', null);
  if (error || !data) {
    return [];
  }
  return data.map((row) => String(row.entitlement_key));
}

export { MonetizationServiceError };
