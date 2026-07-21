import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';

type GameStartCountdownProps = {
  value: number;
  visible: boolean;
};

export function GameStartCountdown({ value, visible }: GameStartCountdownProps) {
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.7);

  useEffect(() => {
    if (!visible) {
      opacity.value = 0;
      scale.value = 0.7;
      return;
    }

    opacity.value = 0;
    scale.value = 0.7;
    opacity.value = withSequence(
      withTiming(1, { duration: 140, easing: Easing.out(Easing.cubic) }),
      withTiming(1, { duration: 520 }),
      withTiming(0.15, { duration: 180 }),
    );
    scale.value = withSequence(
      withTiming(1.12, { duration: 160, easing: Easing.out(Easing.cubic) }),
      withTiming(1, { duration: 180 }),
      withTiming(0.92, { duration: 180 }),
    );
  }, [opacity, scale, value, visible]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  if (!visible) {
    return null;
  }

  const label = value > 0 ? String(value) : 'BLAZE!';

  return (
    <View style={styles.overlay} pointerEvents="auto">
      <Animated.View style={[styles.badge, animatedStyle]}>
        <Text style={[styles.label, value === 0 && styles.blazeLabel]}>{label}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 30,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  badge: {
    minWidth: 160,
    minHeight: 160,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: colors.primary,
    backgroundColor: 'rgba(10, 10, 10, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  label: {
    ...typography.heroTitle,
    fontSize: 72,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  blazeLabel: {
    fontSize: 42,
    color: colors.primary,
  },
});
