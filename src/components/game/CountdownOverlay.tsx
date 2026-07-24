import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { colors, typography } from '../../theme/uiKit';
import { FireRingAnimation } from './FireRingAnimation';

type Props = {
  value: '3' | '2' | '1' | 'GO';
  visible: boolean;
  onComplete?: () => void;
  reducedMotion?: boolean;
};

export function CountdownOverlay({
  value,
  visible,
  onComplete,
  reducedMotion = false,
}: Props) {
  const scale = useSharedValue(1);

  useEffect(() => {
    if (!visible) {
      return;
    }
    scale.value = reducedMotion
      ? 1
      : withSequence(
          withTiming(1.15, { duration: 180 }),
          withTiming(1, { duration: 460 }),
        );
    if (value === 'GO') {
      const id = setTimeout(() => onComplete?.(), 700);
      return () => clearTimeout(id);
    }
    return undefined;
  }, [value, visible, onComplete, reducedMotion, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: withTiming(visible ? 1 : 0, { duration: 120 }),
  }));

  if (!visible) {
    return null;
  }

  return (
    <View accessibilityViewIsModal style={styles.overlay}>
      <Text style={styles.title}>GET READY!</Text>
      <View style={styles.ring}>
        <FireRingAnimation size={300} reducedMotion={reducedMotion} />
        <Animated.Text style={[styles.value, animatedStyle]}>
          {value === 'GO' ? 'BLAZE!' : value}
        </Animated.Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(2,3,5,.93)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 50,
  },
  title: {
    color: colors.fire.gold,
    fontFamily: typography.families.display,
    fontSize: 34,
    letterSpacing: 1.4,
    marginBottom: 8,
  },
  ring: {
    width: 300,
    height: 300,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: {
    position: 'absolute',
    color: colors.text.primary,
    fontFamily: typography.families.display,
    fontSize: 110,
    textShadowColor: colors.fire.orange,
    textShadowRadius: 18,
  },
});
