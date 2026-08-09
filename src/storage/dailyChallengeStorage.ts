import AsyncStorage from '@react-native-async-storage/async-storage';

import type { DailyChallengeConfig } from '../game/challenge/types';

const CACHE_KEY = '@21blaze/dailyChallengeCache';

export type CachedDailyChallengeState = {
  challenge: DailyChallengeConfig;
  cachedAtMs: number;
};

export async function loadCachedDailyChallenge(): Promise<CachedDailyChallengeState | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as unknown;
    if (
      parsed &&
      typeof parsed === 'object' &&
      typeof (parsed as { challenge?: unknown }).challenge === 'object' &&
      typeof (parsed as { cachedAtMs?: unknown }).cachedAtMs === 'number'
    ) {
      return parsed as CachedDailyChallengeState;
    }
    return null;
  } catch {
    return null;
  }
}

export async function saveCachedDailyChallenge(
  state: CachedDailyChallengeState,
): Promise<void> {
  await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(state)).catch(() => undefined);
}

export async function clearCachedDailyChallenge(): Promise<void> {
  await AsyncStorage.removeItem(CACHE_KEY).catch(() => undefined);
}

export function isCachedChallengeValid(
  cached: CachedDailyChallengeState | null,
  nowMs: number,
): cached is CachedDailyChallengeState {
  if (!cached?.challenge?.challengeDate) {
    return false;
  }
  const today = new Date(nowMs).toISOString().slice(0, 10);
  return cached.challenge.challengeDate === today;
}
