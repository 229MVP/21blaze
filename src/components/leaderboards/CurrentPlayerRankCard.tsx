import { StyleSheet, Text, View } from 'react-native';

import { BlazePanel } from '../ui/BlazePanel';
import { colors, spacing, typography } from '../../theme/uiKit';

export type CurrentPlayerRankState =
  | 'ranked'
  | 'not_ranked'
  | 'verification_pending'
  | 'not_attempted'
  | 'offline'
  | 'unavailable';

type Props = {
  state: CurrentPlayerRankState;
  rank: number | null;
  primaryLabel: string;
  primaryValue: string | number | null;
  secondaryLabel?: string;
  secondaryValue?: string | number | null;
  participantCount?: number;
  staleLabel?: string | null;
};

function stateCopy(state: CurrentPlayerRankState): string {
  switch (state) {
    case 'ranked':
      return 'Your current rank';
    case 'not_ranked':
      return 'Not yet ranked';
    case 'verification_pending':
      return 'Verification pending';
    case 'not_attempted':
      return 'Challenge not attempted';
    case 'offline':
      return 'Offline — showing cached data';
    case 'unavailable':
      return 'Leaderboard unavailable';
    default:
      return '';
  }
}

export function CurrentPlayerRankCard({
  state,
  rank,
  primaryLabel,
  primaryValue,
  secondaryLabel,
  secondaryValue,
  participantCount,
  staleLabel,
}: Props) {
  const rankDisplay =
    state === 'ranked' && rank != null ? `#${rank}` : state === 'verification_pending' ? '—' : '—';

  return (
    <View accessibilityLabel={`${stateCopy(state)}. Rank ${rankDisplay}.`}>
      <BlazePanel style={styles.panel}>
      <Text style={styles.eyebrow}>{stateCopy(state)}</Text>
      <View style={styles.row}>
        <View style={styles.rankBlock}>
          <Text style={styles.rankLabel}>RANK</Text>
          <Text style={styles.rankValue}>{rankDisplay}</Text>
        </View>
        <View style={styles.metricBlock}>
          <Text style={styles.metricLabel}>{primaryLabel}</Text>
          <Text style={styles.metricValue}>
            {primaryValue != null ? String(primaryValue) : '—'}
          </Text>
        </View>
        {secondaryLabel ? (
          <View style={styles.metricBlock}>
            <Text style={styles.metricLabel}>{secondaryLabel}</Text>
            <Text style={styles.metricValue}>
              {secondaryValue != null ? String(secondaryValue) : '—'}
            </Text>
          </View>
        ) : null}
      </View>
      {participantCount != null ? (
        <Text style={styles.participants}>{participantCount} verified participants</Text>
      ) : null}
      {staleLabel ? <Text style={styles.stale}>{staleLabel}</Text> : null}
      </BlazePanel>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    gap: spacing.sm,
  },
  eyebrow: {
    color: colors.fire.gold,
    fontSize: 12,
    letterSpacing: 1,
    fontFamily: typography.families.condensed,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.md,
  },
  rankBlock: {
    minWidth: 72,
  },
  rankLabel: {
    color: colors.text.secondary,
    fontSize: 11,
    fontFamily: typography.families.condensed,
  },
  rankValue: {
    color: colors.text.primary,
    fontSize: 28,
    fontFamily: typography.families.display,
  },
  metricBlock: {
    flex: 1,
    minWidth: 0,
  },
  metricLabel: {
    color: colors.text.secondary,
    fontSize: 11,
    fontFamily: typography.families.condensed,
  },
  metricValue: {
    color: colors.text.primary,
    fontSize: 18,
    fontFamily: typography.families.condensed,
    fontWeight: '700',
  },
  participants: {
    color: colors.text.secondary,
    fontSize: 12,
  },
  stale: {
    color: colors.fire.orange,
    fontSize: 12,
  },
});
