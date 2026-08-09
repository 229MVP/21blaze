import AsyncStorage from '@react-native-async-storage/async-storage';

import type { DailyChallengeSession } from '../game/challenge/types';

const SESSION_KEY = '@21blaze/dailyChallengeActiveSession';

export async function loadPersistedDailyChallengeSession(): Promise<DailyChallengeSession | null> {
  try {
    const raw = await AsyncStorage.getItem(SESSION_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as DailyChallengeSession;
    if (
      parsed &&
      typeof parsed.attemptId === 'string' &&
      typeof parsed.authoritativeSeed === 'string' &&
      parsed.attemptType === 'ranked'
    ) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export async function savePersistedDailyChallengeSession(
  session: DailyChallengeSession,
): Promise<void> {
  if (session.attemptType !== 'ranked') {
    return;
  }
  await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session)).catch(() => undefined);
}

export async function clearPersistedDailyChallengeSession(): Promise<void> {
  await AsyncStorage.removeItem(SESSION_KEY).catch(() => undefined);
}
