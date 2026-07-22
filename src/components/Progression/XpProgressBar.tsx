import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { progressFraction } from '../../progression/levelEngine';
import { colors } from '../../theme/colors';
import { radius } from '../../theme/radius';
import { spacing } from '../../theme/spacing';
import { fontFamilies, typography } from '../../theme/typography';

type XpProgressBarProps = {
  currentLevelXp: number;
  xpRequiredForNextLevel: number;
  level?: number;
  compact?: boolean;
  showLabels?: boolean;
};

export function XpProgressBar({
  currentLevelXp,
  xpRequiredForNextLevel,
  level,
  compact = false,
  showLabels = true,
}: XpProgressBarProps) {
  const atCap = xpRequiredForNextLevel <= 0;
  const fraction = atCap ? 1 : progressFraction(currentLevelXp, xpRequiredForNextLevel);
  const widthPercent = `${Math.round(fraction * 100)}%` as `${number}%`;

  return (
    <View
      style={[styles.wrap, compact && styles.wrapCompact]}
      accessibilityRole="progressbar"
      accessibilityValue={{
        min: 0,
        max: atCap ? 1 : xpRequiredForNextLevel,
        now: atCap ? 1 : currentLevelXp,
      }}
      accessibilityLabel={
        atCap
          ? `Level ${level ?? ''} maxed`
          : `Level ${level ?? ''} XP ${currentLevelXp} of ${xpRequiredForNextLevel}`
      }
    >
      {showLabels ? (
        <View style={styles.labelRow}>
          {typeof level === 'number' ? (
            <Text style={styles.levelLabel}>LVL {level}</Text>
          ) : (
            <View />
          )}
          <Text style={styles.xpLabel}>
            {atCap
              ? 'MAX'
              : `${currentLevelXp.toLocaleString()} / ${xpRequiredForNextLevel.toLocaleString()} XP`}
          </Text>
        </View>
      ) : null}
      <View style={[styles.track, compact && styles.trackCompact]}>
        <LinearGradient
          colors={[colors.primary, colors.gold]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={[styles.fill, { width: widthPercent }]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    gap: spacing.xs,
  },
  wrapCompact: {
    gap: 4,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  levelLabel: {
    fontFamily: fontFamilies.bodyBold,
    fontSize: 12,
    letterSpacing: 1.1,
    color: colors.gold,
  },
  xpLabel: {
    ...typography.label,
    fontSize: 11,
    color: colors.textSecondary,
    textTransform: 'none',
  },
  track: {
    width: '100%',
    height: 12,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: colors.blazeSubtle,
    overflow: 'hidden',
  },
  trackCompact: {
    height: 8,
  },
  fill: {
    height: '100%',
    borderRadius: radius.sm,
  },
});
