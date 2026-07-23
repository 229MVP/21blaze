import { Platform, TextStyle } from 'react-native';

import { colors } from './colors';

/** Custom faces when loaded; web gets CSS fallbacks if the face is missing. */
const displayFamily = Platform.select({
  web: 'Anton_400Regular, Impact, Haettenschweiler, sans-serif',
  default: 'Anton_400Regular',
}) as string;
const bodyFamily = Platform.select({
  web: 'RobotoCondensed_400Regular, "Arial Narrow", Arial, sans-serif',
  default: 'RobotoCondensed_400Regular',
}) as string;
const bodyBoldFamily = Platform.select({
  web: 'RobotoCondensed_700Bold, "Arial Narrow", Arial, sans-serif',
  default: 'RobotoCondensed_700Bold',
}) as string;
const bodySemiFamily = Platform.select({
  web: 'RobotoCondensed_600SemiBold, "Arial Narrow", Arial, sans-serif',
  default: 'RobotoCondensed_600SemiBold',
}) as string;

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
