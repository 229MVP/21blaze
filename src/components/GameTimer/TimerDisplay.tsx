import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { useReducedMotionSetting } from '../../hooks/useReducedMotionSetting';
import { formatTimerSeconds } from '../../game/timerEngine';
import { colors } from '../../theme/colors';
import { radius } from '../../theme/radius';
import { spacing } from '../../theme/spacing';
import { fontFamilies, typography } from '../../theme/typography';

type TimerDisplayProps = {
  seconds: number;
  warningThreshold: number;
  isPaused: boolean;
};

export function TimerDisplay({
  seconds,
  warningThreshold,
  isPaused,
}: TimerDisplayProps) {
  const reduceMotion = useReducedMotionSetting();
  const pulse = useSharedValue(1);
  const isWarning = seconds <= warningThreshold;

  useEffect(() => {
    if (!isWarning || isPaused || reduceMotion) {
      pulse.value = 1;
      return;
    }

    pulse.value = withRepeat(
      withSequence(
        withTiming(1.08, { duration: 280 }),
        withTiming(1, { duration: 280 }),
      ),
      -1,
      false,
    );
  }, [isPaused, isWarning, pulse, reduceMotion]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  return (
    <View
      style={styles.container}
      accessibilityLabel={`Timer ${formatTimerSeconds(seconds)}`}
    >
      <Text style={styles.label}>TIME</Text>
      <Animated.Text
        style={[
          styles.value,
          { color: isWarning ? colors.warningRed : colors.primary },
          animatedStyle,
        ]}
      >
        {formatTimerSeconds(seconds)}
      </Animated.Text>
      {isPaused ? <Text style={styles.paused}>PAUSED</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minWidth: 88,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.backgroundCard,
    borderColor: colors.blazeSubtle,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  label: {
    ...typography.label,
    fontSize: 10,
    marginBottom: 2,
  },
  value: {
    fontFamily: fontFamilies.display,
    fontSize: 22,
    lineHeight: 24,
  },
  paused: {
    ...typography.label,
    marginTop: 2,
    color: colors.gold,
    fontSize: 10,
  },
});
