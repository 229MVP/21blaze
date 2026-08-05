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

import { CurrentPlayerRankCard } from '../components/leaderboards/CurrentPlayerRankCard';
import { ChallengeLeaderboardRow } from '../components/leaderboards/LeaderboardRow';
import { BlazeScreenBackground } from '../components/layout/BlazeScreenBackground';
import { BlazeSegmentedControl } from '../components/Navigation/BlazeSegmentedControl';
import { BlazeButton } from '../components/ui/BlazeButton';
import { BlazePanel } from '../components/ui/BlazePanel';
import {
  isDailyLeaderboardEnabled,
  isLeaderboardNearbyEnabled,
  isWeeklyLeaderboardEnabled,
} from '../config/featureFlags';
import { useInterstitialScreenTracking } from '../hooks/useInterstitialScreenTracking';
import type { DailyChallengeLeaderboardScreenProps } from '../navigation/navigationTypes';
import { useAuthStore } from '../store/useAuthStore';
import { useDailyChallengeStore } from '../store/useDailyChallengeStore';
import { useLeaderboardStore } from '../store/useLeaderboardStore';
import {
  colors as kitColors,
  spacing as kitSpacing,
  typography as kitTypography,
} from '../theme/uiKit';
import { WeeklyLeaderboardPanel } from './WeeklyLeaderboardScreen';

const CONTENT_MAX = 410;

