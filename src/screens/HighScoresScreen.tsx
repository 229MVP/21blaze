import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Svg, { Path } from 'react-native-svg';

import { FlameIcon } from '../components/branding/FlameIcon';
import { BlazeButton } from '../components/buttons/BlazeButton';
import { BlazeSegmentedControl } from '../components/Navigation/BlazeSegmentedControl';
import { ScreenHeader } from '../components/Navigation/ScreenHeader';
import { ScreenContainer } from '../components/ScreenContainer';
import type { RootStackParamList } from '../navigation/navigationTypes';
import type { ScoreEntry } from '../scores/types';
import { useScoreHistoryStore } from '../store/useScoreHistoryStore';
import { colors } from '../theme/colors';
import { radius } from '../theme/radius';
import { spacing } from '../theme/spacing';
import { fontFamilies, typography } from '../theme/typography';
import { formatCompletedDate } from '../utils/formatCompletedDate';

type HighScoresScreenProps = NativeStackScreenProps<RootStackParamList, 'HighScores'>;

type LeaderboardTab = 'local' | 'global' | 'friends';

function TrophyIcon() {
  return (
    <Svg width={28} height={28} viewBox="0 0 24 24" accessibilityElementsHidden>
      <Path
        d="M7 4h10v2h3v2c0 2.2-1.5 4-3.5 4.6A4.5 4.5 0 0 1 14 15.9V18h2v2H8v-2h2v-2.1A4.5 4.5 0 0 1 7.5 12.6C5.5 12 4 10.2 4 8V6h3V4zm2 2v1.5H6.1c.2 1 .9 1.8 1.9 2.1V6zm8.9 0H15v3.6c1-.3 1.7-1.1 1.9-2.1H17.9z"
        fill={colors.gold}
      />
    </Svg>
  );
}

function rankColor(rank: number): string {
  if (rank === 1) {
    return colors.gold;
  }
  if (rank === 2) {
    return '#C0C0C0';
  }
  if (rank === 3) {
    return '#CD7F32';
  }
  return colors.textSecondary;
}

function RankBadge({ rank }: { rank: number }) {
  const medal =
    rank === 1 ? '1st' : rank === 2 ? '2nd' : rank === 3 ? '3rd' : `#${rank}`;

  return (
    <View style={styles.rankWrap}>
      <Text style={[styles.rank, { color: rankColor(rank) }]}>{rank}</Text>
      {rank <= 3 ? (
        <Text style={[styles.medal, { color: rankColor(rank) }]}>{medal}</Text>
      ) : null}
    </View>
  );
}

function LocalRow({ entry, rank }: { entry: ScoreEntry; rank: number }) {
  return (
    <View
      style={[styles.row, rank === 1 && styles.rowGold]}
      accessibilityLabel={`Rank ${rank}, score ${entry.score}, ${entry.lanesCleared} lanes cleared, ${entry.cardsPlayed} cards played, ${formatCompletedDate(entry.completedAt)}`}
    >
      <RankBadge rank={rank} />
      <View style={styles.rowCopy}>
        <Text style={[styles.score, rank === 1 && styles.scoreGold]}>
          {entry.score.toLocaleString()}
        </Text>
        <Text style={styles.meta}>
          {entry.lanesCleared} lanes · {entry.cardsPlayed} cards
        </Text>
        <Text style={styles.date}>{formatCompletedDate(entry.completedAt)}</Text>
      </View>
    </View>
  );
}

export function HighScoresScreen({ navigation }: HighScoresScreenProps) {
  const [tab, setTab] = useState<LeaderboardTab>('local');
  const entries = useScoreHistoryStore((state) => state.entries);
  const isHydrated = useScoreHistoryStore((state) => state.isHydrated);
  const hydrateScoreHistory = useScoreHistoryStore((state) => state.hydrateScoreHistory);

  useEffect(() => {
    void hydrateScoreHistory();
  }, [hydrateScoreHistory]);

  return (
    <ScreenContainer style={styles.container} intensity="normal" padded={false}>
      <View style={styles.padded}>
        <ScreenHeader title="HIGH SCORES" icon={<TrophyIcon />} />

        <BlazeSegmentedControl
          options={[
            { label: 'LOCAL', value: 'local' },
            { label: 'GLOBAL', value: 'global' },
            { label: 'FRIENDS', value: 'friends' },
          ]}
          selectedValue={tab}
          onChange={setTab}
        />

        <ScrollView
          style={styles.list}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        >
          {tab === 'local' ? (
            !isHydrated ? (
              <Text style={styles.comingSoon}>Loading local scores…</Text>
            ) : entries.length === 0 ? (
              <View style={styles.empty}>
                <FlameIcon width={36} height={48} />
                <Text style={styles.emptyTitle}>NO SCORES YET</Text>
                <Text style={styles.emptyDetail}>
                  Finish a game to enter your local leaderboard.
                </Text>
                <BlazeButton
                  title="PLAY"
                  onPress={() => navigation.navigate('Game')}
                  accessibilityLabel="Play 21 Blaze"
                  style={styles.emptyPlay}
                />
              </View>
            ) : (
              entries.map((entry, index) => (
                <LocalRow key={entry.id} entry={entry} rank={index + 1} />
              ))
            )
          ) : null}

          {tab === 'global' ? (
            <View style={styles.comingSoonPanel}>
              <Text style={styles.comingSoonTitle}>GLOBAL</Text>
              <Text style={styles.comingSoon}>
                Online leaderboards are coming in a future update.
              </Text>
            </View>
          ) : null}

          {tab === 'friends' ? (
            <View style={styles.comingSoonPanel}>
              <Text style={styles.comingSoonTitle}>FRIENDS</Text>
              <Text style={styles.comingSoon}>
                Friend rankings are coming in a future update.
              </Text>
            </View>
          ) : null}
        </ScrollView>

        <BlazeButton
          title="BACK"
          variant="secondary"
          onPress={() => navigation.goBack()}
          accessibilityLabel="Back"
          fullWidth
        />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  padded: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.md,
  },
  list: {
    flex: 1,
  },
  listContent: {
    gap: 6,
    paddingBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.backgroundCard,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  rowGold: {
    backgroundColor: 'rgba(255,101,0,0.1)',
    borderColor: 'rgba(255,101,0,0.5)',
  },
  rankWrap: {
    width: 36,
    alignItems: 'center',
  },
  rank: {
    fontFamily: fontFamilies.display,
    fontSize: 18,
  },
  medal: {
    ...typography.label,
    fontSize: 9,
    marginTop: 1,
  },
  rowCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  score: {
    fontFamily: fontFamilies.display,
    fontSize: 18,
    color: colors.textPrimary,
  },
  scoreGold: {
    color: colors.gold,
  },
  meta: {
    ...typography.label,
    fontSize: 11,
    textTransform: 'none',
    color: colors.textSecondary,
  },
  date: {
    ...typography.label,
    fontSize: 11,
    textTransform: 'none',
    color: colors.textMuted,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    gap: spacing.sm,
  },
  emptyTitle: {
    fontFamily: fontFamilies.display,
    fontSize: 24,
    letterSpacing: 1,
    color: colors.textPrimary,
  },
  emptyDetail: {
    ...typography.body,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
  },
  emptyPlay: {
    marginTop: spacing.sm,
    minWidth: 160,
  },
  comingSoonPanel: {
    backgroundColor: colors.backgroundCard,
    borderColor: colors.blazeSubtle,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  comingSoonTitle: {
    fontFamily: fontFamilies.display,
    fontSize: 20,
    color: colors.primary,
    textAlign: 'center',
  },
  comingSoon: {
    ...typography.body,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
