import { useEffect, type ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

import { useReducedMotionSetting } from '../../hooks/useReducedMotionSetting';
import { colors } from '../../theme/colors';

type Intensity = 'subtle' | 'normal' | 'intense';

type BlazeBackgroundProps = {
  children?: ReactNode;
  intensity?: Intensity;
  style?: ViewStyle;
};

const EMBERS = [
  { left: '15%', top: '78%', size: 3, delay: 0 },
  { left: '30%', top: '68%', size: 2, delay: 400 },
  { left: '55%', top: '82%', size: 2.5, delay: 800 },
  { left: '70%', top: '72%', size: 3, delay: 200 },
  { left: '80%', top: '85%', size: 2, delay: 600 },
  { left: '45%', top: '75%', size: 2.5, delay: 1000 },
] as const;

const GLOW: Record<Intensity, number> = {
  subtle: 0.08,
  normal: 0.14,
  intense: 0.22,
};

function Ember({
  left,
  top,
  size,
  delay,
  reduceMotion,
}: {
  left: string;
  top: string;
  size: number;
  delay: number;
  reduceMotion: boolean;
}) {
  const opacity = useSharedValue(0.35);
  const translateY = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) {
      opacity.value = 0.35;
      translateY.value = 0;
      return;
    }
    opacity.value = withRepeat(
      withTiming(0.85, { duration: 1600 + delay, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
    translateY.value = withRepeat(
      withTiming(-12, { duration: 2200 + delay, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, [delay, opacity, reduceMotion, translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.ember,
        {
          left: left as `${number}%`,
          top: top as `${number}%`,
          width: size,
          height: size,
          borderRadius: size,
        },
        animatedStyle,
      ]}
    />
  );
}

export function BlazeBackground({
  children,
  intensity = 'normal',
  style,
}: BlazeBackgroundProps) {
  const reduceMotion = useReducedMotionSetting();
  const glow = GLOW[intensity];

  return (
    <View style={[styles.root, style]}>
      <View style={styles.base} pointerEvents="none" />
      <LinearGradient
        pointerEvents="none"
        colors={[`rgba(255,101,0,${glow})`, 'transparent', `rgba(197,26,10,${glow * 0.55})`]}
        locations={[0, 0.5, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        pointerEvents="none"
        colors={['transparent', 'rgba(0,0,0,0.45)', 'rgba(0,0,0,0.82)']}
        locations={[0.3, 0.72, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.embers} pointerEvents="none">
        {EMBERS.map((ember, index) => (
          <Ember key={index} {...ember} reduceMotion={reduceMotion} />
        ))}
      </View>
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  base: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.background,
  },
  embers: {
    ...StyleSheet.absoluteFill,
  },
  ember: {
    position: 'absolute',
    backgroundColor: colors.brightOrange,
    shadowColor: colors.primary,
    shadowOpacity: 0.9,
    shadowRadius: 4,
  },
  content: {
    flex: 1,
  },
});
