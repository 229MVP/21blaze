import { useEffect } from 'react';
import {
  Image,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
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

const CONTENT_MAX = 430;

/**
 * Presentation-only Solo start countdown.
 * Reacts to store-driven `value` / `visible`; does not own match timing.
 */
export function GameStartCountdown({ value, visible }: GameStartCountdownProps) {
  const reduceMotion = useReducedMotionSetting();
  const { width } = useWindowDimensions();
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.75);
  const glow = useSharedValue(0.35);

  const isBlaze = value === 0;
  const label = isBlaze ? 'BLAZE!' : String(value);
  const ringSize = Math.min(300, Math.max(200, Math.round(width * 0.72)));
  const columnWidth = Math.min(CONTENT_MAX, width);

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
      style={styles.overlay}
      pointerEvents="auto"
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

      <View style={[styles.column, { width: columnWidth, maxWidth: CONTENT_MAX }]}>
        <Text style={styles.getReady} accessibilityRole="header">
          GET READY!
        </Text>

        <View style={[styles.ringWrap, { width: ringSize, height: ringSize }]}>
          <CountdownFireRing
            size={ringSize}
            visible={visible}
            animated={!reduceMotion}
            reducedMotion={reduceMotion}
          />
          <Animated.Text
            accessibilityLiveRegion="polite"
            accessibilityRole="text"
            style={[
              styles.value,
              isBlaze && styles.valueBlaze,
              { fontSize: isBlaze ? Math.min(64, ringSize * 0.28) : Math.min(110, ringSize * 0.4) },
              valueStyle,
            ]}
          >
            {label}
          </Animated.Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 50,
    alignItems: 'center',
    justifyContent: 'center',
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
  column: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: kitSpacing.lg,
    gap: kitSpacing.md,
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
  ringWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: {
    position: 'absolute',
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
