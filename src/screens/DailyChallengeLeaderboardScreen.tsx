import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';

import type { DailyLeaderboardEntry } from '../challenge/dailyLeaderboardTypes';
import { LeaderboardPodium } from '../components/dailyChallenge/LeaderboardPodium';
import { DailyStreakPanel } from '../components/dailyChallenge/DailyStreakPanel';
import { LeaderboardTable } from '../components/leaderboard/LeaderboardTable';
import { BlazeScreenBackground } from '../components/layout/BlazeScreenBackground';
import { BlazeButton } from '../components/ui/BlazeButton';
import { BlazePanel } from '../components/ui/BlazePanel';
import { isDailyLeaderboardEnabled } from '../config/featureFlags';
import { formatFriendlyChallengeDate } from '../challenge/utcResetCountdown';
import type { DailyChallengeLeaderboardScreenProps } from '../navigation/navigationTypes';
import { useReducedMotionSetting } from '../hooks/useReducedMotionSetting';
import { useDailyChallengeStore } from '../store/useDailyChallengeStore';
import { useDailyLeaderboardStore } from '../store/useDailyLeaderboardStore';
import {
  colors as kitColors,
  spacing as kitSpacing,
  typography as kitTypography,
} from '../theme/uiKit';

const CONTENT_MAX = 410;

function formatWeekLabel(weekStart: string, weekEnd: string): string {
  return `${formatFriendlyChallengeDate(weekStart)} – ${formatFriendlyChallengeDate(weekEnd)}`;
}

