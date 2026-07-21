import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  DEFAULT_GAME_SETTINGS,
  type CardStyle,
  type GameSettings,
} from '../settings/types';

const SETTINGS_KEY = '@21blaze/settings';

const CARD_STYLES: readonly CardStyle[] = ['classic', 'blaze', 'midnight'];

function asBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function asCardStyle(value: unknown, fallback: CardStyle): CardStyle {
  if (typeof value === 'string' && CARD_STYLES.includes(value as CardStyle)) {
    return value as CardStyle;
  }

  return fallback;
}

function mergeSettings(raw: unknown): GameSettings {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_GAME_SETTINGS };
  }

  const source = raw as Partial<Record<keyof GameSettings, unknown>>;

  return {
    soundEffectsEnabled: asBoolean(
      source.soundEffectsEnabled,
      DEFAULT_GAME_SETTINGS.soundEffectsEnabled,
    ),
    musicEnabled: asBoolean(source.musicEnabled, DEFAULT_GAME_SETTINGS.musicEnabled),
    hapticsEnabled: asBoolean(
      source.hapticsEnabled,
      DEFAULT_GAME_SETTINGS.hapticsEnabled,
    ),
    tutorialHintsEnabled: asBoolean(
      source.tutorialHintsEnabled,
      DEFAULT_GAME_SETTINGS.tutorialHintsEnabled,
    ),
    reducedMotionEnabled: asBoolean(
      source.reducedMotionEnabled,
      DEFAULT_GAME_SETTINGS.reducedMotionEnabled,
    ),
    cardStyle: asCardStyle(source.cardStyle, DEFAULT_GAME_SETTINGS.cardStyle),
  };
}

export async function loadSettings(): Promise<GameSettings> {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);

    if (raw === null) {
      return { ...DEFAULT_GAME_SETTINGS };
    }

    return mergeSettings(JSON.parse(raw) as unknown);
  } catch {
    return { ...DEFAULT_GAME_SETTINGS };
  }
}

export async function saveSettings(settings: GameSettings): Promise<void> {
  try {
    const normalized = mergeSettings(settings);
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(normalized));
  } catch {
    // Ignore persistence failures so the UI can continue.
  }
}

export async function clearSettings(): Promise<void> {
  try {
    await AsyncStorage.removeItem(SETTINGS_KEY);
  } catch {
    // Ignore persistence failures.
  }
}
