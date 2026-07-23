import { Image, StyleSheet, Text, View } from 'react-native';

import { colors, spacing, typography } from '../../theme/uiKit';

type Props = {
  eyebrow?: string;
  title: string;
  score: number;
  subtitle?: string;
  isHighScore?: boolean;
  crownVisible?: boolean;
};

export function ResultHero({
  eyebrow,
  title,
  score,
  subtitle,
  isHighScore = false,
  crownVisible = false,
}: Props) {
  return (
    <View
      accessible
      accessibilityLabel={`${title}. Score ${score.toLocaleString()}. ${subtitle ?? ''}`}
      style={styles.wrap}
    >
      {crownVisible ? (
        <Image
          source={require('../../../assets/branding/flaming-crown-256.webp')}
          style={styles.crown}
        />
      ) : null}
      {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
      <Text style={[styles.title, isHighScore && styles.blazing]}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      <Text style={styles.score}>{score.toLocaleString()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: spacing.xs },
  crown: { width: 56, height: 56, resizeMode: 'contain' },
  eyebrow: {
    color: colors.fire.gold,
    fontFamily: typography.families.condensed,
    fontWeight: '700',
  },
  title: {
    color: colors.text.primary,
    fontFamily: typography.families.display,
    fontSize: 42,
  },
  blazing: { color: colors.fire.brightOrange },
  subtitle: {
    color: colors.fire.gold,
    fontFamily: typography.families.condensed,
    fontWeight: '700',
  },
  score: {
    color: colors.fire.gold,
    fontFamily: typography.families.display,
    fontSize: 46,
    marginTop: spacing.sm,
  },
});
