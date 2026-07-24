import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

import { useSettingsStore } from '../../store/useSettingsStore';

const recent = new Map<string, number>();

function hapticsAllowed(): boolean {
  if (Platform.OS === 'web') {
    return false;
  }
  return useSettingsStore.getState().settings.hapticsEnabled;
}

function safe(fn: () => Promise<void>, dedupeKey?: string): void {
  if (!hapticsAllowed()) {
    return;
  }

  if (dedupeKey) {
    const last = recent.get(dedupeKey);
    const now = Date.now();
    if (last !== undefined && now - last < 80) {
      return;
    }
    recent.set(dedupeKey, now);
    if (recent.size > 100) {
      const first = recent.keys().next().value;
      if (first !== undefined) {
        recent.delete(first);
      }
    }
  }

  void fn().catch(() => undefined);
}

export const blazeHaptics = {
  buttonPressed(dedupeKey?: string): void {
    safe(() => Haptics.selectionAsync(), dedupeKey);
  },
  cardPlaced(dedupeKey?: string): void {
    safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light), dedupeKey);
  },
  laneSelected(dedupeKey?: string): void {
    safe(() => Haptics.selectionAsync(), dedupeKey);
  },
  laneCleared(dedupeKey?: string): void {
    safe(
      () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
      dedupeKey,
    );
  },
  bust(dedupeKey?: string): void {
    safe(
      () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
      dedupeKey,
    );
  },
  multiplierRaised(dedupeKey?: string): void {
    safe(
      () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),
      dedupeKey,
    );
  },
  countdownTick(dedupeKey?: string): void {
    safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light), dedupeKey);
  },
  countdownGo(dedupeKey?: string): void {
    safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), dedupeKey);
  },
  highScore(dedupeKey?: string): void {
    safe(
      () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
      dedupeKey,
    );
  },
  warning(dedupeKey?: string): void {
    safe(
      () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning),
      dedupeKey,
    );
  },
};
