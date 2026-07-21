import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

import { selectReducedMotionEnabled, useSettingsStore } from '../store/useSettingsStore';

/**
 * Combines the player preference with the OS reduce-motion setting.
 */
export function useReducedMotionSetting(): boolean {
  const preferenceEnabled = useSettingsStore(selectReducedMotionEnabled);
  const [systemEnabled, setSystemEnabled] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then(setSystemEnabled)
      .catch(() => undefined);

    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setSystemEnabled,
    );

    return () => {
      subscription.remove();
    };
  }, []);

  return preferenceEnabled || systemEnabled;
}
