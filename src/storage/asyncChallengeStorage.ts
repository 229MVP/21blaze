import AsyncStorage from '@react-native-async-storage/async-storage';

import type { AsyncChallengeSummary } from '../async/types';

const CACHE_KEY = 'async_challenge_cache_v1';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export type CachedAsyncChallenges = {
  challenges: AsyncChallengeSummary[];
  serverTime: string;
  cachedAtMs: number;
};

export async function saveCachedAsyncChallenges(cache: CachedAsyncChallenges): Promise<void> {
  try {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Offline cache is best-effort.
  }
}

export async function loadCachedAsyncChallenges(): Promise<CachedAsyncChallenges | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as CachedAsyncChallenges;
    if (!parsed || !Array.isArray(parsed.challenges)) {
      return null;
    }
    if (Date.now() - parsed.cachedAtMs > CACHE_TTL_MS) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}
