import { useEffect } from 'react';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { LeaderboardTable } from '../components/leaderboard/LeaderboardTable';
import { BlazeScreenBackground } from '../components/layout/BlazeScreenBackground';
import { BlazeButton } from '../components/ui/BlazeButton';
import type { DailyChallengeLeaderboardScreenProps } from '../navigation/navigationTypes';
import { useDailyChallengeStore } from '../store/useDailyChallengeStore';
import {
  colors as kitColors,
  spacing as kitSpacing,
  typography as kitTypography,
} from '../theme/uiKit';

const CONTENT_MAX = 410;

export function DailyChallengeLeaderboardScreen({
  navigation,
}: DailyChallengeLeaderboardScreenProps) {
  const { width } = useWindowDimensions();
  const columnWidth = Math.min(CONTENT_MAX, width - 24);
  const challenge = useDailyChallengeStore((state) => state.challenge);
  const entries = useDailyChallengeStore((state) => state.leaderboardEntries);
  const loading = useDailyChallengeStore((state) => state.leaderboardLoading);
  const loadLeaderboard = useDailyChallengeStore((state) => state.loadLeaderboard);

  useEffect(() => {
    void loadLeaderboard(challenge?.challengeDate);
  }, [challenge?.challengeDate, loadLeaderboard]);

  return (
    <BlazeScreenBackground>
      <ScrollView
        contentContainerStyle={[styles.scroll, { width: columnWidth, maxWidth: CONTENT_MAX }]}
      >
        <Text style={styles.title}>DAILY LEADERBOARD</Text>
        <Text style={styles.subtitle}>{challenge?.challengeDate ?? 'TODAY'}</Text>
        <LeaderboardTable
          entries={entries.map((entry) => ({
            rank: entry.rank,
            playerName: entry.playerName,
            score: entry.score,
            isCurrentPlayer: entry.isCurrentPlayer,
            subtitle: `${entry.lanesCleared} clears`,
          }))}
          loading={loading}
          emptyText="NO VERIFIED SCORES YET"
        />
      </ScrollView>
      <View style={styles.footer}>
        <BlazeButton label="BACK" variant="ghost" onPress={() => navigation.goBack()} />
      </View>
    </BlazeScreenBackground>
  );
}

const styles = StyleSheet.create({
  scroll: {
    alignSelf: 'center',
    paddingTop: kitSpacing.xl,
    paddingBottom: 120,
    gap: kitSpacing.md,
  },
  title: {
    color: kitColors.text.primary,
    fontSize: 28,
    fontFamily: kitTypography.families.display,
    letterSpacing: 1,
  },
  subtitle: {
    color: kitColors.text.secondary,
    fontSize: 14,
    marginBottom: kitSpacing.sm,
  },
  footer: {
    position: 'absolute',
    left: kitSpacing.md,
    right: kitSpacing.md,
    bottom: kitSpacing.lg,
  },
});
