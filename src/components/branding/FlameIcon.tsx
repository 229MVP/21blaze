import { useId } from 'react';
import { View } from 'react-native';
import { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { colors } from '../../theme/colors';
import { SvgRoot as Svg } from '../svg/SvgRoot';

const FLAME_PATH =
  'M12 2 C12 2 16 8 16 14 C19 11 19 7 18 5 C20 9 22 14 20 20 C18.5 24 15 27 12 30 C9 27 5.5 24 4 20 C2 14 4 9 6 5 C5 7 5 11 8 14 C8 8 12 2 12 2Z';

type FlameIconProps = {
  width?: number;
  height?: number;
  active?: boolean;
  accessibilityHidden?: boolean;
};

function toSvgSize(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return 24;
  }
  return value;
}

export function FlameIcon({
  width = 24,
  height = 32,
  active = true,
  accessibilityHidden = true,
}: FlameIconProps) {
  const reactId = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const gradientId = `flameGrad-${reactId || 'x'}`;
  const svgWidth = toSvgSize(width);
  const svgHeight = toSvgSize(height);

  return (
    <View
      accessibilityElementsHidden={accessibilityHidden}
      importantForAccessibility={
        accessibilityHidden ? 'no-hide-descendants' : 'auto'
      }
      style={{ width: svgWidth, height: svgHeight, pointerEvents: 'none' }}
    >
      <Svg width={svgWidth} height={svgHeight} viewBox="0 0 24 32">
        {active ? (
          <Defs>
            <LinearGradient
              id={gradientId}
              x1="50%"
              y1="100%"
              x2="50%"
              y2="0%"
            >
              <Stop offset="0%" stopColor={colors.deepRed} />
              <Stop offset="50%" stopColor={colors.primary} />
              <Stop offset="100%" stopColor={colors.gold} />
            </LinearGradient>
          </Defs>
        ) : null}
        <Path
          d={FLAME_PATH}
          fill={active ? `url(#${gradientId})` : colors.flameInactive}
        />
      </Svg>
    </View>
  );
}
