import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { DivisionBadge } from '../components/Ranked/DivisionBadge';
import { FlameIcon } from '../components/branding/FlameIcon';
import { BlazeButton } from '../components/buttons/BlazeButton';
import { ScreenContainer } from '../components/ScreenContainer';
import { divisionRankIndex } from '../ranked/divisions';
import type { RankedResultsScreenProps } from '../navigation/navigationTypes';
import { useAuthStore } from '../store/useAuthStore';
import { useLiveMatchStore } from '../store/useLiveMatchStore';
import { useRankedStore } from '../store/useRankedStore';
import { colors } from '../theme/colors';
import { radius } from '../theme/radius';
import { spacing } from '../theme/spacing';
import { fontFamilies, typography } from '../theme/typography';

function outcomeTitle(
  selfResult: string | undefined,
  winnerUserId: string | null | undefined,
  selfUserId: string | undefined,
): string {
  if (selfResult === 'forfeit_loss') {
    return 'FORFEIT';
  }
  if (selfResult === 'forfeit_win') {
    return 'VICTORY';
  }
  const isWin =
    selfResult === 'win' ||
    (winnerUserId && selfUserId && winnerUserId === selfUserId);
  const isDraw =
    selfResult === 'draw' || (!winnerUserId && selfResult === 'pending');
  if (isDraw) {
    return 'DRAW';
  }
  return isWin ? 'VICTORY' : 'DEFEAT';
}

export function RankedResultsScreen({ navigation }: RankedResultsScreenProps) {
  const userId = useAuthStore((state) => state.user?.id);
  const finalResult = useLiveMatchStore((state) => state.finalResult);
  const matchState = useLiveMatchStore((state) => state.matchState);
  const resetLiveMatch = useLiveMatchStore((state) => state.resetLiveMatch);
  const rankedProfile = useRankedStore((state) => state.rankedProfile);
  const matchHistory = useRankedStore((state) => state.matchHistory);
  const hydrateRankedProfile = useRankedStore((state) => state.hydrateRankedProfile);
  const loadRankedHistory = useRankedStore((state) => state.loadRankedHistory);
  const resetRankedSession = useRankedStore((state) => state.resetRankedSession);
  const [previousDivision] = useState(rankedProfile?.division ?? 'unranked');
  const [previousPlacement] = useState(
    rankedProfile?.placementMatchesCompleted ?? 0,
  );

  useEffect(() => {
    void hydrateRankedProfile();
    void loadRankedHistory();
  }, [hydrateRankedProfile, loadRankedHistory]);

  const state = finalResult ?? matchState;
  const latestRated = useMemo(() => {
    const matchId = state?.match.id;
    if (!matchId) {
      return null;
    }
    return (
      matchHistory.find(
        (entry) => entry.matchId === matchId && entry.ratingChange !== null,
      ) ?? null
    );
  }, [matchHistory, state?.match.id]);
  const self = state?.self;
  const opponent = state?.opponent;
  const title = outcomeTitle(self?.result, state?.match.winnerUserId, userId);

  const placementComplete = rankedProfile?.placementComplete ?? false;
  const placementJustFinished =
    previousPlacement < 5 &&
    (rankedProfile?.placementMatchesCompleted ?? 0) >= 5;

  const divisionMessage = useMemo(() => {
    if (!rankedProfile?.placementComplete) {
      return null;
    }
    const before = divisionRankIndex(previousDivision);
    const after = divisionRankIndex(rankedProfile.division);
    if (after > before) {
      return `PROMOTED TO ${rankedProfile.division.replace('_', ' ').toUpperCase()}`;
    }
    if (after < before && previousDivision !== 'unranked') {
      return `DEMOTED TO ${rankedProfile.division.replace('_', ' ').toUpperCase()}`;
    }
    return null;
  }, [previousDivision, rankedProfile]);

  const goRankedHome = () => {
    resetLiveMatch();
    resetRankedSession();
    navigation.reset({
      index: 1,
      routes: [{ name: 'LiveDuelHome' }, { name: 'RankedHome' }],
    });
  };

  const findAnother = () => {
    resetLiveMatch();
    resetRankedSession();
    navigation.reset({
      index: 2,
      routes: [
        { name: 'LiveDuelHome' },
        { name: 'RankedHome' },
        { name: 'RankedSearch' },
      ],
    });
  };

  const goMainMenu = () => {
    resetLiveMatch();
    resetRankedSession();
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
        <Text style={styles.subtitle}>Ranked · server verified</Text>

        <View style={styles.row}>
          <ScoreCard
            name={self?.displayName ?? 'You'}
            score={self?.verifiedScore}
            highlight
          />
          <ScoreCard
            name={opponent?.displayName ?? 'Opponent'}
            score={opponent?.verifiedScore}
            highlight={false}
          />
        </View>

        {rankedProfile && !placementComplete ? (
          <View style={styles.placementBlock}>
            <Text style={styles.placementTitle}>PLACEMENT COMPLETE</Text>
            <Text style={styles.placementCount}>
              {rankedProfile.placementMatchesCompleted} /{' '}
              {rankedProfile.placementMatchesRequired}
            </Text>
          </View>
        ) : null}

        {placementJustFinished && rankedProfile?.placementComplete ? (
          <View style={styles.revealBlock}>
            <Text style={styles.revealTitle}>RANK REVEALED</Text>
            <DivisionBadge
              division={rankedProfile.division}
              rating={rankedProfile.rating}
              showRating
              size="large"
            />
            <Text style={styles.revealRating}>
              RATING {rankedProfile.rating.toLocaleString()}
            </Text>
          </View>
        ) : null}

        {rankedProfile?.placementComplete && !placementJustFinished ? (
          <View style={styles.ratingBlock}>
            <DivisionBadge
              division={rankedProfile.division}
              rating={rankedProfile.rating}
              showRating
              size="medium"
            />
            {latestRated && latestRated.ratingChange !== null ? (
              <>
                <Text style={styles.ratingLine}>
                  {latestRated.ratingBefore?.toLocaleString()} →{' '}
                  {latestRated.ratingAfter?.toLocaleString()}
                </Text>
                <Text
                  style={[
                    styles.delta,
                    latestRated.ratingChange >= 0 ? styles.deltaUp : styles.deltaDown,
                  ]}
                >
                  {latestRated.ratingChange >= 0 ? '+' : ''}
                  {latestRated.ratingChange} RATING
                </Text>
              </>
            ) : (
              <Text style={styles.ratingLine}>
                RATING {rankedProfile.rating.toLocaleString()}
              </Text>
            )}
            {divisionMessage ? (
              <Text style={styles.promo}>{divisionMessage}</Text>
            ) : null}
          </View>
        ) : null}

        <View style={styles.actions}>
          <BlazeButton title="FIND ANOTHER MATCH" onPress={findAnother} fullWidth />
          <BlazeButton
            title="RANKED HOME"
            variant="secondary"
            onPress={goRankedHome}
            fullWidth
          />
          <BlazeButton
            title="RETURN TO MAIN MENU"
            variant="outline"
            onPress={goMainMenu}
            fullWidth
          />
        </View>
      </View>
    </ScreenContainer>
  );
}

