import { useId } from 'react';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { colors } from '../../theme/colors';

const FLAME_PATH =
  'M12 2 C12 2 16 8 16 14 C19 11 19 7 18 5 C20 9 22 14 20 20 C18.5 24 15 27 12 30 C9 27 5.5 24 4 20 C2 14 4 9 6 5 C5 7 5 11 8 14 C8 8 12 2 12 2Z';

type FlameIconProps = {
  width?: number;
  height?: number;
  active?: boolean;
  accessibilityHidden?: boolean;
};

export function FlameIcon({
  width = 24,
  height = 32,
  active = true,
  accessibilityHidden = true,
}: FlameIconProps) {
  const reactId = useId().replace(/:/g, '');
  const gradientId = `flameGrad-${reactId}`;

  return (
    <Svg
      width={width}
      height={height}
      viewBox="0 0 24 32"
      accessibilityElementsHidden={accessibilityHidden}
      importantForAccessibility={accessibilityHidden ? 'no-hide-descendants' : 'auto'}
    >
      {active ? (
        <Defs>
          <LinearGradient id={gradientId} x1="12" y1="30" x2="12" y2="2">
            <Stop offset="0%" stopColor={colors.deepRed} />
            <Stop offset="50%" stopColor={colors.primary} />
            <Stop offset="100%" stopColor={colors.gold} />
          </LinearGradient>
        </Defs>
      ) : null}
      <Path d={FLAME_PATH} fill={active ? `url(#${gradientId})` : colors.flameInactive} />
    </Svg>
  );
}
