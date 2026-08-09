import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';

import { BlazeScreenBackground } from '../components/layout/BlazeScreenBackground';
import { BlazeButton } from '../components/ui/BlazeButton';
import { BlazePanel } from '../components/ui/BlazePanel';
import { isDailyChallengePracticeEnabled, isDailyChallengeRankedEnabled, isDailyLeaderboardEnabled } from '../config/featureFlags';
import { DailyStreakPanel } from '../components/dailyChallenge/DailyStreakPanel';
import {
  formatDurationSeconds,
  formatFriendlyChallengeDate,
  formatUtcResetCountdown,
} from '../challenge/utcResetCountdown';
import { getUtcChallengeDate } from '../challenge/utcChallengeDate';
import type { DailyChallengeScreenProps } from '../navigation/navigationTypes';
import { trackEvent } from '../monetization/analytics';
import { useAuthStore } from '../store/useAuthStore';
import { useDailyChallengeStore } from '../store/useDailyChallengeStore';
import { useDailyLeaderboardStore } from '../store/useDailyLeaderboardStore';
import { useGameStore } from '../store/useGameStore';
import {
  colors as kitColors,
  spacing as kitSpacing,
  typography as kitTypography,
} from '../theme/uiKit';

const CONTENT_MAX = 410;

function playerStatusLabel(uiStatus: string): string {
  switch (uiStatus) {
    case 'available':
      return 'READY';
    case 'in_progress':
      return 'IN PROGRESS';
    case 'completed':
      return 'COMPLETE';
    case 'practice_available':
      return 'PRACTICE';
    case 'sign_in_required':
      return 'SIGN IN REQUIRED';
    case 'offline':
      return 'OFFLINE';
    case 'error':
      return 'ERROR';
    default:
      return 'LOADING';
  }
}

