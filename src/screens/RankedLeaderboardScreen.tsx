import { useCallback, useEffect, useMemo } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { DivisionBadge } from '../components/Ranked/DivisionBadge';
import { BlazeButton } from '../components/buttons/BlazeButton';
import { ScreenHeader } from '../components/Navigation/ScreenHeader';
import { ScreenContainer } from '../components/ScreenContainer';
import type { RankedLeaderboardScreenProps } from '../navigation/navigationTypes';
import { useAuthStore } from '../store/useAuthStore';
import { useRankedStore } from '../store/useRankedStore';
import { colors } from '../theme/colors';
import { radius } from '../theme/radius';
import { spacing } from '../theme/spacing';
import { fontFamilies, typography } from '../theme/typography';

export function RankedLeaderboardScreen({
  navigation,
}: RankedLeaderboardScreenProps) {
  const userId = useAuthStore((state) => state.user?.id);
  const activeSeason = useRankedStore((state) => state.activeSeason);
  const leaderboard = useRankedStore((state) => state.leaderboard);
  const isLoading = useRankedStore((state) => state.isLoading);
  const error = useRankedStore((state) => state.error);
  const loadRankedLeaderboard = useRankedStore((state) => state.loadRankedLeaderboard);

  useEffect(() => {
    void loadRankedLeaderboard();
  }, [loadRankedLeaderboard]);

  const onRefresh = useCallback(() => {
    void loadRankedLeaderboard();
  }, [loadRankedLeaderboard]);

  const currentRank = useMemo(() => {
    if (!userId) {
      return null;
    }
    return leaderboard.find((row) => row.user_id === userId) ?? null;
  }, [leaderboard, userId]);

  const seasonRemaining = useMemo(() => {
    if (!activeSeason?.ends_at) {
      return null;
    }
    const ms = Date.parse(activeSeason.ends_at) - Date.now();
    if (!Number.isFinite(ms) || ms <= 0) {
      return 'Season ending soon';
    }
    const days = Math.floor(ms / (24 * 60 * 60 * 1000));
    return `${days}d remaining`;
  }, [activeSeason?.ends_at]);

  return (
    <ScreenContainer style={styles.container} intensity="normal" padded={false}>
      <View style={styles.padded}>
        <ScreenHeader title="RANKED LEADERBOARD" />
        <Text style={styles.season}>{activeSeason?.name ?? 'Ranked Season'}</Text>
        {seasonRemaining ? (
          <Text style={styles.remaining}>{seasonRemaining}</Text>
        ) : null}
        {currentRank ? (
          <Text style={styles.youAre}>YOUR RANK · #{currentRank.rank}</Text>
        ) : (
          <Text style={styles.youAre}>Complete placements to appear here</Text>
        )}

        {isLoading && leaderboard.length === 0 ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.lg }} />
        ) : null}

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.error}>{error}</Text>
            <BlazeButton title="RETRY" onPress={onRefresh} fullWidth />
          </View>
        ) : null}

        {!isLoading && !error && leaderboard.length === 0 ? (
          <Text style={styles.empty}>No placed ranked players yet.</Text>
        ) : null}

        <ScrollView
          style={styles.list}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={isLoading}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
        >
          {leaderboard.map((row) => {
            const isCurrent = row.user_id === userId;
            return (
              <View
                key={`${row.user_id}-${row.rank}`}
                style={[styles.row, isCurrent && styles.rowCurrent]}
              >
                <Text style={styles.rank}>#{row.rank}</Text>
                <View style={styles.copy}>
                  <Text style={styles.name} numberOfLines={1}>
                    {row.display_name}
                    {isCurrent ? ' (YOU)' : ''}
                  </Text>
                  <View style={styles.metaRow}>
                    <DivisionBadge division={row.current_division} size="small" />
                    <Text style={styles.rating}>{row.rating.toLocaleString()}</Text>
                  </View>
                  <Text style={styles.wl}>
                    {row.wins}W · {row.losses}L
                  </Text>
                </View>
              </View>
            );
          })}
        </ScrollView>

        <BlazeButton
          title="BACK"
          variant="outline"
          onPress={() => navigation.goBack()}
          fullWidth
        />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  padded: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  season: {
    fontFamily: fontFamilies.display,
    fontSize: 20,
    color: colors.gold,
    textAlign: 'center',
  },
  remaining: {
    ...typography.label,
    fontSize: 11,
    color: colors.textMuted,
    textAlign: 'center',
  },
  youAre: {
    ...typography.body,
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  list: { flex: 1 },
  listContent: { gap: 8, paddingBottom: spacing.md },
  row: {
    flexDirection: 'row',
    gap: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: colors.backgroundCard,
    padding: spacing.sm,
    alignItems: 'center',
  },
  rowCurrent: {
    borderColor: colors.gold,
    backgroundColor: 'rgba(255,101,0,0.12)',
  },
  rank: {
    fontFamily: fontFamilies.display,
    fontSize: 18,
    color: colors.primary,
    width: 44,
  },
  copy: { flex: 1, minWidth: 0, gap: 4 },
  name: {
    fontFamily: fontFamilies.bodyBold,
    fontSize: 15,
    color: colors.textPrimary,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  rating: {
    fontFamily: fontFamilies.bodyBold,
    fontSize: 14,
    color: colors.gold,
  },
  wl: {
    ...typography.label,
    fontSize: 11,
    color: colors.textMuted,
  },
  empty: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
  errorBox: { gap: 10 },
  error: {
    ...typography.body,
    fontSize: 13,
    color: colors.warningRed,
    textAlign: 'center',
  },
});
