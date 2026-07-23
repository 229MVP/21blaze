import { create } from 'zustand';

import {
  DEFAULT_GAME_SETTINGS,
  type CardStyle,
  type GameSettings,
} from '../settings/types';
import {
  clearSettings,
  loadSettings,
  saveSettings,
} from '../storage/settingsStorage';

type SettingsStore = {
  settings: GameSettings;
  isHydrated: boolean;
  hydrateSettings: () => Promise<void>;
  setSoundEffectsEnabled: (value: boolean) => void;
  setMusicEnabled: (value: boolean) => void;
  setHapticsEnabled: (value: boolean) => void;
  setTutorialHintsEnabled: (value: boolean) => void;
  setReducedMotionEnabled: (value: boolean) => void;
  setCardStyle: (value: CardStyle) => void;
  resetSettings: () => Promise<void>;
};

let persistQueue: Promise<void> = Promise.resolve();
let isHydrating = false;

function enqueuePersist(settings: GameSettings): void {
  if (isHydrating) {
    return;
  }

  persistQueue = persistQueue
    .then(() => saveSettings(settings))
    .catch(() => undefined);
}

function patchSettings(
  set: (partial: Partial<SettingsStore>) => void,
  get: () => SettingsStore,
  patch: Partial<GameSettings>,
): void {
  const next = { ...get().settings, ...patch };
  set({ settings: next });
  enqueuePersist(next);
}

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  settings: { ...DEFAULT_GAME_SETTINGS },
  isHydrated: false,

  hydrateSettings: async () => {
    if (get().isHydrated || isHydrating) {
      return;
    }

    isHydrating = true;

    try {
      const loaded = await loadSettings();
      set({ settings: loaded, isHydrated: true });
    } finally {
      isHydrating = false;
    }
  },

  setSoundEffectsEnabled: (value) => {
    patchSettings(set, get, { soundEffectsEnabled: value });
  },

  setMusicEnabled: (value) => {
    patchSettings(set, get, { musicEnabled: value });
  },

  setHapticsEnabled: (value) => {
    patchSettings(set, get, { hapticsEnabled: value });
  },

  setTutorialHintsEnabled: (value) => {
    patchSettings(set, get, { tutorialHintsEnabled: value });
  },

  setReducedMotionEnabled: (value) => {
    patchSettings(set, get, { reducedMotionEnabled: value });
  },

  setCardStyle: (value) => {
    patchSettings(set, get, { cardStyle: value });
  },

  resetSettings: async () => {
    const defaults = { ...DEFAULT_GAME_SETTINGS };
    set({ settings: defaults, isHydrated: true });
    await clearSettings();
    await saveSettings(defaults);
  },
}));

export function selectCardStyle(state: SettingsStore): CardStyle {
  return state.settings.cardStyle;
}

export function selectReducedMotionEnabled(state: SettingsStore): boolean {
  return state.settings.reducedMotionEnabled;
}
