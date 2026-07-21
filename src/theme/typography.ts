import { TextStyle } from 'react-native';

import { colors } from './colors';

const displayFamily = 'Anton_400Regular';
const bodyFamily = 'RobotoCondensed_400Regular';
const bodyBoldFamily = 'RobotoCondensed_700Bold';
const bodySemiFamily = 'RobotoCondensed_600SemiBold';

export const typography = {
  heroTitle: {
    fontFamily: displayFamily,
    fontSize: 56,
    color: colors.textPrimary,
    letterSpacing: -0.5,
  } satisfies TextStyle,
  display: {
    fontFamily: displayFamily,
    fontSize: 32,
    color: colors.textPrimary,
    letterSpacing: 1,
  } satisfies TextStyle,
  title: {
    fontFamily: displayFamily,
    fontSize: 28,
    color: colors.textPrimary,
    letterSpacing: 0.5,
  } satisfies TextStyle,
  subtitle: {
    fontFamily: bodySemiFamily,
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  } satisfies TextStyle,
  body: {
    fontFamily: bodyFamily,
    fontSize: 16,
    color: colors.textPrimary,
  } satisfies TextStyle,
  bodyBold: {
    fontFamily: bodyBoldFamily,
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  } satisfies TextStyle,
  label: {
    fontFamily: bodySemiFamily,
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
    letterSpacing: 1,
    textTransform: 'uppercase',
  } satisfies TextStyle,
  button: {
    fontFamily: displayFamily,
    fontSize: 16,
    letterSpacing: 1,
    color: colors.textPrimary,
  } satisfies TextStyle,
  hudValue: {
    fontFamily: displayFamily,
    fontSize: 18,
    color: colors.gold,
    lineHeight: 20,
  } satisfies TextStyle,
  version: {
    fontFamily: bodyFamily,
    fontSize: 12,
    color: colors.textMuted,
  } satisfies TextStyle,
} as const;

export const fontFamilies = {
  display: displayFamily,
  body: bodyFamily,
  bodySemi: bodySemiFamily,
  bodyBold: bodyBoldFamily,
} as const;
