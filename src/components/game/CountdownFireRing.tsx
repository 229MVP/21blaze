import { useEffect } from 'react';
import { Image, Platform, View } from 'react-native';
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
import { FireRingAnimation } from './FireRingAnimation';

type Props = {
  animated?: boolean;
  reducedMotion?: boolean;
  size?: number;
  visible?: boolean;
};

/**
 * Production fire-ring wrapper for the Solo countdown.
 *
 * - Web / reduced-motion / hidden: static poster (stable, low cost)
 * - Native when animated + visible: frame sequence via FireRingAnimation
 * - Subtle code-driven pulse on the poster path (skipped under reduced motion)
 *
 * Does not own countdown timing or match-start side effects.
 */
export function CountdownFireRing({
  animated = true,
  reducedMotion = false,
  size = 280,
  visible = true,
}: Props) {
  const pulse = useSharedValue(1);
  const rotate = useSharedValue(0);

  const useFrames =
    Platform.OS !== 'web' &&
    animated &&
    !reducedMotion &&
    visible;

  useEffect(() => {
    if (!visible || reducedMotion || useFrames) {
      cancelAnimation(pulse);
      cancelAnimation(rotate);
      pulse.value = 1;
      rotate.value = 0;
      return;
    }

    if (!animated) {
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
  }, [animated, pulse, reducedMotion, rotate, useFrames, visible]);

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
      {useFrames ? (
        <FireRingAnimation
          size={size}
          playing={animated && visible && !reducedMotion}
          reducedMotion={false}
        />
      ) : (
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
      )}
    </View>
  );
}
