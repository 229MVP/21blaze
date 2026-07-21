import AsyncStorage from '@react-native-async-storage/async-storage';

const HIGH_SCORE_KEY = '@21blaze/highScore';

function normalizeScore(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }

  return Math.floor(parsed);
}

export async function loadHighScore(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(HIGH_SCORE_KEY);

    if (raw === null) {
      return 0;
    }

    return normalizeScore(raw);
  } catch {
    return 0;
  }
}

export async function saveHighScore(score: number): Promise<void> {
  try {
    const normalized = normalizeScore(score);
    await AsyncStorage.setItem(HIGH_SCORE_KEY, String(normalized));
  } catch {
    // Ignore persistence failures so gameplay can continue.
  }
}

export async function clearHighScore(): Promise<void> {
  try {
    await AsyncStorage.setItem(HIGH_SCORE_KEY, '0');
  } catch {
    // Ignore persistence failures.
  }
}
