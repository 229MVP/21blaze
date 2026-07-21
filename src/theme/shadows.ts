import { Platform, type ViewStyle } from 'react-native';

import { colors } from './colors';

type ShadowStyle = Pick<
  ViewStyle,
  'shadowColor' | 'shadowOffset' | 'shadowOpacity' | 'shadowRadius' | 'elevation'
>;

function shadow(
  color: string,
  offsetY: number,
  opacity: number,
  radius: number,
  elevation: number,
): ShadowStyle {
  return Platform.select({
    ios: {
      shadowColor: color,
      shadowOffset: { width: 0, height: offsetY },
      shadowOpacity: opacity,
      shadowRadius: radius,
    },
    android: {
      elevation,
      shadowColor: color,
    },
    default: {
      shadowColor: color,
      shadowOffset: { width: 0, height: offsetY },
      shadowOpacity: opacity,
      shadowRadius: radius,
      elevation,
    },
  }) as ShadowStyle;
}

export const shadows = {
  card: shadow('#000000', 2, 0.35, 6, 3),
  cardGlow: shadow(colors.primary, 0, 0.55, 12, 6),
  buttonPrimary: shadow(colors.primary, 2, 0.45, 10, 5),
  buttonDanger: shadow(colors.deepRed, 2, 0.4, 8, 4),
  soft: shadow('#000000', 2, 0.25, 4, 2),
} as const;
