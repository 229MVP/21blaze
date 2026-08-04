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
/**
 * Version 1.2C — total on-screen duration per trigger, within the
 * recommended maximum ranges documented in
 * docs/V1_2C_EFFECT_TIMING_FINAL.md: standard match-complete targets
 * 700-1400ms, a new-high-score victory targets 1000-2000ms. Neither value
 * is awaited by any gameplay or reward-sync code path — the Results
 * screen's own buttons and reward reconciliation proceed immediately
 * regardless of this overlay's progress.
 */
const SWEEP_DURATION_MS: Record<'standardWin' | 'newHighScore', number> = {
  standardWin: 900,
  newHighScore: 1400,
};

/**
 * Version 1.2B — classic (neutral gold) vs. Ember Blaze (saturated
 * orange/red) victory palettes, selected by the resolved victory_effect
 * themeId so this stays visually coordinated with the rest of an
 * equipped Ember loadout without a separate purchasable "victory effect"
 * cosmetic (see `resolveEmberFamilyEffectThemes` in
 * `resolvePlayerVisualTheme.ts`).
 */
const PALETTE: Record<'classic' | 'ember', { glow: string; sweep: string; ember: string }> = {
  classic: { glow: '#E0C478', sweep: 'rgba(224,196,120,0.22)', ember: '#E0C478' },
  ember: { glow: '#FF6500', sweep: 'rgba(255,182,41,0.25)', ember: '#FFB629' },
};

/**
 * Version 1.2A — short, skippable victory celebration overlay.
 * `pointerEvents="none"` throughout (never blocks the Results screen's
 * own buttons), auto-completes well under two seconds, and never claims a
 * gameplay achievement that didn't happen (`trigger` is supplied by the
 * caller from the real, already-computed win/high-score state — this
 * component never invents one). Renders nothing unless
 * `EXPO_PUBLIC_ENABLE_VICTORY_EFFECTS` is on and `trigger` is set.
 */
export function ThemedVictoryEffect({ trigger, themeId }: Props) {
  const reduceMotion = useReducedMotionSetting();
  const definition = resolveThemeDefinition('victory_effect', themeId);
  const palette = definition.themeId === 'ember_victory_effect' ? PALETTE.ember : PALETTE.classic;

  const glow = useSharedValue(0);
  const sweepX = useSharedValue(-1);
  const duration = trigger ? SWEEP_DURATION_MS[trigger === 'newHighScore' ? 'newHighScore' : 'standardWin'] : 0;

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
    glow.value = withSequence(withTiming(1, { duration: 180 }), withTiming(0, { duration: duration - 180 }));
    sweepX.value = withTiming(1, { duration, easing: Easing.out(Easing.cubic) });
  }, [trigger, reduceMotion, glow, sweepX, duration]);

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
      <Animated.View style={[StyleSheet.absoluteFill, styles.glow, { backgroundColor: palette.glow }, glowStyle]} />
      {!reduceMotion ? (
        <Animated.View style={[styles.sweep, { backgroundColor: palette.sweep }, sweepStyle]} />
      ) : null}
      {!reduceMotion && trigger === 'newHighScore'
        ? Array.from({ length: EMBER_COUNT }).map((_, index) => (
            <EmberBurstDot key={index} index={index} color={palette.ember} duration={duration} />
          ))
        : null}
    </View>
  );
}

function EmberBurstDot({ index, color, duration }: { index: number; color: string; duration: number }) {
  const rise = useSharedValue(0);

  useEffect(() => {
    rise.value = withTiming(1, { duration: duration + index * 30, easing: Easing.out(Easing.quad) });
  }, [index, rise, duration]);

  const style = useAnimatedStyle(() => ({
    opacity: 1 - rise.value,
    transform: [{ translateY: -rise.value * 60 }],
  }));

  const leftPercent = 12 + index * 14;

  return (
    <Animated.View
      style={[
        styles.ember,
        { left: `${leftPercent}%` as `${number}%`, backgroundColor: color },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  glow: {},
  sweep: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 90,
  },
  ember: {
    position: 'absolute',
    bottom: '30%',
    width: 4,
    height: 4,
    borderRadius: 2,
  },
});
