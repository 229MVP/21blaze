import { TextStyle } from 'react-native';

import { colors } from './colors';

export const typography = {
  heroTitle: {
    fontSize: 42,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: 1,
  } satisfies TextStyle,
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.textPrimary,
  } satisfies TextStyle,
  subtitle: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.textSecondary,
  } satisfies TextStyle,
  body: {
    fontSize: 16,
    fontWeight: '400',
    color: colors.textPrimary,
  } satisfies TextStyle,
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    letterSpacing: 0.5,
  } satisfies TextStyle,
  button: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 1,
  } satisfies TextStyle,
  version: {
    fontSize: 12,
    fontWeight: '400',
    color: colors.textSecondary,
  } satisfies TextStyle,
} as const;
