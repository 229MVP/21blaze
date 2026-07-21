import { StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { colors } from '../../theme/colors';
import { fontFamilies, typography } from '../../theme/typography';
import { FlameIcon } from './FlameIcon';

type BlazeLogoProps = {
  size?: 'sm' | 'md' | 'lg';
  showTagline?: boolean;
  style?: ViewStyle;
};

const SIZE = {
  sm: { scale: 0.65 },
  md: { scale: 1 },
  lg: { scale: 1.25 },
} as const;

export function BlazeLogo({ size = 'lg', showTagline = true, style }: BlazeLogoProps) {
  const s = SIZE[size].scale;
  const twentyOneSize = Math.round(64 * s);
  const blazeSize = Math.round(32 * s);

  return (
    <View style={[styles.root, style]} accessibilityRole="header">
      <View style={[styles.flames, { gap: 4 * s, marginBottom: -8 * s }]}>
        <FlameIcon width={20 * s} height={28 * s} />
        <FlameIcon width={28 * s} height={36 * s} />
        <FlameIcon width={20 * s} height={28 * s} />
      </View>
      <Text
        style={[
          styles.twentyOne,
          {
            fontSize: twentyOneSize,
            lineHeight: twentyOneSize,
            textShadowRadius: 20 * s,
          },
        ]}
        accessibilityLabel="21 Blaze"
      >
        21
      </Text>
      <Text
        style={[
          styles.blaze,
          {
            fontSize: blazeSize,
            lineHeight: blazeSize,
            letterSpacing: blazeSize * 0.12,
            marginTop: -4 * s,
          },
        ]}
      >
        BLAZE
      </Text>
      {showTagline ? (
        <Text style={styles.tagline}>BUILD YOUR STREAK. BEAT 21.</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
  },
  flames: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  twentyOne: {
    fontFamily: fontFamilies.display,
    color: colors.textPrimary,
    textAlign: 'center',
    textShadowColor: 'rgba(255,101,0,0.6)',
    textShadowOffset: { width: 0, height: 0 },
  },
  blaze: {
    fontFamily: fontFamilies.display,
    color: colors.primary,
    textAlign: 'center',
    textShadowColor: colors.gold,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  tagline: {
    ...typography.subtitle,
    marginTop: 8,
    fontSize: 12,
    letterSpacing: 1.2,
    textAlign: 'center',
  },
});
