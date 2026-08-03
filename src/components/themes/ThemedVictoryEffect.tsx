import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { isVictoryEffectsEnabled } from '../../config/featureFlags';
import { useReducedMotionSetting } from '../../hooks/useReducedMotionSetting';
import { resolveThemeDefinition } from '../../themes/themeRegistry';

export type VictoryTrigger = 'standardWin' | 'newHighScore' | null;

type Props = {
  trigger: VictoryTrigger;
  /** A `ThemeDefinition.themeId` in the `victory_effect` category. */
  themeId: string;
};

const EMBER_COUNT = 6;
const SWEEP_DURATION_MS = 520;

/**
 * Version 1.2A — short, skippable victory celebration overlay.
 * `pointerEvents="none"` throughout (never blocks the Results screen's
 * own buttons), auto-completes well under a second, and never claims a
 * gameplay achievement that didn't happen (`trigger` is supplied by the
 * caller from the real, already-computed win/high-score state — this
 * component never invents one). Renders nothing unless
 * `EXPO_PUBLIC_ENABLE_VICTORY_EFFECTS` is on and `trigger` is set.
 */
export function ThemedVictoryEffect({ trigger, themeId }: Props) {
  const reduceMotion = useReducedMotionSetting();
  const definition = resolveThemeDefinition('victory_effect', themeId);
  void definition; // reserved for 1.2B theme-specific overlay art

  const glow = useSharedValue(0);
  const sweepX = useSharedValue(-1);

  useEffect(() => {
    if (!isVictoryEffectsEnabled() || !trigger) {
      glow.value = 0;
      sweepX.value = -1;
      return;
    }
    if (reduceMotion) {
      // Reduced Motion alternative: a single, brief, non-moving glow.
      glow.value = withSequence(withTiming(1, { duration: 160 }), withTiming(0, { duration: 260 }));
      return;
    }
    glow.value = withSequence(
      withTiming(1, { duration: 160 }),
      withTiming(0, { duration: SWEEP_DURATION_MS - 160 }),
    );
    sweepX.value = withTiming(1, { duration: SWEEP_DURATION_MS, easing: Easing.out(Easing.cubic) });
  }, [trigger, reduceMotion, glow, sweepX]);

  const glowStyle = useAnimatedStyle(() => ({ opacity: glow.value * (trigger === 'newHighScore' ? 0.5 : 0.32) }));
  const sweepStyle = useAnimatedStyle(() => ({
    opacity: glow.value,
    transform: [{ translateX: sweepX.value * 220 - 110 }],
  }));

  if (!isVictoryEffectsEnabled() || !trigger) {
    return null;
  }

  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={StyleSheet.absoluteFill}
    >
      <Animated.View style={[StyleSheet.absoluteFill, styles.glow, glowStyle]} />
      {!reduceMotion ? <Animated.View style={[styles.sweep, sweepStyle]} /> : null}
      {!reduceMotion && trigger === 'newHighScore'
        ? Array.from({ length: EMBER_COUNT }).map((_, index) => (
            <EmberBurstDot key={index} index={index} />
          ))
        : null}
    </View>
  );
}

function EmberBurstDot({ index }: { index: number }) {
  const rise = useSharedValue(0);

  useEffect(() => {
    rise.value = withTiming(1, { duration: SWEEP_DURATION_MS + index * 30, easing: Easing.out(Easing.quad) });
  }, [index, rise]);

  const style = useAnimatedStyle(() => ({
    opacity: 1 - rise.value,
    transform: [{ translateY: -rise.value * 60 }],
  }));

  const leftPercent = 12 + index * 14;

  return (
    <Animated.View
      style={[
        styles.ember,
        { left: `${leftPercent}%` as `${number}%` },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  glow: {
    backgroundColor: '#FF6500',
  },
  sweep: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 90,
    backgroundColor: 'rgba(255,182,41,0.25)',
  },
  ember: {
    position: 'absolute',
    bottom: '30%',
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#FFB629',
  },
});
