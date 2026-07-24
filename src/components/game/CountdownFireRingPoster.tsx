import { useEffect } from 'react';
import { Image, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { blazeAssets } from '../../assets/blazeAssets';

export type CountdownFireRingProps = {
  animated?: boolean;
  reducedMotion?: boolean;
  size?: number;
  visible?: boolean;
};

/** Poster-based fire ring with optional subtle motion (web + reduced-motion). */
export function CountdownFireRingPoster({
  animated = true,
  reducedMotion = false,
  size = 280,
  visible = true,
}: CountdownFireRingProps) {
  const pulse = useSharedValue(1);
  const rotate = useSharedValue(0);

  useEffect(() => {
    if (!visible || reducedMotion || !animated) {
      cancelAnimation(pulse);
      cancelAnimation(rotate);
      pulse.value = 1;
      rotate.value = 0;
      return;
    }

    pulse.value = withRepeat(
      withSequence(
        withTiming(1.04, { duration: 900, easing: Easing.inOut(Easing.quad) }),
        withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      false,
    );
    rotate.value = withRepeat(
      withTiming(360, { duration: 14000, easing: Easing.linear }),
      -1,
      false,
    );

    return () => {
      cancelAnimation(pulse);
      cancelAnimation(rotate);
    };
  }, [animated, pulse, reducedMotion, rotate, visible]);

  const posterMotionStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: pulse.value },
      { rotate: `${rotate.value}deg` },
    ],
  }));

  if (!visible) {
    return null;
  }

  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: size, height: size }}
    >
      <Animated.View
        style={[
          { width: size, height: size },
          !reducedMotion && animated ? posterMotionStyle : null,
        ]}
      >
        <Image
          source={blazeAssets.countdownFireRingPoster}
          style={{ width: size, height: size }}
          resizeMode="contain"
        />
      </Animated.View>
    </View>
  );
}
