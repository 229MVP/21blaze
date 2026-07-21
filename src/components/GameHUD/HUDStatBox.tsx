import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { colors } from '../../theme/colors';
import { radius } from '../../theme/radius';
import { spacing } from '../../theme/spacing';
import { fontFamilies, typography } from '../../theme/typography';

type HudPulseMode = 'none' | 'pulse' | 'danger' | 'shake';

type HUDStatBoxProps = {
  label: string;
  value: string;
  valueColor?: string;
  pulseToken?: number;
  mode?: HudPulseMode;
};

export function HUDStatBox({
  label,
  value,
  valueColor = colors.gold,
  pulseToken = 0,
  mode = 'none',
}: HUDStatBoxProps) {
  const scale = useSharedValue(1);
  const shakeX = useSharedValue(0);
  const tone = useSharedValue(0);

  useEffect(() => {
    if (pulseToken <= 0 || mode === 'none') {
      return;
    }

    if (mode === 'shake') {
      shakeX.value = withSequence(
        withTiming(-3, { duration: 35 }),
        withTiming(3, { duration: 35 }),
        withTiming(-2, { duration: 35 }),
        withTiming(0, { duration: 35 }),
      );
      return;
    }

    if (mode === 'danger') {
      tone.value = withSequence(
        withTiming(1, { duration: 90 }),
        withTiming(0, { duration: 260 }),
      );
      scale.value = withSequence(
        withTiming(1.08, { duration: 90 }),
        withTiming(1, { duration: 160 }),
      );
      return;
    }

    scale.value = withSequence(
      withTiming(1.1, { duration: 90 }),
      withTiming(1, { duration: 160 }),
    );
  }, [mode, pulseToken, scale, shakeX, tone]);

  const animatedStyle = useAnimatedStyle(() => {
    const color = interpolateColor(tone.value, [0, 1], [valueColor, colors.danger]);

    return {
      transform: [{ translateX: shakeX.value }, { scale: scale.value }],
      color,
    };
  });

  return (
    <View style={styles.box} accessibilityLabel={`${label} ${value}`}>
      <Text style={styles.label}>{label}</Text>
      <Animated.Text style={[styles.value, animatedStyle]}>{value}</Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flex: 1,
    minWidth: 0,
    backgroundColor: colors.backgroundCard,
    borderColor: colors.blazeSubtle,
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingVertical: 6,
    paddingHorizontal: 4,
    alignItems: 'center',
    gap: 1,
  },
  label: {
    ...typography.label,
    fontSize: 9,
    letterSpacing: 0.8,
    marginBottom: spacing.xs / 2,
  },
  value: {
    fontFamily: fontFamilies.display,
    fontSize: 18,
    lineHeight: 20,
    color: colors.gold,
  },
});
