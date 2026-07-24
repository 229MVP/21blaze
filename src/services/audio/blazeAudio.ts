import { createAudioPlayer, setAudioModeAsync, setIsAudioActiveAsync } from 'expo-audio';
import type { AudioPlayer } from 'expo-audio';
import type { AppStateStatus } from 'react-native';

import { useSettingsStore } from '../../store/useSettingsStore';
import {
  BLAZE_SOUND_KEYS,
  type BlazeSoundKey,
  soundManifest,
} from './soundManifest';

/** Sounds that should not stack overlapping copies. */
const SINGLE_INSTANCE_KEYS = new Set<BlazeSoundKey>([
  'finalSecondsWarning',
  'countdownTick',
  'countdownGo',
  'newHighScore',
  'laneClear',
  'bust',
  'multiplierIncrease',
]);

type PlayerSlot = {
  player: AudioPlayer;
  lastStartedAt: number;
};

let initialized = false;
let initializing: Promise<void> | null = null;
let enabled = true;
let appActive = true;
const players = new Map<BlazeSoundKey, PlayerSlot>();
const lastPlayedDedupe = new Map<string, number>();

function readEnabledFromSettings(): boolean {
  return useSettingsStore.getState().settings.soundEffectsEnabled;
}

function canPlay(): boolean {
  return initialized && enabled && appActive;
}

async function ensurePlayer(key: BlazeSoundKey): Promise<AudioPlayer | null> {
  const existing = players.get(key);
  if (existing) {
    return existing.player;
  }

  try {
    const player = createAudioPlayer(soundManifest[key], {
      updateInterval: 500,
      keepAudioSessionActive: false,
    });
    player.volume = 0.85;
    players.set(key, { player, lastStartedAt: 0 });
    return player;
  } catch {
    return null;
  }
}

async function configureMode(): Promise<void> {
  try {
    await setAudioModeAsync({
      playsInSilentMode: true,
      interruptionMode: 'mixWithOthers',
      shouldPlayInBackground: false,
      shouldRouteThroughEarpiece: false,
      allowsRecording: false,
    });
  } catch {
    // Unsupported platforms fail silently.
  }
}

export const blazeAudio = {
  async initialize(): Promise<void> {
    if (initialized) {
      enabled = readEnabledFromSettings();
      return;
    }
    if (initializing) {
      await initializing;
      return;
    }

    initializing = (async () => {
      enabled = readEnabledFromSettings();
      await configureMode();
      try {
        await setIsAudioActiveAsync(true);
      } catch {
        // ignore
      }

      // Soft preload — never block launch longer than a short window.
      const preloadWork = Promise.all(
        BLAZE_SOUND_KEYS.map(async (key) => {
          await ensurePlayer(key);
        }),
      );
      await Promise.race([
        preloadWork,
        new Promise<void>((resolve) => {
          setTimeout(resolve, 1500);
        }),
      ]);

      initialized = true;
    })();

    try {
      await initializing;
    } finally {
      initializing = null;
    }
  },

  async preload(): Promise<void> {
    await blazeAudio.initialize();
    await Promise.all(BLAZE_SOUND_KEYS.map((key) => ensurePlayer(key)));
  },

  setEnabled(next: boolean): void {
    enabled = next;
    if (!next) {
      blazeAudio.stopAll();
    }
  },

  /**
   * Play a short cue. Optional dedupeKey prevents the same logical event
   * from firing twice across rerenders.
   */
  play(soundKey: BlazeSoundKey, dedupeKey?: string): void {
    if (!canPlay()) {
      return;
    }

    if (dedupeKey) {
      const stamp = lastPlayedDedupe.get(dedupeKey);
      if (stamp !== undefined) {
        return;
      }
      lastPlayedDedupe.set(dedupeKey, Date.now());
      // Bound memory for long sessions.
      if (lastPlayedDedupe.size > 200) {
        const first = lastPlayedDedupe.keys().next().value;
        if (first !== undefined) {
          lastPlayedDedupe.delete(first);
        }
      }
    }

    void (async () => {
      try {
        const player = await ensurePlayer(soundKey);
        if (!player || !canPlay()) {
          return;
        }

        const slot = players.get(soundKey);
        if (!slot) {
          return;
        }

        if (SINGLE_INSTANCE_KEYS.has(soundKey) && player.playing) {
          // Restart from start instead of stacking.
          try {
            await player.seekTo(0);
          } catch {
            // ignore seek failures
          }
          player.play();
          slot.lastStartedAt = Date.now();
          return;
        }

        // Rapid card/button cues: restart if already near the end or idle.
        if (player.playing && Date.now() - slot.lastStartedAt < 40) {
          return;
        }

        try {
          await player.seekTo(0);
        } catch {
          // ignore
        }
        player.play();
        slot.lastStartedAt = Date.now();
      } catch {
        // Fail silently — gameplay must continue without audio.
      }
    })();
  },

  stop(soundKey: BlazeSoundKey): void {
    const slot = players.get(soundKey);
    if (!slot) {
      return;
    }
    try {
      slot.player.pause();
    } catch {
      // ignore
    }
  },

  stopAll(): void {
    for (const slot of players.values()) {
      try {
        slot.player.pause();
      } catch {
        // ignore
      }
    }
  },

  handleAppStateChange(nextState: AppStateStatus): void {
    const nextActive = nextState === 'active';
    if (!nextActive && appActive) {
      appActive = false;
      blazeAudio.stopAll();
      void setIsAudioActiveAsync(false).catch(() => undefined);
      return;
    }

    if (nextActive && !appActive) {
      appActive = true;
      void (async () => {
        try {
          await setIsAudioActiveAsync(true);
          await configureMode();
        } catch {
          // ignore
        }
      })();
    }
  },

  dispose(): void {
    blazeAudio.stopAll();
    for (const [key, slot] of players) {
      try {
        slot.player.remove();
      } catch {
        // ignore
      }
      players.delete(key);
    }
    lastPlayedDedupe.clear();
    initialized = false;
  },

  /** Test helper — clear dedupe without disposing players. */
  clearDedupe(): void {
    lastPlayedDedupe.clear();
  },
};
