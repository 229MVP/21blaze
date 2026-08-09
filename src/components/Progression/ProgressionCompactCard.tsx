import { Pressable, StyleSheet, Text, View } from 'react-native';

import { XpProgressBar } from './XpProgressBar';
import { getNextUnlockEntry } from '../../progression/progressionRewardRegistry';
import type { PlayerProgression } from '../../progression/types';
import { colors } from '../../theme/colors';
import { radius } from '../../theme/radius';
import { spacing } from '../../theme/spacing';
import { fontFamilies, typography } from '../../theme/typography';

type ProgressionCompactCardProps = {
  progression: PlayerProgression;
  onPress?: () => void;
  missionsCompleteCount?: number;
  missionsTotal?: number;
};

export function ProgressionCompactCard({
  progression,
  onPress,
  missionsCompleteCount,
  missionsTotal = 3,
}: ProgressionCompactCardProps) {
  const nextUnlock = getNextUnlockEntry(progression.level);
  const missionsSummary =
    typeof missionsCompleteCount === 'number'
      ? `${missionsCompleteCount} / ${missionsTotal} COMPLETE`
      : null;

  const content = (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.levelTitle}>LEVEL {progression.level}</Text>
        {missionsSummary ? (
          <Text style={styles.missionsBadge}>{missionsSummary}</Text>
        ) : null}
      </View>
      <XpProgressBar
        level={progression.level}
        currentLevelXp={progression.currentLevelXp}
        xpRequiredForNextLevel={progression.xpRequiredForNextLevel}
        compact
      />
      {nextUnlock ? (
        <View style={styles.nextUnlock}>
          <Text style={styles.nextLabel}>NEXT UNLOCK</Text>
          <Text style={styles.nextDetail}>
            Level {nextUnlock.level}
            {nextUnlock.deferred ? '' : ` · ${nextUnlock.displayName}`}
          </Text>
          {nextUnlock.deferred ? (
            <Text style={styles.deferred}>Coming soon</Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`Level ${progression.level}. ${progression.currentLevelXp} of ${progression.xpRequiredForNextLevel} XP toward next level.`}
      >
        {content}
      </Pressable>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.blazeSubtle,
    backgroundColor: 'rgba(0,0,0,0.22)',
    padding: spacing.md,
    gap: spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  levelTitle: {
    fontFamily: fontFamilies.display,
    fontSize: 18,
    letterSpacing: 1.2,
    color: colors.gold,
  },
  missionsBadge: {
    ...typography.label,
    fontSize: 10,
    color: colors.textSecondary,
    textTransform: 'none',
  },
  nextUnlock: {
    gap: 2,
  },
  nextLabel: {
    fontFamily: fontFamilies.bodyBold,
    fontSize: 10,
    letterSpacing: 1.1,
    color: colors.textSecondary,
  },
  nextDetail: {
    ...typography.body,
    fontSize: 13,
    color: colors.textPrimary,
  },
  deferred: {
    ...typography.label,
    fontSize: 10,
    color: colors.textSecondary,
    textTransform: 'none',
  },
});
