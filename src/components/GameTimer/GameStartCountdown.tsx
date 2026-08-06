import { useEffect } from 'react';
import {
  Image,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

import { blazeAssets } from '../../assets/blazeAssets';
import { useReducedMotionSetting } from '../../hooks/useReducedMotionSetting';
import {
  colors as kitColors,
  spacing as kitSpacing,
  typography as kitTypography,
} from '../../theme/uiKit';
import { CountdownFireRing } from '../game/CountdownFireRing';

type GameStartCountdownProps = {
  value: number;
  visible: boolean;
};

/** Fixed ring size — centering uses flex layout inside the board wrapper, not screen width. */
const RING_SIZE = 280;

/**
 * Presentation-only Solo start countdown.
 * Reacts to store-driven `value` / `visible`; does not own match timing.
 * Must render inside the four-lane board wrapper so overlay center matches the board.
 */
export function GameStartCountdown({ value, visible }: GameStartCountdownProps) {
  const reduceMotion = useReducedMotionSetting();
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.75);
  const glow = useSharedValue(0.35);

  const isBlaze = value === 0;
  const label = isBlaze ? 'BLAZE!' : String(value);

  useEffect(() => {
    if (!visible) {
      opacity.value = 0;
      scale.value = reduceMotion ? 1 : 0.75;
      glow.value = 0.35;
      return;
    }

    const enter = reduceMotion ? 80 : 140;
    const hold = reduceMotion ? 700 : 520;
    const exit = reduceMotion ? 100 : 160;

    opacity.value = 0;
    opacity.value = withSequence(
      withTiming(1, { duration: enter, easing: Easing.out(Easing.cubic) }),
      withTiming(1, { duration: hold }),
      withTiming(isBlaze ? 0 : 0.25, { duration: exit }),
    );

    if (reduceMotion) {
      scale.value = 1;
      glow.value = isBlaze ? 0.7 : 0.4;
      return;
    }

    const peak = isBlaze ? 1.18 : 1;
    const start = isBlaze ? 0.7 : 0.75;

    scale.value = start;
    scale.value = withSequence(
      withTiming(peak, { duration: 160, easing: Easing.out(Easing.cubic) }),
      withTiming(1, { duration: 180 }),
      withTiming(isBlaze ? 1.04 : 0.96, { duration: 180 }),
    );

    glow.value = withSequence(
      withTiming(isBlaze ? 0.85 : 0.65, { duration: 160 }),
      withTiming(isBlaze ? 0.55 : 0.35, { duration: 360 }),
    );
  }, [glow, isBlaze, opacity, reduceMotion, scale, value, visible]);

  const valueStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
    textShadowRadius: 12 + glow.value * 18,
  }));

  if (!visible) {
    return null;
  }

  return (
    <View
      style={styles.countdownOverlay}
      pointerEvents="none"
      accessibilityViewIsModal
      accessibilityLabel={`Countdown. Get ready. ${label}`}
    >
      <View style={styles.dim} pointerEvents="none" />
      <View
        pointerEvents="none"
        style={styles.embers}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Image
          source={blazeAssets.emberOverlay}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
        />
      </View>
      <LinearGradient
        pointerEvents="none"
        colors={['transparent', 'rgba(255,101,0,0.22)', 'rgba(5,7,9,0.7)']}
        locations={[0.55, 0.82, 1]}
        style={styles.lavaGlow}
      />

      <View style={styles.countdownContent}>
        <Text style={styles.getReady} accessibilityRole="header">
          GET READY!
        </Text>

        <View style={styles.countdownCenter}>
          <View style={styles.rotatingRing}>
            <CountdownFireRing
              size={RING_SIZE}
              visible={visible}
              animated={!reduceMotion}
              reducedMotion={reduceMotion}
            />
          </View>
          <View style={styles.countdownNumberLayer}>
            <Animated.Text
              accessibilityLiveRegion="polite"
              accessibilityRole="text"
              style={[
                styles.value,
                isBlaze && styles.valueBlaze,
                {
                  fontSize: isBlaze
                    ? Math.min(64, RING_SIZE * 0.28)
                    : Math.min(110, RING_SIZE * 0.4),
                },
                valueStyle,
              ]}
            >
              {label}
            </Animated.Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  countdownOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none',
    zIndex: 50,
    elevation: 50,
  },
  dim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(2,3,5,0.78)',
  },
  embers: {
    ...StyleSheet.absoluteFill,
    opacity: 0.28,
  },
  lavaGlow: {
    ...StyleSheet.absoluteFill,
  },
  countdownContent: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: kitSpacing.md,
    paddingHorizontal: kitSpacing.lg,
    maxWidth: '100%',
  },
  getReady: {
    fontFamily: kitTypography.families.display,
    fontSize: 28,
    letterSpacing: 2,
    color: kitColors.fire.gold,
    textAlign: 'center',
    textShadowColor: 'rgba(255,101,0,0.45)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  countdownCenter: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rotatingRing: {
    width: RING_SIZE,
    height: RING_SIZE,
  },
  countdownNumberLayer: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: {
    fontFamily: kitTypography.families.display,
    color: kitColors.fire.pale,
    textAlign: 'center',
    textShadowColor: kitColors.fire.orange,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 18,
  },
  valueBlaze: {
    color: kitColors.fire.gold,
    letterSpacing: 2,
    textShadowColor: 'rgba(255,182,41,0.75)',
  },
});
