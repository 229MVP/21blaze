import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { ChallengeLeaderboardRow } from '../components/leaderboards/LeaderboardRow';
import { BlazePanel } from '../components/ui/BlazePanel';
import { useLeaderboardStore } from '../store/useLeaderboardStore';
import { colors, spacing, typography } from '../theme/uiKit';

type Props = {
  loading: boolean;
  emptyText?: string;
};

export function WeeklyLeaderboardPanel({ loading, emptyText = 'NO WEEKLY SCORES YET' }: Props) {
  const weeklyRows = useLeaderboardStore((state) => state.weeklyRows);
  const nearbyWeeklyRows = useLeaderboardStore((state) => state.nearbyWeeklyRows);
  const weekStart = useLeaderboardStore((state) => state.weekStart);
  const weekEnd = useLeaderboardStore((state) => state.weekEnd);
  const participantCount = useLeaderboardStore((state) => state.weeklyParticipantCount);
  const loadWeeklyLeaderboard = useLeaderboardStore((state) => state.loadWeeklyLeaderboard);
  const loadNearbyWeekly = useLeaderboardStore((state) => state.loadNearbyWeekly);

  useEffect(() => {
    void loadWeeklyLeaderboard();
    void loadNearbyWeekly();
  }, [loadNearbyWeekly, loadWeeklyLeaderboard]);

  return (
    <View style={styles.wrap}>
      <Text style={styles.meta}>
        {weekStart && weekEnd ? `${weekStart} — ${weekEnd}` : 'UTC week'}
      </Text>
      <Text style={styles.participants}>{participantCount} participants</Text>
      <BlazePanel padding={0} style={styles.panel}>
        {loading ? (
          <ActivityIndicator color={colors.fire.orange} style={styles.loader} />
        ) : weeklyRows.length === 0 ? (
          <Text style={styles.empty}>{emptyText}</Text>
        ) : (
          weeklyRows.map((row) => (
            <ChallengeLeaderboardRow
              key={`weekly-${row.rank}-${row.playerName}`}
              mode="weekly"
              rank={row.rank}
              playerName={row.playerName}
              challengePoints={row.challengePoints}
              verifiedDaysCompleted={row.verifiedDaysCompleted}
              bestDailyRank={row.bestDailyRank}
              profileFrameId={row.profileFrameId}
              playerTitleId={row.playerTitleId}
              isCurrentPlayer={row.isCurrentPlayer}
            />
          ))
        )}
      </BlazePanel>
      {nearbyWeeklyRows.length > 0 ? (
        <View style={styles.nearby}>
          <Text style={styles.nearbyTitle}>NEARBY PLAYERS</Text>
          {nearbyWeeklyRows.map((row) => (
            <Text key={`nearby-weekly-${row.rank}`} style={styles.nearbyLine}>
              #{row.rank} {row.playerName} · {row.challengePoints} pts
              {row.isCurrentPlayer ? ' (YOU)' : ''}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.sm,
  },
  meta: {
    color: colors.text.secondary,
    fontSize: 13,
  },
  participants: {
    color: colors.text.muted,
    fontSize: 12,
  },
  panel: {
    overflow: 'hidden',
  },
  loader: {
    padding: spacing.xl,
  },
  empty: {
    color: colors.text.secondary,
    padding: spacing.xl,
    textAlign: 'center',
  },
  nearby: {
    gap: spacing.xs,
  },
  nearbyTitle: {
    color: colors.fire.gold,
    fontSize: 12,
    letterSpacing: 1,
    fontFamily: typography.families.condensed,
  },
  nearbyLine: {
    color: colors.text.secondary,
    fontSize: 13,
  },
});
