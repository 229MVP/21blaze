import { View } from 'react-native';
import { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { colors } from '../../theme/uiKit';
import { SvgRoot as Svg } from '../svg/SvgRoot';

type Props = {
  size?: number;
  active?: boolean;
};

export function FlameIcon({ size = 24, active = true }: Props) {
  const safeSize = Number.isFinite(size) && size > 0 ? size : 24;

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: safeSize, height: safeSize, pointerEvents: 'none' }}
    >
      <Svg width={safeSize} height={safeSize} viewBox="0 0 64 64">
        <Defs>
          <LinearGradient id="flame" x1="50%" y1="0%" x2="50%" y2="100%">
            <Stop stopColor={colors.fire.pale} />
            <Stop offset="0.45" stopColor={colors.fire.gold} />
            <Stop offset="1" stopColor={colors.fire.orange} />
          </LinearGradient>
        </Defs>
        <Path
          d="M35 4c4 10-3 15 2 22 3-7 9-9 12-17 8 13 11 24 5 36-4 9-12 15-23 15C15 60 7 49 9 36c2-10 9-16 15-24 1 9-2 14 3 19 0-13 7-18 8-27Z"
          fill={active ? 'url(#flame)' : colors.background.elevated}
          stroke={active ? colors.fire.orange : colors.text.muted}
          strokeWidth={active ? 0 : 2}
        />
      </Svg>
    </View>
  );
}
