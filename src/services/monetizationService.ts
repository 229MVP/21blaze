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

export async function purchaseCosmeticWithCoins(
  cosmeticKey: string,
): Promise<{ balance: number; cosmeticKey: string }> {
  return invoke('purchase-cosmetic', { cosmeticKey });
}

export async function equipCosmeticRemote(
  cosmeticKey: string,
  category: string,
): Promise<EquippedCosmetics> {
  const data = await invoke<{
    equipped: {
      card_theme: string;
      arena: string;
      profile_frame: string;
      player_title: string | null;
      victory_effect: string | null;
    };
  }>('equip-cosmetic', { cosmeticKey, category });
  return {
    cardTheme: data.equipped.card_theme,
    arena: data.equipped.arena,
    profileFrame: data.equipped.profile_frame,
    playerTitle: data.equipped.player_title,
    victoryEffect: data.equipped.victory_effect,
  };
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
    .select('card_theme, arena, profile_frame, player_title, victory_effect')
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