function formatDuration(ms: number): string {
  if (ms <= 0) {
    return 'FINAL';
  }
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}H ${minutes}M`;
  }
  return `${minutes}M`;
}

export function DailyLeaderboardScreen({ navigation }: DailyChallengeLeaderboardScreenProps) {
  useInterstitialScreenTracking('leaderboard');
  const { width } = useWindowDimensions();
  const columnWidth = Math.min(CONTENT_MAX, width - 24);
  const authStatus = useAuthStore((state) => state.authStatus);
  const challenge = useDailyChallengeStore((state) => state.challenge);
  const verificationStatus = useDailyChallengeStore((state) => state.verificationStatus);
  const rankedAttempt = useDailyChallengeStore((state) => state.rankedAttempt);

  const selectedTab = useLeaderboardStore((state) => state.selectedTab);
  const setSelectedTab = useLeaderboardStore((state) => state.setSelectedTab);
  const dailyRows = useLeaderboardStore((state) => state.dailyRows);
  const nearbyDailyRows = useLeaderboardStore((state) => state.nearbyDailyRows);
  const currentDailyRank = useLeaderboardStore((state) => state.currentDailyRank);
  const currentWeeklyRank = useLeaderboardStore((state) => state.currentWeeklyRank);
  const currentDailyChallengePoints = useLeaderboardStore(
    (state) => state.currentDailyChallengePoints,
  );
  const currentWeeklyChallengePoints = useLeaderboardStore(
    (state) => state.currentWeeklyChallengePoints,
  );
  const dailyParticipantCount = useLeaderboardStore((state) => state.dailyParticipantCount);
  const challengeDate = useLeaderboardStore((state) => state.challengeDate);
  const endsAt = useLeaderboardStore((state) => state.endsAt);
  const dailyFinalized = useLeaderboardStore((state) => state.dailyFinalized);
  const lastUpdatedAt = useLeaderboardStore((state) => state.lastUpdatedAt);
  const isLoading = useLeaderboardStore((state) => state.isLoading);
  const isRefreshing = useLeaderboardStore((state) => state.isRefreshing);
  const isOfflineCache = useLeaderboardStore((state) => state.isOfflineCache);
  const error = useLeaderboardStore((state) => state.error);
  const loadDailyLeaderboard = useLeaderboardStore((state) => state.loadDailyLeaderboard);
  const refreshDaily = useLeaderboardStore((state) => state.refreshDaily);
  const refreshWeekly = useLeaderboardStore((state) => state.refreshWeekly);
  const weeklyDaysCompleted = useLeaderboardStore((state) =>
    state.weeklyRows.find((row) => row.isCurrentPlayer)?.verifiedDaysCompleted ?? null,
  );

  const [nowMs, setNowMs] = useState(Date.now());
  const dailyEnabled = isDailyLeaderboardEnabled();
  const weeklyEnabled = isWeeklyLeaderboardEnabled();
  const online = authStatus === 'online';

  useEffect(() => {
    const interval = setInterval(() => setNowMs(Date.now()), 30_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (dailyEnabled) {
      void loadDailyLeaderboard(challenge?.challengeDate);
    }
  }, [challenge?.challengeDate, dailyEnabled, loadDailyLeaderboard]);

  const timeRemainingMs = endsAt ? Date.parse(endsAt) - nowMs : 0;
  const timeLabel = dailyFinalized ? 'FINAL' : formatDuration(timeRemainingMs);

  const tabOptions = useMemo(() => {
    const options: Array<{ label: string; value: 'daily' | 'weekly' }> = [];
    if (dailyEnabled) {
      options.push({ label: 'DAILY', value: 'daily' });
    }
    if (weeklyEnabled) {
      options.push({ label: 'WEEKLY', value: 'weekly' });
    }
    return options;
  }, [dailyEnabled, weeklyEnabled]);

  const playerRankState = useMemo(() => {
    if (!dailyEnabled && !weeklyEnabled) {
      return 'unavailable' as const;
    }
    if (isOfflineCache || !online) {
      return 'offline' as const;
    }
    if (verificationStatus === 'submitting') {
      return 'verification_pending' as const;
    }
    if (rankedAttempt?.status !== 'completed' && verificationStatus !== 'verified') {
      return 'not_attempted' as const;
    }
    if (selectedTab === 'daily' && currentDailyRank != null) {
      return 'ranked' as const;
    }
    if (selectedTab === 'weekly' && currentWeeklyRank != null) {
      return 'ranked' as const;
    }
    return 'not_ranked' as const;
  }, [
    currentDailyRank,
    currentWeeklyRank,
    dailyEnabled,
    isOfflineCache,
    online,
    rankedAttempt?.status,
    selectedTab,
    verificationStatus,
    weeklyEnabled,
  ]);

  const onRefresh = useCallback(() => {
    if (!online) {
      return;
    }
    if (selectedTab === 'daily') {
      void refreshDaily();
    } else {
      void refreshWeekly();
    }
  }, [online, refreshDaily, refreshWeekly, selectedTab]);

  if (!dailyEnabled && !weeklyEnabled) {
    return (
      <BlazeScreenBackground>
        <View style={[styles.disabled, { width: columnWidth }]}>
          <Text style={styles.title}>LEADERBOARDS DISABLED</Text>
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
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            enabled={online}
            tintColor={kitColors.fire.orange}
          />
        }
      >
        <Text style={styles.title}>
          {selectedTab === 'daily' ? 'DAILY LEADERBOARD' : 'WEEKLY LEADERBOARD'}
        </Text>
        <Text style={styles.subtitle}>
          {selectedTab === 'daily'
            ? challengeDate ?? challenge?.challengeDate ?? 'TODAY'
            : 'UTC week'}
        </Text>
        {selectedTab === 'daily' ? (
          <Text style={styles.timeMeta}>
            {timeLabel} · {dailyParticipantCount} verified
          </Text>
        ) : null}

        {tabOptions.length > 1 ? (
          <BlazeSegmentedControl
            options={tabOptions}
            selectedValue={selectedTab}
            onChange={(value) => setSelectedTab(value)}
          />
        ) : null}

        <CurrentPlayerRankCard
          state={playerRankState}
          rank={selectedTab === 'daily' ? currentDailyRank : currentWeeklyRank}
          primaryLabel={selectedTab === 'daily' ? 'VERIFIED SCORE' : 'CHALLENGE POINTS'}
          primaryValue={
            selectedTab === 'daily'
              ? rankedAttempt?.verifiedScore ?? null
              : currentWeeklyChallengePoints
          }
          secondaryLabel={selectedTab === 'daily' ? 'POINTS' : 'DAYS'}
          secondaryValue={
            selectedTab === 'daily' ? currentDailyChallengePoints : weeklyDaysCompleted
          }
          participantCount={selectedTab === 'daily' ? dailyParticipantCount : undefined}
          staleLabel={
            isOfflineCache
              ? `LAST UPDATED ${lastUpdatedAt ? new Date(lastUpdatedAt).toLocaleString() : ''}`
              : null
          }
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {!online ? (
          <Text style={styles.offline}>CONNECT ONLINE TO REFRESH RANKINGS</Text>
        ) : null}

        {selectedTab === 'daily' ? (
          <BlazePanel padding={0} style={styles.panel}>
            {isLoading ? (
              <ActivityIndicator color={kitColors.fire.orange} style={styles.loader} />
            ) : dailyRows.length === 0 ? (
              <Text style={styles.empty}>NO VERIFIED SCORES YET</Text>
            ) : (
              dailyRows.map((row) => (
                <ChallengeLeaderboardRow
                  key={`daily-${row.rank}-${row.playerName}`}
                  mode="daily"
                  rank={row.rank}
                  playerName={row.playerName}
                  score={row.score}
                  exact21Count={row.exact21Count}
                  fiveCardClears={row.fiveCardClears}
                  bestMultiplier={row.bestMultiplier}
                  profileFrameId={row.profileFrameId}
                  playerTitleId={row.playerTitleId}
                  isCurrentPlayer={row.isCurrentPlayer}
                />
              ))
            )}
          </BlazePanel>
        ) : (
          <WeeklyLeaderboardPanel loading={isLoading} />
        )}

        {selectedTab === 'daily' &&
        isLeaderboardNearbyEnabled() &&
        nearbyDailyRows.length > 0 ? (
          <View style={styles.nearby}>
            <Text style={styles.nearbyTitle}>NEARBY PLAYERS</Text>
            {nearbyDailyRows.map((row) => (
              <Text key={`nearby-daily-${row.rank}`} style={styles.nearbyLine}>
                #{row.rank} {row.playerName} · {row.score}
                {row.isCurrentPlayer ? ' (YOU)' : ''}
              </Text>
            ))}
          </View>
        ) : null}
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
    alignSelf: 'center',
    justifyContent: 'center',
    gap: kitSpacing.md,
    padding: kitSpacing.lg,
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
  },
  timeMeta: {
    color: kitColors.text.muted,
    fontSize: 12,
  },
  panel: {
    overflow: 'hidden',
  },
  loader: {
    padding: kitSpacing.xl,
  },
  empty: {
    color: kitColors.text.secondary,
    padding: kitSpacing.xl,
    textAlign: 'center',
  },
  nearby: {
    gap: kitSpacing.xs,
  },
  nearbyTitle: {
    color: kitColors.fire.gold,
    fontSize: 12,
    letterSpacing: 1,
    fontFamily: kitTypography.families.condensed,
  },
  nearbyLine: {
    color: kitColors.text.secondary,
    fontSize: 13,
  },
  error: {
    color: kitColors.status.danger,
    textAlign: 'center',
  },
  offline: {
    color: kitColors.fire.orange,
    textAlign: 'center',
    fontSize: 13,
  },
  footer: {
    position: 'absolute',
    left: kitSpacing.md,
    right: kitSpacing.md,
    bottom: kitSpacing.lg,
  },
});
