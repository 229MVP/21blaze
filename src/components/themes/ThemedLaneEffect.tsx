import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { useReducedMotionSetting } from '../../hooks/useReducedMotionSetting';
import { resolveThemeDefinition } from '../../themes/themeRegistry';
import { colors } from '../../theme/uiKit';

export type LaneEffectState =
  | 'idle'
  | 'selected'
  | 'validPlacement'
  | 'cardPlaced'
  | 'exact21'
  | 'fiveCardClear'
  | 'bust'
  | 'locked'
  | 'disabled';

type Props = {
  /** A `ThemeDefinition.themeId` in the `lane_effect` category, e.g. `'gold_lane_glow'`. */
  laneThemeId: string;
  state: LaneEffectState;
  /** Changes identity to re-trigger a transient flash for the same state. */
  eventKey?: string | null;
};

const TRANSIENT_STATES: ReadonlySet<LaneEffectState> = new Set([
  'cardPlaced',
  'exact21',
  'fiveCardClear',
  'bust',
]);

/**
 * Version 1.2A — self-contained, purely decorative lane-state overlay.
 * Absolutely positioned, `pointerEvents="none"` — never intercepts
 * touches, never changes lane layout or game-state timing. Composable
 * alongside the existing `LaneBox` (which already implements the
 * production idle/selected/placed/cleared/bust visuals) without
 * replacing it; used by the Theme Preview screen and available for a
 * future gameplay integration.
 */
export function ThemedLaneEffect({ laneThemeId, state, eventKey }: Props) {
  const reduceMotion = useReducedMotionSetting();
  const definition = resolveThemeDefinition('lane_effect', laneThemeId);
  const isGold = definition.themeId === 'gold_lane_glow';

  const flash = useSharedValue(0);

  useEffect(() => {
    if (!TRANSIENT_STATES.has(state) || reduceMotion) {
      flash.value = 0;
      return;
    }
    if (state === 'bust') {
      flash.value = withSequence(withTiming(2, { duration: 90 }), withTiming(0, { duration: 260 }));
      return;
    }
    flash.value = withSequence(withTiming(1, { duration: 100 }), withTiming(0, { duration: 260 }));
    // `eventKey` intentionally re-triggers the same sequence for a repeated event.
  }, [state, eventKey, reduceMotion, flash]);

  const animatedStyle = useAnimatedStyle(() => {
    const baseColor = isGold ? '#FFC94A' : colors.border.orange;
    const flashColor = isGold ? '#FFE18C' : colors.fire.orange;
    return {
      borderColor: interpolateColor(flash.value, [0, 1, 2], [baseColor, flashColor, colors.status.danger]),
    };
  });

  if (state === 'idle' && !isGold) {
    // Nothing to render beyond what LaneBox already draws for the plain
    // classic idle state — avoid an unnecessary extra layer.
    return null;
  }

  return (
    <Animated.View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[StyleSheet.absoluteFill, styles.border, animatedStyle, state === 'disabled' && styles.disabled]}
    >
      {(state === 'locked' || state === 'validPlacement' || state === 'selected') ? (
        <View style={[styles.corner, styles.cornerTopLeft, isGold && styles.goldCorner]} />
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  border: {
    borderWidth: 1.5,
    borderRadius: 14,
  },
  disabled: {
    opacity: 0.45,
  },
  corner: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderColor: colors.border.orange,
  },
  cornerTopLeft: {
    top: -1,
    left: -1,
    borderTopWidth: 2,
    borderLeftWidth: 2,
    borderTopLeftRadius: 12,
  },
  goldCorner: {
    borderColor: '#FFC94A',
  },
});
