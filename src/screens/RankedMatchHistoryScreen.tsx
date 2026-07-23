import { useEffect } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { DivisionBadge } from '../components/Ranked/DivisionBadge';
import { BlazeButton } from '../components/buttons/BlazeButton';
import { ScreenHeader } from '../components/Navigation/ScreenHeader';
import { ScreenContainer } from '../components/ScreenContainer';
import type { RankedMatchHistoryScreenProps } from '../navigation/navigationTypes';
import { useRankedStore } from '../store/useRankedStore';
import { colors } from '../theme/colors';
import { radius } from '../theme/radius';
import { spacing } from '../theme/spacing';
import { fontFamilies, typography } from '../theme/typography';
import { formatCompletedDate } from '../utils/formatCompletedDate';

function resultLabel(result: string): string {
  switch (result) {
    case 'win':
    case 'forfeit_win':
      return 'WIN';
    case 'loss':
    case 'forfeit_loss':
      return 'LOSS';
    case 'draw':
      return 'DRAW';
    case 'no_contest':
      return 'NO CONTEST';
    default:
      return result.toUpperCase();
  }
}

export function RankedMatchHistoryScreen({
  navigation,
}: RankedMatchHistoryScreenProps) {
  const matchHistory = useRankedStore((state) => state.matchHistory);
  const isLoading = useRankedStore((state) => state.isLoading);
  const error = useRankedStore((state) => state.error);
  const loadRankedHistory = useRankedStore((state) => state.loadRankedHistory);

  useEffect(() => {
    void loadRankedHistory();
  }, [loadRankedHistory]);

  return (
    <ScreenContainer style={styles.container} intensity="normal" padded={false}>
      <View style={styles.padded}>
        <ScreenHeader title="MATCH HISTORY" />

        {isLoading && matchHistory.length === 0 ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.lg }} />
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {!isLoading && matchHistory.length === 0 ? (
          <Text style={styles.empty}>No ranked matches yet.</Text>
        ) : null}

        <ScrollView
          style={styles.list}
          contentContainerStyle={styles.listContent}
        >
          {matchHistory.map((entry) => (
            <View key={entry.matchId} style={styles.row}>
              <View style={styles.top}>
                <Text style={styles.result}>{resultLabel(entry.result)}</Text>
                {entry.forfeit ? (
                  <Text style={styles.forfeit}>FORFEIT</Text>
                ) : null}
              </View>
              <Text style={styles.opponent} numberOfLines={1}>
                vs {entry.opponentName}
              </Text>
              <DivisionBadge division={entry.opponentDivision} size="small" />
              <Text style={styles.scores}>
                {entry.localScore.toLocaleString()} –{' '}
                {entry.opponentScore.toLocaleString()}
              </Text>
              {entry.ratingChange !== null ? (
                <Text
                  style={[
                    styles.delta,
                    entry.ratingChange >= 0 ? styles.deltaUp : styles.deltaDown,
                  ]}
                >
                  {entry.ratingChange >= 0 ? '+' : ''}
                  {entry.ratingChange} RATING
                </Text>
              ) : (
                <Text style={styles.deltaMuted}>PLACEMENT MATCH</Text>
              )}
              <Text style={styles.date}>
                {formatCompletedDate(entry.completedAt)}
              </Text>
            </View>
          ))}
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
  list: { flex: 1 },
  listContent: { gap: 10, paddingBottom: spacing.md },
  row: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: colors.backgroundCard,
    padding: spacing.md,
    gap: 6,
  },
  top: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  result: {
    fontFamily: fontFamilies.display,
    fontSize: 20,
    color: colors.primary,
  },
  forfeit: {
    ...typography.label,
    fontSize: 10,
    color: colors.warningRed,
  },
  opponent: {
    fontFamily: fontFamilies.bodyBold,
    fontSize: 15,
    color: colors.textPrimary,
  },
  scores: {
    fontFamily: fontFamilies.bodyBold,
    fontSize: 14,
    color: colors.textSecondary,
  },
  delta: {
    fontFamily: fontFamilies.bodyBold,
    fontSize: 13,
  },
  deltaUp: { color: colors.success },
  deltaDown: { color: colors.warningRed },
  deltaMuted: {
    ...typography.label,
    fontSize: 11,
    color: colors.textMuted,
  },
  date: {
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
  error: {
    ...typography.body,
    fontSize: 13,
    color: colors.warningRed,
    textAlign: 'center',
  },
});
