import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Path } from 'react-native-svg';

import { FlameIcon } from '../components/branding/FlameIcon';
import { BlazeButton } from '../components/buttons/BlazeButton';
import { BlazeScreenBackground } from '../components/layout/BlazeScreenBackground';
import { LeaderboardRow } from '../components/leaderboard/LeaderboardRow';
import { BlazeSegmentedControl } from '../components/Navigation/BlazeSegmentedControl';
import { ScreenHeader } from '../components/Navigation/ScreenHeader';
import { SvgRoot as Svg } from '../components/svg/SvgRoot';
import { BlazePanel } from '../components/ui/BlazePanel';
import type { GlobalLeaderboardRow } from '../lib/database.types';
import type { RootStackParamList } from '../navigation/navigationTypes';
import type { ScoreEntry } from '../scores/types';
import { loadGlobalLeaderboard } from '../services/leaderboardService';
import { useAuthStore } from '../store/useAuthStore';
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
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: 28, height: 28 }}
    >
      <Svg width={28} height={28} viewBox="0 0 24 24">
        <Path
          d="M7 4h10v2h3v2c0 2.2-1.5 4-3.5 4.6A4.5 4.5 0 0 1 14 15.9V18h2v2H8v-2h2v-2.1A4.5 4.5 0 0 1 7.5 12.6C5.5 12 4 10.2 4 8V6h3V4zm2 2v1.5H6.1c.2 1 .9 1.8 1.9 2.1V6zm8.9 0H15v3.6c1-.3 1.7-1.1 1.9-2.1H17.9z"
          fill={colors.gold}
        />
      </Svg>
    </View>
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
    <LeaderboardRow
      rank={rank}
      playerName={`Local · ${formatCompletedDate(entry.completedAt)}`}
      score={entry.score}
      isCurrentPlayer={rank === 1}
    />
  );
}

function GlobalRow({
  entry,
  isCurrentPlayer,
}: {
  entry: GlobalLeaderboardRow;
  isCurrentPlayer: boolean;
}) {
  return (
    <View
      style={[
        styles.row,
        entry.rank === 1 && styles.rowGold,
        isCurrentPlayer && styles.rowCurrent,
      ]}
      accessibilityLabel={`Rank ${entry.rank}, ${entry.display_name}, score ${entry.score}, ${entry.lanes_cleared} lanes cleared, ${entry.cards_played} cards played`}
    >
      <RankBadge rank={entry.rank} />
      <View style={styles.rowCopy}>
        <Text style={[styles.playerName, isCurrentPlayer && styles.playerNameCurrent]}>
          {entry.display_name}
          {isCurrentPlayer ? ' (YOU)' : ''}
        </Text>
        <Text style={[styles.score, entry.rank === 1 && styles.scoreGold]}>
          {entry.score.toLocaleString()}
        </Text>
        <Text style={styles.meta}>
          {entry.lanes_cleared} lanes · {entry.cards_played} cards
        </Text>
      </View>
    </View>
  );
}

export function HighScoresScreen({ navigation }: HighScoresScreenProps) {
  const [tab, setTab] = useState<LeaderboardTab>('local');
  const entries = useScoreHistoryStore((state) => state.entries);
  const isHydrated = useScoreHistoryStore((state) => state.isHydrated);
  const hydrateScoreHistory = useScoreHistoryStore((state) => state.hydrateScoreHistory);
  const userId = useAuthStore((state) => state.user?.id ?? null);

  const [globalRows, setGlobalRows] = useState<GlobalLeaderboardRow[]>([]);
  const [globalLoading, setGlobalLoading] = useState(false);
  const [globalRefreshing, setGlobalRefreshing] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [hasLoadedGlobal, setHasLoadedGlobal] = useState(false);

  useEffect(() => {
    void hydrateScoreHistory();
  }, [hydrateScoreHistory]);

  const fetchGlobal = useCallback(async (mode: 'load' | 'refresh' = 'load') => {
    if (mode === 'refresh') {
      setGlobalRefreshing(true);
    } else {
      setGlobalLoading(true);
    }
    setGlobalError(null);

    try {
      const rows = await loadGlobalLeaderboard(25);
      setGlobalRows(rows);
      setHasLoadedGlobal(true);
    } catch (error) {
      setGlobalError(
        error instanceof Error ? error.message : 'Unable to load global leaderboard.',
      );
    } finally {
      setGlobalLoading(false);
      setGlobalRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (tab === 'global' && !hasLoadedGlobal && !globalLoading) {
      void fetchGlobal('load');
    }
  }, [fetchGlobal, globalLoading, hasLoadedGlobal, tab]);

  return (
    <BlazeScreenBackground variant="plain">
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
          refreshControl={
            tab === 'global' && Platform.OS !== 'web' ? (
              <RefreshControl
                refreshing={globalRefreshing}
                onRefresh={() => {
                  void fetchGlobal('refresh');
                }}
                tintColor={colors.primary}
              />
            ) : undefined
          }
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
              <BlazePanel padding={0}>
                {entries.map((entry, index) => (
                  <LocalRow key={entry.id} entry={entry} rank={index + 1} />
                ))}
              </BlazePanel>
            )
          ) : null}

          {tab === 'global' ? (
            globalLoading && !hasLoadedGlobal ? (
              <View style={styles.loadingBlock}>
                <ActivityIndicator color={colors.primary} />
                <Text style={styles.comingSoon}>Loading global scores…</Text>
              </View>
            ) : globalError ? (
              <View style={styles.comingSoonPanel}>
                <Text style={styles.comingSoonTitle}>GLOBAL</Text>
                <Text style={styles.comingSoon}>{globalError}</Text>
                <BlazeButton
                  title="RETRY"
                  onPress={() => {
                    void fetchGlobal('load');
                  }}
                  style={styles.retryButton}
                />
              </View>
            ) : globalRows.length === 0 ? (
              <View style={styles.empty}>
                <FlameIcon width={36} height={48} />
                <Text style={styles.emptyTitle}>NO VERIFIED SCORES YET</Text>
                <Text style={styles.emptyDetail}>
                  Finish an online match to claim the first spot.
                </Text>
                <BlazeButton
                  title="PLAY"
                  onPress={() => navigation.navigate('Game')}
                  style={styles.emptyPlay}
                />
              </View>
            ) : (
              <BlazePanel padding={0}>
                {globalRows.map((entry) => (
                  <LeaderboardRow
                    key={`${entry.user_id}-${entry.rank}`}
                    rank={entry.rank}
                    playerName={entry.display_name}
                    score={entry.score}
                    isCurrentPlayer={Boolean(userId && entry.user_id === userId)}
                  />
                ))}
              </BlazePanel>
            )
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
    </BlazeScreenBackground>
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
  rowCurrent: {
    borderColor: colors.gold,
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
  playerName: {
    fontFamily: fontFamilies.bodyBold,
    fontSize: 13,
    color: colors.textPrimary,
  },
  playerNameCurrent: {
    color: colors.gold,
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
  loadingBlock: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xl,
  },
  retryButton: {
    marginTop: spacing.sm,
    alignSelf: 'center',
    minWidth: 140,
  },
});
