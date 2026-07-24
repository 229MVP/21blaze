import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { formatTimerSeconds } from '../../game/timerEngine';
import { useReducedMotionSetting } from '../../hooks/useReducedMotionSetting';
import { colors as kitColors, radii, spacing, typography } from '../../theme/uiKit';

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
      style={[styles.container, isWarning && styles.containerWarning]}
      accessibilityLabel={`Timer ${formatTimerSeconds(seconds)}${
        isPaused ? ', paused' : ''
      }`}
    >
      <Text style={styles.label}>TIME</Text>
      <Animated.Text
        style={[
          styles.value,
          {
            color: isWarning
              ? kitColors.status.danger
              : kitColors.fire.brightOrange,
          },
          isWarning && styles.valueWarning,
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
    minWidth: 96,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderColor: kitColors.border.orange,
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  containerWarning: {
    borderColor: 'rgba(255,52,38,0.55)',
    backgroundColor: 'rgba(40,8,6,0.55)',
  },
  label: {
    color: kitColors.text.secondary,
    fontFamily: typography.families.condensed,
    fontSize: 10,
    letterSpacing: 1.1,
    marginBottom: 2,
  },
  value: {
    fontFamily: typography.families.display,
    fontSize: 26,
    lineHeight: 28,
  },
  valueWarning: {
    textShadowColor: 'rgba(255,52,38,0.55)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  paused: {
    marginTop: 2,
    color: kitColors.fire.gold,
    fontFamily: typography.families.condensed,
    fontSize: 10,
    letterSpacing: 1,
  },
});