function ScoreCard({
  name,
  score,
  highlight,
}: {
  name: string;
  score: number | null | undefined;
  highlight: boolean;
}) {
  return (
    <View style={[styles.card, highlight && styles.cardHighlight]}>
      <Text style={styles.name} numberOfLines={1}>
        {name}
      </Text>
      <Text style={styles.score}>{(score ?? 0).toLocaleString()}</Text>
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
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  card: {
    flex: 1,
    minWidth: 0,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: colors.backgroundCard,
    padding: spacing.md,
    alignItems: 'center',
    gap: 4,
  },
  cardHighlight: {
    borderColor: colors.gold,
  },
  name: {
    fontFamily: fontFamilies.bodyBold,
    fontSize: 13,
    color: colors.textSecondary,
  },
  score: {
    fontFamily: fontFamilies.display,
    fontSize: 28,
    color: colors.textPrimary,
  },
  placementBlock: {
    alignItems: 'center',
    gap: 4,
  },
  placementTitle: {
    fontFamily: fontFamilies.bodyBold,
    letterSpacing: 1.2,
    color: colors.brightOrange,
  },
  placementCount: {
    fontFamily: fontFamilies.display,
    fontSize: 28,
    color: colors.textPrimary,
  },
  revealBlock: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  revealTitle: {
    fontFamily: fontFamilies.display,
    fontSize: 24,
    color: colors.gold,
  },
  revealRating: {
    fontFamily: fontFamilies.bodyBold,
    fontSize: 16,
    color: colors.textPrimary,
  },
  ratingBlock: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  ratingLine: {
    fontFamily: fontFamilies.bodyBold,
    fontSize: 16,
    color: colors.textPrimary,
  },
  promo: {
    fontFamily: fontFamilies.display,
    fontSize: 18,
    color: colors.gold,
    textAlign: 'center',
  },
  delta: {
    fontFamily: fontFamilies.display,
    fontSize: 22,
  },
  deltaUp: { color: colors.success },
  deltaDown: { color: colors.warningRed },
  actions: {
    marginTop: 'auto',
    width: '100%',
    gap: 10,
  },
});
