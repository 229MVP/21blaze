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
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';

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
  const pulse = useSharedValue(1);
  const isWarning = seconds <= warningThreshold;

  useEffect(() => {
    if (!isWarning || isPaused) {
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
  }, [isPaused, isWarning, pulse]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  return (
    <View style={styles.container} accessibilityLabel={`Timer ${formatTimerSeconds(seconds)}`}>
      <Text style={styles.label}>TIME</Text>
      <Animated.Text
        style={[
          styles.value,
          { color: isWarning ? colors.danger : colors.primary },
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
    backgroundColor: colors.backgroundSecondary,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  label: {
    ...typography.label,
    fontSize: 10,
    marginBottom: 2,
  },
  value: {
    ...typography.body,
    fontSize: 18,
    fontWeight: '800',
  },
  paused: {
    ...typography.label,
    marginTop: 2,
    color: colors.secondary,
    fontSize: 10,
  },
});
