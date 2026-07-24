import { View } from 'react-native';

import {
  CountdownFireRingPoster,
  type CountdownFireRingProps,
} from './CountdownFireRingPoster';
import { FireRingAnimation } from './FireRingAnimation';

/**
 * Native fire-ring: frame sequence when animated; poster fallback otherwise.
 */
export function CountdownFireRing({
  animated = true,
  reducedMotion = false,
  size = 280,
  visible = true,
}: CountdownFireRingProps) {
  if (!visible) {
    return null;
  }

  if (!animated || reducedMotion) {
    return (
      <CountdownFireRingPoster
        animated={false}
        reducedMotion
        size={size}
        visible={visible}
      />
    );
  }

  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: size, height: size }}
    >
      <FireRingAnimation size={size} playing={visible} reducedMotion={false} />
    </View>
  );
}
