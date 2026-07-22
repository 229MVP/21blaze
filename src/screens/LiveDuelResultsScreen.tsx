import { StyleSheet, Text, View } from 'react-native';

import { FlameIcon } from '../components/branding/FlameIcon';
import { BlazeButton } from '../components/buttons/BlazeButton';
import { ScreenContainer } from '../components/ScreenContainer';
import type { LiveDuelResultsScreenProps } from '../navigation/navigationTypes';
import { useAuthStore } from '../store/useAuthStore';
import { useLiveMatchStore } from '../store/useLiveMatchStore';
import { colors } from '../theme/colors';
import { radius } from '../theme/radius';
import { spacing } from '../theme/spacing';
import { fontFamilies, typography } from '../theme/typography';

function outcomeTitle(
  selfResult: string | undefined,
  winnerUserId: string | null | undefined,
  selfUserId: string | undefined,
): string {
  if (selfResult === 'draw' || (!winnerUserId && selfResult === 'pending')) {
    return 'DRAW';
  }
  if (
    selfResult === 'win' ||
    selfResult === 'forfeit_win' ||
    (winnerUserId && selfUserId && winnerUserId === selfUserId)
  ) {
    return 'VICTORY';
  }
  return 'DEFEAT';
}

export function LiveDuelResultsScreen({ navigation }: LiveDuelResultsScreenProps) {
  const userId = useAuthStore((state) => state.user?.id);
  const finalResult = useLiveMatchStore((state) => state.finalResult);
  const matchState = useLiveMatchStore((state) => state.matchState);
  const resetLiveMatch = useLiveMatchStore((state) => state.resetLiveMatch);

  const state = finalResult ?? matchState;
  const self = state?.self;
  const opponent = state?.opponent;
  const title = outcomeTitle(self?.result, state?.match.winnerUserId, userId);

  const goHome = () => {
    resetLiveMatch();
    navigation.reset({
      index: 0,
      routes: [{ name: 'Home' }],
    });
  };

  return (
    <ScreenContainer style={styles.container} intensity="intense" padded={false}>
      <View style={styles.padded}>
        <FlameIcon width={36} height={48} />
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>
          {state?.match.finishReason === 'disconnect_forfeit' ||
          state?.match.finishReason === 'voluntary_forfeit' ||
          state?.match.finishReason === 'missing_result'
            ? 'Decided by forfeit'
            : 'Server-verified result'}
        </Text>

        <View style={styles.row}>
          <ResultCard
            name={self?.displayName ?? 'You'}
            score={self?.verifiedScore}
            lanes={self?.verifiedLanesCleared}
            cards={self?.verifiedCardsPlayed}
            busts={self?.verifiedBusts}
            highlight
          />
          <ResultCard
            name={opponent?.displayName ?? 'Opponent'}
            score={opponent?.verifiedScore}
            lanes={opponent?.verifiedLanesCleared}
            cards={opponent?.verifiedCardsPlayed}
            busts={opponent?.verifiedBusts}
            highlight={false}
          />
        </View>

        <View style={styles.actions}>
          <View style={styles.comingSoon}>
            <Text style={styles.comingSoonTitle}>REMATCH</Text>
            <Text style={styles.comingSoonBody}>Coming Next</Text>
          </View>
          <BlazeButton title="RETURN HOME" onPress={goHome} fullWidth />
        </View>
      </View>
    </ScreenContainer>
  );
}

function ResultCard({
  name,
  score,
  lanes,
  cards,
  busts,
  highlight,
}: {
  name: string;
  score: number | null | undefined;
  lanes: number | null | undefined;
  cards: number | null | undefined;
  busts: number | null | undefined;
  highlight: boolean;
}) {
  return (
    <View style={[styles.card, highlight && styles.cardHighlight]}>
      <Text style={styles.name} numberOfLines={1}>
        {name}
      </Text>
      <Text style={styles.score}>{(score ?? 0).toLocaleString()}</Text>
      <Text style={styles.meta}>{lanes ?? 0} lanes</Text>
      <Text style={styles.meta}>{cards ?? 0} cards</Text>
      <Text style={styles.meta}>{busts ?? 0} busts</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  padded: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
    alignItems: 'center',
    gap: spacing.md,
  },
  title: {
    fontFamily: fontFamilies.display,
    fontSize: 44,
    color: colors.primary,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.body,
    fontSize: 14,
    color: colors.textSecondary,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  card: {
    flex: 1,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: colors.backgroundCard,
    padding: spacing.md,
    gap: 4,
  },
  cardHighlight: {
    borderColor: colors.gold,
  },
  name: {
    fontFamily: fontFamilies.bodyBold,
    color: colors.textPrimary,
    fontSize: 13,
  },
  score: {
    fontFamily: fontFamilies.display,
    fontSize: 28,
    color: colors.brightOrange,
  },
  meta: {
    ...typography.label,
    fontSize: 11,
    textTransform: 'none',
    color: colors.textSecondary,
  },
  actions: {
    width: '100%',
    marginTop: 'auto',
    gap: 10,
  },
  comingSoon: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: colors.backgroundCard,
    paddingVertical: spacing.md,
    alignItems: 'center',
    opacity: 0.7,
  },
  comingSoonTitle: {
    fontFamily: fontFamilies.bodyBold,
    letterSpacing: 1.2,
    color: colors.textPrimary,
  },
  comingSoonBody: {
    ...typography.label,
    color: colors.textMuted,
  },
});