export function DailyChallengeScreen({ navigation }: DailyChallengeScreenProps) {
  const { width } = useWindowDimensions();
  const columnWidth = Math.min(CONTENT_MAX, width - 24);
  const authStatus = useAuthStore((state) => state.authStatus);
  const retryOnlineAuth = useAuthStore((state) => state.retryOnlineAuth);
  const hydrateStatus = useDailyChallengeStore((state) => state.hydrateStatus);
  const startRankedAttempt = useDailyChallengeStore((state) => state.startRankedAttempt);
  const resumeRankedAttempt = useDailyChallengeStore((state) => state.resumeRankedAttempt);
  const startPracticeAttempt = useDailyChallengeStore((state) => state.startPracticeAttempt);
  const challenge = useDailyChallengeStore((state) => state.challenge);
  const rankedAttempt = useDailyChallengeStore((state) => state.rankedAttempt);
  const completionSummary = useDailyChallengeStore((state) => state.completionSummary);
  const uiStatus = useDailyChallengeStore((state) => state.uiStatus);
  const errorMessage = useDailyChallengeStore((state) => state.errorMessage);
  const isStarting = useDailyChallengeStore((state) => state.isStarting);
  const prepareDailyChallengeGame = useGameStore(
    (state) => state.prepareDailyChallengeGame,
  );
  const streakStatus = useDailyLeaderboardStore((s) => s.streakStatus);
  const loadStreakStatus = useDailyLeaderboardStore((s) => s.loadStreakStatus);
  const leaderboardEnabled = isDailyLeaderboardEnabled();

  const [nowMs, setNowMs] = useState(Date.now());
  const authOnline = authStatus === 'online';

  useEffect(() => {
    trackEvent('daily_challenge_viewed');
    void hydrateStatus(authOnline);
    void loadStreakStatus();
  }, [authOnline, hydrateStatus, loadStreakStatus]);

  useEffect(() => {
    const interval = setInterval(() => {
      const next = Date.now();
      setNowMs(next);
      const today = getUtcChallengeDate(next);
      if (challenge?.challengeDate && challenge.challengeDate !== today) {
        void hydrateStatus(authOnline);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [authOnline, challenge?.challengeDate, hydrateStatus]);

  const challengeDate = challenge?.challengeDate ?? getUtcChallengeDate(nowMs);
  const friendlyDate = formatFriendlyChallengeDate(challengeDate);
  const resetCountdown = formatUtcResetCountdown(nowMs);
  const rankedEnabled = isDailyChallengeRankedEnabled();
  const practiceEnabled = isDailyChallengePracticeEnabled();

  const officialScore =
    completionSummary?.score ??
    rankedAttempt?.verifiedScore ??
    null;

  const canStartRanked =
    authOnline &&
    rankedEnabled &&
    !isStarting &&
    (uiStatus === 'available' || uiStatus === 'in_progress');

  const canResume =
    authOnline &&
    rankedEnabled &&
    !isStarting &&
    uiStatus === 'in_progress';

  const canPractice =
    practiceEnabled &&
    !isStarting &&
    (uiStatus === 'completed' || uiStatus === 'practice_available');

  const launchRanked = useCallback(async () => {
    const session =
      uiStatus === 'in_progress'
        ? await resumeRankedAttempt()
        : await startRankedAttempt();
    await prepareDailyChallengeGame(session);
    navigation.navigate('Game');
  }, [
    navigation,
    prepareDailyChallengeGame,
    resumeRankedAttempt,
    startRankedAttempt,
    uiStatus,
  ]);

  const launchPractice = useCallback(async () => {
    const session = await startPracticeAttempt();
    await prepareDailyChallengeGame(session);
    navigation.navigate('Game');
  }, [navigation, prepareDailyChallengeGame, startPracticeAttempt]);

  const onStart = () => {
    if (!canStartRanked && !canResume) {
      return;
    }
    void launchRanked().catch(() => undefined);
  };

  const onPractice = () => {
    if (!canPractice) {
      return;
    }
    void launchPractice().catch(() => undefined);
  };

  const onRetry = () => {
    void hydrateStatus(authOnline);
  };

  const onSignIn = () => {
    void retryOnlineAuth().then(() => {
      const online = useAuthStore.getState().authStatus === 'online';
      return hydrateStatus(online);
    });
  };

  const bustLimit = challenge?.bustLimit ?? 3;
  const durationSeconds = challenge?.durationSeconds ?? 120;

  const statusDetail = useMemo(() => {
    if (uiStatus === 'sign_in_required') {
      return 'Sign in to start your one official ranked attempt.';
    }
    if (uiStatus === 'offline') {
      return errorMessage ?? 'Daily Blaze requires a connection for ranked play.';
    }
    if (uiStatus === 'error') {
      return errorMessage ?? "We couldn't load today's challenge.";
    }
    if (uiStatus === 'completed' || uiStatus === 'practice_available') {
      return 'Official attempt used. Leaderboard coming in the next phase.';
    }
    return 'Same deck. Same rules. One ranked attempt.';
  }, [errorMessage, uiStatus]);

  const isLoading = uiStatus === 'loading' || isStarting;

  return (
    <BlazeScreenBackground>
      <ScrollView
        contentContainerStyle={[styles.scroll, { width: columnWidth, maxWidth: CONTENT_MAX }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.eyebrow}>DAILY BLAZE</Text>
        <Text style={styles.title}>TODAY&apos;S CHALLENGE</Text>
        <Text style={styles.date} accessibilityLabel={`Challenge date ${friendlyDate}`}>
          {friendlyDate}
        </Text>

        <View style={styles.tagRow}>
          <Text style={styles.tag}>SAME DECK</Text>
          <Text style={styles.tag}>SAME RULES</Text>
          <Text style={styles.tag}>ONE RANKED ATTEMPT</Text>
        </View>

        <View style={styles.metricsRow}>
          <BlazePanel style={styles.metricPanel}>
            <Text style={styles.metricLabel}>TIME</Text>
            <Text style={styles.metricValue}>{formatDurationSeconds(durationSeconds)}</Text>
          </BlazePanel>
          <BlazePanel style={styles.metricPanel}>
            <Text style={styles.metricLabel}>BUST LIMIT</Text>
            <Text style={styles.metricValue}>{bustLimit}</Text>
          </BlazePanel>
        </View>

        <BlazePanel style={styles.panel}>
          <Text style={styles.panelLabel}>YOUR STATUS</Text>
          <Text style={styles.statusValue}>{playerStatusLabel(uiStatus)}</Text>
          <Text style={styles.panelDetail}>{statusDetail}</Text>
          {officialScore != null && uiStatus === 'completed' ? (
            <Text style={styles.scoreLine}>
              Official score: {officialScore.toLocaleString()}
            </Text>
          ) : null}
        </BlazePanel>

        {streakStatus ? (
          <DailyStreakPanel
            currentStreak={streakStatus.currentStreak}
            longestStreak={streakStatus.longestStreak}
            compact
          />
        ) : null}

        <BlazePanel style={styles.panel}>
          <Text style={styles.panelLabel}>RESETS AT</Text>
          <Text style={styles.panelValue}>00:00 UTC</Text>
          <Text
            style={styles.panelHint}
            accessibilityLabel={`New challenge in ${resetCountdown}`}
          >
            NEW CHALLENGE IN {resetCountdown}
          </Text>
        </BlazePanel>

        {isLoading ? (
          <ActivityIndicator color={kitColors.fire.orange} style={styles.loader} />
        ) : null}

        <View style={styles.actions}>
          {uiStatus === 'sign_in_required' ? (
            <BlazeButton
              label="SIGN IN TO COMPETE"
              size="lg"
              onPress={onSignIn}
              accessibilityLabel="Sign in to compete in Daily Blaze"
            />
          ) : uiStatus === 'error' ? (
            <>
              <Text style={styles.errorTitle}>DAILY BLAZE UNAVAILABLE</Text>
              <Text style={styles.errorDetail}>
                {errorMessage ?? "We couldn't load today's challenge."}
              </Text>
              <BlazeButton
                label="TRY AGAIN"
                onPress={onRetry}
                accessibilityLabel="Try loading Daily Blaze again"
              />
              <BlazeButton
                label="PLAY SOLO"
                variant="secondary"
                onPress={() => navigation.navigate('Game')}
                accessibilityLabel="Play solo mode"
              />
            </>
          ) : uiStatus === 'offline' ? (
            <>
              <Text style={styles.errorTitle}>DAILY BLAZE REQUIRES A CONNECTION</Text>
              <BlazeButton
                label="PLAY SOLO"
                size="lg"
                onPress={() => navigation.navigate('Game')}
                accessibilityLabel="Play solo mode"
              />
            </>
          ) : uiStatus === 'in_progress' ? (
            <BlazeButton
              label="RESUME DAILY CHALLENGE"
              size="lg"
              onPress={onStart}
              disabled={!canResume}
              loading={isStarting}
              accessibilityLabel="Resume Daily Blaze ranked attempt"
            />
          ) : uiStatus === 'completed' || uiStatus === 'practice_available' ? (
            <>
              {officialScore != null ? (
                <BlazePanel style={styles.completedPanel}>
                  <Text style={styles.panelLabel}>YOUR SCORE</Text>
                  <Text style={styles.completedScore}>
                    {officialScore.toLocaleString()}
                  </Text>
                  <Text style={styles.panelHint}>Official attempt used.</Text>
                </BlazePanel>
              ) : null}
              {canPractice ? (
                <BlazeButton
                  label="PRACTICE"
                  variant="secondary"
                  onPress={onPractice}
                  accessibilityLabel="Start Daily Blaze practice run"
                />
              ) : null}
              {leaderboardEnabled ? (
                <BlazeButton
                  label="VIEW LEADERBOARD"
                  variant="ghost"
                  onPress={() => navigation.navigate('DailyChallengeLeaderboard')}
                  accessibilityLabel="View Daily Blaze leaderboard"
                />
              ) : null}
            </>
          ) : (
            <BlazeButton
              label="START DAILY CHALLENGE"
              size="lg"
              onPress={onStart}
              disabled={!canStartRanked}
              loading={isStarting}
              accessibilityLabel="Start Daily Blaze ranked attempt"
            />
          )}
        </View>
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
    letterSpacing: 1,
  },
  date: {
    color: kitColors.text.secondary,
    fontSize: 16,
    marginBottom: kitSpacing.xs,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    color: kitColors.fire.gold,
    fontFamily: kitTypography.families.condensed,
    fontSize: 10,
    letterSpacing: 1,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,138,0,0.35)',
  },
  metricsRow: {
    flexDirection: 'row',
    gap: kitSpacing.sm,
  },
  metricPanel: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  metricLabel: {
    color: kitColors.fire.gold,
    fontSize: 11,
    letterSpacing: 1,
    fontFamily: kitTypography.families.condensed,
  },
  metricValue: {
    color: kitColors.text.primary,
    fontSize: 28,
    fontFamily: kitTypography.families.display,
  },
  panel: {
    gap: kitSpacing.xs,
  },
  completedPanel: {
    gap: kitSpacing.xs,
    alignItems: 'center',
  },
  panelLabel: {
    color: kitColors.fire.gold,
    fontSize: 12,
    letterSpacing: 1.2,
    fontFamily: kitTypography.families.condensed,
  },
  panelValue: {
    color: kitColors.text.primary,
    fontSize: 22,
    fontFamily: kitTypography.families.display,
  },
  statusValue: {
    color: kitColors.text.primary,
    fontSize: 24,
    fontFamily: kitTypography.families.display,
  },
  panelHint: {
    color: kitColors.text.secondary,
    fontSize: 13,
  },
  panelDetail: {
    color: kitColors.text.secondary,
    fontSize: 14,
    lineHeight: 20,
  },
  scoreLine: {
    color: kitColors.text.primary,
    fontSize: 16,
    marginTop: kitSpacing.xs,
  },
  completedScore: {
    color: kitColors.fire.gold,
    fontSize: 32,
    fontFamily: kitTypography.families.display,
  },
  actions: {
    gap: kitSpacing.sm,
    marginTop: kitSpacing.md,
  },
  errorTitle: {
    color: kitColors.status.danger,
    textAlign: 'center',
    fontFamily: kitTypography.families.condensed,
    fontWeight: '700',
    fontSize: 13,
    letterSpacing: 0.8,
  },
  errorDetail: {
    color: kitColors.text.secondary,
    textAlign: 'center',
    fontSize: 13,
    marginBottom: kitSpacing.sm,
  },
  loader: {
    marginVertical: kitSpacing.sm,
  },
  footer: {
    position: 'absolute',
    left: kitSpacing.md,
    right: kitSpacing.md,
    bottom: kitSpacing.lg,
  },
});