export function DailyChallengeLeaderboardScreen({
  navigation,
}: DailyChallengeLeaderboardScreenProps) {
  const { width } = useWindowDimensions();
  const columnWidth = Math.min(CONTENT_MAX, width - 24);
  const reduceMotion = useReducedMotionSetting();
  const enabled = isDailyLeaderboardEnabled();

  const challenge = useDailyChallengeStore((s) => s.challenge);
  const tab = useDailyLeaderboardStore((s) => s.tab);
  const setTab = useDailyLeaderboardStore((s) => s.setTab);
  const dailyPage = useDailyLeaderboardStore((s) => s.dailyPage);
  const weeklyPage = useDailyLeaderboardStore((s) => s.weeklyPage);
  const myDailyEntry = useDailyLeaderboardStore((s) => s.myDailyEntry);
  const myWeeklyEntry = useDailyLeaderboardStore((s) => s.myWeeklyEntry);
  const streakStatus = useDailyLeaderboardStore((s) => s.streakStatus);
  const loading = useDailyLeaderboardStore((s) => s.loading);
  const loadingMore = useDailyLeaderboardStore((s) => s.loadingMore);
  const errorMessage = useDailyLeaderboardStore((s) => s.errorMessage);
  const offline = useDailyLeaderboardStore((s) => s.offline);
  const loadDaily = useDailyLeaderboardStore((s) => s.loadDailyLeaderboard);
  const loadMoreDaily = useDailyLeaderboardStore((s) => s.loadMoreDaily);
  const loadWeekly = useDailyLeaderboardStore((s) => s.loadWeeklyLeaderboard);
  const loadMoreWeekly = useDailyLeaderboardStore((s) => s.loadMoreWeekly);
  const loadStreak = useDailyLeaderboardStore((s) => s.loadStreakStatus);

  const [refreshing, setRefreshing] = useState(false);

  const challengeId = challenge?.challengeId;
  const challengeDate = challenge?.challengeDate;

  const hydrate = useCallback(async (refresh = false) => {
    void loadStreak({ refresh });
    if (!challengeId) {
      return;
    }
    if (tab === 'daily') {
      await loadDaily(challengeId, { refresh });
    } else {
      await loadWeekly({ refresh });
    }
  }, [challengeId, loadDaily, loadStreak, loadWeekly, tab]);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    void hydrate();
  }, [enabled, hydrate]);

  const onRefresh = () => {
    setRefreshing(true);
    void hydrate(true).finally(() => setRefreshing(false));
  };

  const dailyTableEntries = useMemo(() => {
    const entries: DailyLeaderboardEntry[] = dailyPage?.entries ?? [];
    return entries
      .filter((e: DailyLeaderboardEntry) => e.rank > 3)
      .map((e: DailyLeaderboardEntry) => ({
        rank: e.rank,
        playerName: e.displayName,
        score: e.score,
        isCurrentPlayer: e.isCurrentPlayer,
        subtitle:
          e.exact21Count != null
            ? `${e.exact21Count} exact 21`
            : undefined,
      }));
  }, [dailyPage?.entries]);

  const weeklyTableEntries = useMemo(() => {
    const entries = weeklyPage?.entries ?? [];
    return entries.map((e) => ({
      rank: e.rank,
      playerName: e.displayName,
      score: e.weeklyScore,
      isCurrentPlayer: e.isCurrentPlayer,
      subtitle: `${e.daysPlayed}/7 days`,
    }));
  }, [weeklyPage?.entries]);

  const podiumEntries: DailyLeaderboardEntry[] =
    dailyPage?.entries.filter((e: DailyLeaderboardEntry) => e.rank <= 3) ?? [];

  if (!enabled) {
    return (
      <BlazeScreenBackground>
        <View style={styles.disabled}>
          <Text style={styles.title}>LEADERBOARD DISABLED</Text>
          <BlazeButton label="BACK" variant="ghost" onPress={() => navigation.goBack()} />
        </View>
      </BlazeScreenBackground>
    );
  }

  return (
    <BlazeScreenBackground>
      <ScrollView
        contentContainerStyle={[styles.scroll, { width: columnWidth, maxWidth: CONTENT_MAX }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={kitColors.fire.orange} />
        }
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.eyebrow}>DAILY BLAZE</Text>
        <Text style={styles.title}>LEADERBOARD</Text>

        <View style={styles.tabs}>
          <BlazeButton
            label="DAILY"
            size="sm"
            variant={tab === 'daily' ? 'primary' : 'secondary'}
            onPress={() => setTab('daily')}
            accessibilityLabel="Daily leaderboard tab"
          />
          <BlazeButton
            label="WEEKLY"
            size="sm"
            variant={tab === 'weekly' ? 'primary' : 'secondary'}
            onPress={() => setTab('weekly')}
            accessibilityLabel="Weekly leaderboard tab"
          />
        </View>

        {streakStatus ? (
          <DailyStreakPanel
            currentStreak={streakStatus.currentStreak}
            longestStreak={streakStatus.longestStreak}
            compact
          />
        ) : null}

        {offline ? (
          <BlazePanel style={styles.offlinePanel}>
            <Text style={styles.offlineTitle}>LEADERBOARD UNAVAILABLE OFFLINE</Text>
            <Text style={styles.offlineBody}>
              Connect to view live rankings. Cached streak may be shown with last updated time.
            </Text>
            {streakStatus?.updatedAt ? (
              <Text style={styles.offlineHint}>
                LAST UPDATED {new Date(streakStatus.updatedAt).toLocaleString()}
              </Text>
            ) : null}
          </BlazePanel>
        ) : null}

        {errorMessage && !offline ? (
          <Text style={styles.error}>{errorMessage}</Text>
        ) : null}

        {loading && !dailyPage && !weeklyPage ? (
          <ActivityIndicator color={kitColors.fire.orange} style={styles.loader} />
        ) : null}

        {tab === 'daily' ? (
          <>
            <Text style={styles.sectionLabel}>
              {challengeDate ? formatFriendlyChallengeDate(challengeDate) : 'TODAY'}
            </Text>
            {podiumEntries.length > 0 ? (
              <LeaderboardPodium entries={podiumEntries} reduceMotion={reduceMotion} />
            ) : null}
            <LeaderboardTable
              entries={dailyTableEntries}
              loading={loading}
              emptyText="NO VERIFIED SCORES YET"
            />
            {myDailyEntry && myDailyEntry.rank > 3 ? (
              <BlazePanel style={styles.myRank}>
                <Text style={styles.myRankLabel}>YOUR RANK</Text>
                <Text style={styles.myRankValue}>
                  #{myDailyEntry.rank} · {myDailyEntry.score.toLocaleString()}
                </Text>
              </BlazePanel>
            ) : null}
            {dailyPage &&
            dailyPage.offset + dailyPage.entries.length < dailyPage.totalPlayers ? (
              <BlazeButton
                label={loadingMore ? 'LOADING…' : 'LOAD MORE'}
                variant="secondary"
                disabled={loadingMore}
                onPress={() => challengeId && void loadMoreDaily(challengeId)}
              />
            ) : null}
          </>
        ) : (
          <>
            <Text style={styles.sectionLabel}>
              {weeklyPage
                ? `WEEKLY BLAZE · ${formatWeekLabel(weeklyPage.weekStart, weeklyPage.weekEnd)}`
                : 'WEEKLY BLAZE'}
            </Text>
            {myWeeklyEntry ? (
              <BlazePanel style={styles.weekSummary}>
                <Text style={styles.weekLabel}>YOUR WEEKLY SCORE</Text>
                <Text style={styles.weekScore}>
                  {myWeeklyEntry.weeklyScore.toLocaleString()}
                </Text>
                <Text style={styles.weekMeta}>
                  Days played {myWeeklyEntry.daysPlayed}/7 · Rank #{myWeeklyEntry.rank}
                </Text>
                <Text style={styles.weekHint}>
                  Weekly score is the sum of your official Daily Blaze scores.
                </Text>
              </BlazePanel>
            ) : null}
            <LeaderboardTable
              entries={weeklyTableEntries}
              loading={loading}
              emptyText="NO WEEKLY SCORES YET"
            />
            {weeklyPage &&
            weeklyPage.offset + weeklyPage.entries.length < weeklyPage.totalPlayers ? (
              <BlazeButton
                label={loadingMore ? 'LOADING…' : 'LOAD MORE'}
                variant="secondary"
                disabled={loadingMore}
                onPress={() => void loadMoreWeekly(weeklyPage.weekStart)}
              />
            ) : null}
          </>
        )}
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
  disabled: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: kitSpacing.md,
    padding: kitSpacing.lg,
  },
  eyebrow: {
    color: kitColors.fire.orange,
    letterSpacing: 2,
    fontSize: 12,
    fontFamily: kitTypography.families.condensed,
  },
  title: {
    color: kitColors.text.primary,
    fontSize: 28,
    fontFamily: kitTypography.families.display,
  },
  tabs: {
    flexDirection: 'row',
    gap: 8,
  },
  sectionLabel: {
    color: kitColors.fire.gold,
    fontFamily: kitTypography.families.condensed,
    fontSize: 12,
    letterSpacing: 1,
  },
  loader: {
    marginVertical: kitSpacing.md,
  },
  error: {
    color: kitColors.status.danger,
    textAlign: 'center',
  },
  offlinePanel: {
    gap: 6,
  },
  offlineTitle: {
    color: kitColors.fire.orange,
    fontFamily: kitTypography.families.condensed,
    fontWeight: '700',
    fontSize: 12,
    letterSpacing: 0.8,
  },
  offlineBody: {
    color: kitColors.text.secondary,
    fontSize: 13,
    lineHeight: 18,
  },
  offlineHint: {
    color: kitColors.text.muted,
    fontSize: 11,
  },
  myRank: {
    alignItems: 'center',
    gap: 4,
  },
  myRankLabel: {
    color: kitColors.text.secondary,
    fontSize: 11,
    letterSpacing: 1,
  },
  myRankValue: {
    color: kitColors.fire.gold,
    fontFamily: kitTypography.families.display,
    fontSize: 22,
  },
  weekSummary: {
    gap: 4,
    alignItems: 'center',
  },
  weekLabel: {
    color: kitColors.text.secondary,
    fontSize: 11,
    letterSpacing: 1,
  },
  weekScore: {
    color: kitColors.fire.gold,
    fontFamily: kitTypography.families.display,
    fontSize: 32,
  },
  weekMeta: {
    color: kitColors.text.primary,
    fontSize: 14,
  },
  weekHint: {
    color: kitColors.text.secondary,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
  },
  footer: {
    position: 'absolute',
    left: kitSpacing.md,
    right: kitSpacing.md,
    bottom: kitSpacing.lg,
  },
});
