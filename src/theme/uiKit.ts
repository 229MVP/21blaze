/**
 * UI-kit nested design tokens.
 * Kept separate from the production flat `colors` / `typography` exports so
 * existing screens keep compiling while kit components use their original shape.
 */
import { Platform } from 'react-native';

export const colors = {
  background: {
    primary: '#050709',
    secondary: '#0A0D10',
    panel: '#15181B',
    elevated: '#1C2024',
  },
  fire: {
    ember: '#8C1A05',
    red: '#D22C08',
    orange: '#FF6500',
    brightOrange: '#FF8A00',
    gold: '#FFB629',
    pale: '#FFF0C7',
  },
  text: {
    primary: '#F8F5EE',
    secondary: '#B9BEC5',
    muted: '#747B83',
    inverse: '#14100C',
  },
  border: {
    default: '#34393F',
    orange: 'rgba(255,138,0,0.40)',
    active: '#FFB629',
    danger: '#E62D1B',
  },
  status: {
    success: '#42C76A',
    warning: '#FFB629',
    danger: '#FF3426',
    info: '#4AB4FF',
  },
  suits: { red: '#D92222', black: '#121416' },
  transparent: 'transparent',
} as const;

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radii = {
  xs: 4,
  sm: 7,
  md: 10,
  lg: 14,
  xl: 20,
  pill: 999,
} as const;

export const typography = {
  families: {
    display: 'Anton_400Regular',
    condensed: 'RobotoCondensed_700Bold',
    body: 'RobotoCondensed_400Regular',
    fallback: 'System',
  },
  sizes: { xs: 10, sm: 12, md: 14, lg: 18, xl: 24, xxl: 34, hero: 48 },
  weights: { regular: '400', medium: '500', bold: '700', black: '900' },
  tracking: { tight: -0.4, normal: 0, wide: 1.2, extraWide: 2 },
} as const;

export const shadows = {
  panel: Platform.select({
    web: { boxShadow: '0 10px 24px rgba(0,0,0,.35)' },
    default: {
      shadowColor: '#000',
      shadowOpacity: 0.34,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 8 },
      elevation: 7,
    },
  }),
  glow: Platform.select({
    web: { boxShadow: '0 0 18px rgba(255,101,0,.30)' },
    default: {
      shadowColor: '#FF6500',
      shadowOpacity: 0.34,
      shadowRadius: 13,
      shadowOffset: { width: 0, height: 0 },
      elevation: 5,
    },
  }),
} as const;

export const animations = {
  instant: 80,
  fast: 140,
  standard: 240,
  dramatic: 420,
  countdown: 800,
  emberLoop: 8000,
} as const;
