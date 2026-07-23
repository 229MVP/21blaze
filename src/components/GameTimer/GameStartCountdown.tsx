import { Image, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useEffect } from 'react';

import { useReducedMotionSetting } from '../../hooks/useReducedMotionSetting';
import { colors } from '../../theme/colors';
import { fontFamilies } from '../../theme/typography';

type GameStartCountdownProps = {
  value: number;
  visible: boolean;
};

/**
 * Presentation-only countdown overlay.
 * Uses the UI-kit fire-ring poster first (stable on web); frame animation can
 * be layered later without changing the timer controller.
 */
export function GameStartCountdown({ value, visible }: GameStartCountdownProps) {
  const reduceMotion = useReducedMotionSetting();
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.7);

  useEffect(() => {
    if (!visible) {
      opacity.value = 0;
      scale.value = reduceMotion ? 1 : 0.7;
      return;
    }

    opacity.value = withSequence(
      withTiming(1, {
        duration: reduceMotion ? 80 : 140,
        easing: Easing.out(Easing.cubic),
      }),
      withTiming(1, { duration: reduceMotion ? 700 : 520 }),
      withTiming(0.2, { duration: reduceMotion ? 100 : 180 }),
    );

    if (reduceMotion) {
      scale.value = 1;
      return;
    }

    scale.value = withSequence(
      withTiming(1.12, {
        duration: 160,
        easing: Easing.out(Easing.cubic),
      }),
      withTiming(1, { duration: 180 }),
      withTiming(0.94, { duration: 180 }),
    );
  }, [opacity, reduceMotion, scale, value, visible]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  if (!visible) {
    return null;
  }

  const isBlaze = value === 0;
  const label = isBlaze ? 'BLAZE!' : String(value);

  return (
    <View style={styles.overlay} pointerEvents="auto" accessibilityViewIsModal>
      <Text style={styles.getReady}>GET READY!</Text>
      <Animated.View style={[styles.ringWrap, animatedStyle]}>
        <View
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={styles.poster}
        >
          <Image
            source={require('../../../assets/animations/countdown-fire-ring-poster.webp')}
            style={styles.posterImage}
            resizeMode="contain"
          />
        </View>
        <Text style={[styles.value, isBlaze && styles.valueBlaze]}>{label}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 50,
    backgroundColor: 'rgba(2,3,5,0.93)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  getReady: {
    fontFamily: fontFamilies.display,
    fontSize: 28,
    letterSpacing: 1.4,
    color: colors.gold,
    marginBottom: 12,
  },
  ringWrap: {
    width: 300,
    height: 300,
    alignItems: 'center',
    justifyContent: 'center',
  },
  poster: {
    ...StyleSheet.absoluteFill,
    width: 300,
    height: 300,
  },
  posterImage: {
    width: 300,
    height: 300,
  },
  value: {
    fontFamily: fontFamilies.display,
    fontSize: 110,
    color: colors.textPrimary,
    textShadowColor: colors.primary,
    textShadowRadius: 18,
  },
  valueBlaze: {
    fontSize: 72,
    color: colors.gold,
  },
});
