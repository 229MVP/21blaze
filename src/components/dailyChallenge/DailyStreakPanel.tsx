import { StyleSheet, Text, View } from 'react-native';

import { getNextStreakMilestone } from '../../challenge/dailyStreakRewardRegistry';
import { isMonetizationBetaEnabled } from '../../config/featureFlags';
import {
  colors as kitColors,
  spacing as kitSpacing,
  typography as kitTypography,
} from '../../theme/uiKit';
import { BlazePanel } from '../ui/BlazePanel';

type DailyStreakPanelProps = {
  currentStreak: number;
  longestStreak?: number;
  nextMilestoneCoins?: number | null;
  compact?: boolean;
};

export function DailyStreakPanel({
  currentStreak,
  longestStreak,
  nextMilestoneCoins,
  compact = false,
}: DailyStreakPanelProps) {
  const next = getNextStreakMilestone(currentStreak);
  const showCoins = isMonetizationBetaEnabled() && nextMilestoneCoins != null;

  return (
    <BlazePanel style={compact ? styles.panelCompact : styles.panel}>
      <View style={styles.header}>
        <Text style={styles.icon} accessibilityElementsHidden>🔥</Text>
        <Text style={styles.title} accessibilityRole="header">DAILY STREAK</Text>
      </View>
      <Text
        style={styles.value}
        accessibilityLabel={`Daily streak ${currentStreak} days`}
      >
        {currentStreak} DAY{currentStreak === 1 ? '' : 'S'}
      </Text>
      {longestStreak != null && longestStreak > 0 ? (
        <Text style={styles.hint}>Best: {longestStreak} days</Text>
      ) : null}
      {next ? (
        <View style={styles.nextRow} accessibilityRole="text">
          <Text style={styles.nextLabel}>NEXT REWARD</Text>
          <Text style={styles.nextValue}>{next.label}</Text>
          {showCoins && next.blazeCoins != null ? (
            <Text style={styles.rewardAmount}>+{next.blazeCoins} Blaze Coins</Text>
          ) : null}
        </View>
      ) : null}
    </BlazePanel>
  );
}

const styles = StyleSheet.create({
  panel: {
    gap: kitSpacing.xs,
  },
  panelCompact: {
    gap: kitSpacing.xs,
    paddingVertical: kitSpacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  icon: {
    fontSize: 16,
  },
  title: {
    color: kitColors.fire.gold,
    fontFamily: kitTypography.families.condensed,
    fontSize: 11,
    letterSpacing: 1.2,
  },
  value: {
    color: kitColors.text.primary,
    fontFamily: kitTypography.families.display,
    fontSize: 28,
  },
  hint: {
    color: kitColors.text.secondary,
    fontSize: 12,
  },
  nextRow: {
    marginTop: 4,
    gap: 2,
  },
  nextLabel: {
    color: kitColors.text.muted,
    fontFamily: kitTypography.families.condensed,
    fontSize: 10,
    letterSpacing: 0.8,
  },
  nextValue: {
    color: kitColors.fire.orange,
    fontFamily: kitTypography.families.condensed,
    fontWeight: '700',
    fontSize: 13,
  },
  rewardAmount: {
    color: kitColors.fire.gold,
    fontSize: 12,
  },
});
