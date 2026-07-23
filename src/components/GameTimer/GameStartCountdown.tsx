import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { useReducedMotionSetting } from '../../hooks/useReducedMotionSetting';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { fontFamilies } from '../../theme/typography';
import { FlameIcon } from '../branding/FlameIcon';

type GameStartCountdownProps = {
  value: number;
  visible: boolean;
};

const FLAME_ANGLES = [0, 72, 144, 216, 288];

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

    opacity.value = 0;
    opacity.value = withSequence(
      withTiming(1, { duration: reduceMotion ? 80 : 140, easing: Easing.out(Easing.cubic) }),
      withTiming(1, { duration: reduceMotion ? 700 : 520 }),
      withTiming(0.2, { duration: reduceMotion ? 100 : 180 }),
    );

    if (reduceMotion) {
      scale.value = 1;
      return;
    }

    scale.value = 0.7;
    scale.value = withSequence(
      withTiming(1.12, { duration: 160, easing: Easing.out(Easing.cubic) }),
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
  const ringColor = isBlaze ? colors.gold : colors.primary;

  return (
    <View style={styles.overlay} pointerEvents="auto" accessibilityViewIsModal>
      <Text style={styles.getReady}>GET READY!</Text>
      <Animated.View style={[styles.ringWrap, animatedStyle]}>
        <View style={[styles.outerRing, { borderColor: ringColor }]} />
        <View
          style={[
            styles.innerRing,
            { borderColor: isBlaze ? 'rgba(255,182,41,0.4)' : 'rgba(255,101,0,0.4)' },
          ]}
        />
        {!reduceMotion
          ? FLAME_ANGLES.map((deg) => (
              <View
                key={deg}
                style={[styles.flameOrbit, { transform: [{ rotate: `${deg}deg` }] }]}
                pointerEvents="none"
              >
                <View style={styles.flameSlot}>
                  <FlameIcon width={12} height={16} />
                </View>
              </View>
            ))
          : null}
        <Text style={[styles.label, isBlaze && styles.blazeLabel]}>{label}</Text>
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
    gap: spacing.lg,
  },
  getReady: {
    fontFamily: fontFamilies.display,
    fontSize: 24,
    letterSpacing: 3,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  ringWrap: {
    width: 180,
    height: 180,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outerRing: {
    ...StyleSheet.absoluteFill,
    borderRadius: 90,
    borderWidth: 3,
    shadowColor: colors.primary,
    shadowOpacity: 0.7,
    shadowRadius: 16,
  },
  innerRing: {
    position: 'absolute',
    top: 8,
    right: 8,
    bottom: 8,
    left: 8,
    borderRadius: 82,
    borderWidth: 2,
  },
  flameOrbit: {
    ...StyleSheet.absoluteFill,
  },
  flameSlot: {
    position: 'absolute',
    top: -8,
    left: '50%',
    marginLeft: -6,
  },
  label: {
    fontFamily: fontFamilies.display,
    fontSize: 80,
    color: colors.textPrimary,
    textAlign: 'center',
    textShadowColor: 'rgba(255,101,0,0.7)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
  },
  blazeLabel: {
    fontSize: 36,
    letterSpacing: 2,
    textShadowColor: 'rgba(255,182,41,0.7)',
  },
});
