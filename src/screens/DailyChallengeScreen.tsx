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
import {
  isDailyChallengePracticeEnabled,
  isDailyChallengeRankedEnabled,
  isDailyLeaderboardEnabled,
} from '../config/featureFlags';
import { getUtcChallengeDate } from '../game/challenge/createDailyChallenge';
import type { DailyChallengeScreenProps } from '../navigation/navigationTypes';
import { trackEvent } from '../monetization/analytics';
import { useAuthStore } from '../store/useAuthStore';
import { useDailyChallengeStore } from '../store/useDailyChallengeStore';
import { useGameStore } from '../store/useGameStore';
import {
  colors as kitColors,
  spacing as kitSpacing,
  typography as kitTypography,
} from '../theme/uiKit';

const CONTENT_MAX = 410;

function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}H ${minutes}M`;
  }
  return `${minutes}M`;
}

function statusCopy(
  uiStatus: string,
  offlineMessage: string | null,
): { title: string; detail: string } {
  switch (uiStatus) {
    case 'available':
      return {
        title: 'RANKED ATTEMPT AVAILABLE',
        detail: 'One official attempt per UTC day. Same deck for every player.',
      };
    case 'in_progress':
      return {
        title: 'RANKED ATTEMPT IN PROGRESS',
        detail: 'Resume your attempt or finish before the UTC day ends.',
      };
    case 'completed':
      return {
        title: 'RANKED ATTEMPT COMPLETE',
        detail: 'Your verified score is locked for today’s leaderboard.',
      };
    case 'abandoned':
      return {
        title: 'RANKED ATTEMPT UNAVAILABLE',
        detail: 'Today’s ranked attempt has been used or expired.',
      };
    case 'offline':
      return {
        title: 'OFFLINE',
        detail: offlineMessage ?? 'CONNECT ONLINE FOR A RANKED ATTEMPT',
      };
    default:
      return {
        title: 'LOADING CHALLENGE',
        detail: 'Fetching today’s UTC challenge…',
      };
  }
}

export function DailyChallengeScreen({ navigation }: DailyChallengeScreenProps) {
  const { width } = useWindowDimensions();
  const columnWidth = Math.min(CONTENT_MAX, width - 24);
  const authStatus = useAuthStore((state) => state.authStatus);
  const hydrateStatus = useDailyChallengeStore((state) => state.hydrateStatus);
  const startAttempt = useDailyChallengeStore((state) => state.startAttempt);
  const challenge = useDailyChallengeStore((state) => state.challenge);
  const rankedAttempt = useDailyChallengeStore((state) => state.rankedAttempt);
  const verifiedResult = useDailyChallengeStore((state) => state.verifiedResult);
  const streakCurrent = useDailyChallengeStore((state) => state.streakCurrent);
  const uiStatus = useDailyChallengeStore((state) => state.uiStatus);
  const errorMessage = useDailyChallengeStore((state) => state.errorMessage);
  const getTimeRemainingMs = useDailyChallengeStore((state) => state.getTimeRemainingMs);
  const prepareDailyChallengeGame = useGameStore(
    (state) => state.prepareDailyChallengeGame,
  );

  const [busy, setBusy] = useState(false);
  const [nowMs, setNowMs] = useState(Date.now());

  useEffect(() => {
    trackEvent('daily_challenge_viewed');
    void hydrateStatus();
  }, [hydrateStatus]);

  useEffect(() => {
    const interval = setInterval(() => setNowMs(Date.now()), 30_000);
    return () => clearInterval(interval);
  }, []);

  const challengeDate = challenge?.challengeDate ?? getUtcChallengeDate(nowMs);
  const timeRemainingMs = getTimeRemainingMs(nowMs);
  const copy = statusCopy(uiStatus, errorMessage);
  const rankedEnabled = isDailyChallengeRankedEnabled();
  const practiceEnabled = isDailyChallengePracticeEnabled();
  const leaderboardEnabled = isDailyLeaderboardEnabled();
  const online = authStatus === 'online';

  const canStartRanked = useMemo(() => {
    if (!online || !rankedEnabled || busy) {
      return false;
    }
    return uiStatus === 'available' || uiStatus === 'in_progress';
  }, [busy, online, rankedEnabled, uiStatus]);

  const canPractice = useMemo(() => {
    if (!practiceEnabled || busy) {
      return false;
    }
    if (uiStatus === 'offline' && challenge) {
      return true;
    }
    return Boolean(challenge) && uiStatus !== 'loading';
  }, [busy, challenge, practiceEnabled, uiStatus]);

  const launchAttempt = useCallback(
    async (attemptType: 'ranked' | 'practice') => {
      setBusy(true);
      try {
        const session = await startAttempt(attemptType);
        await prepareDailyChallengeGame(session);
        navigation.navigate('Game');
      } catch (error) {
        setBusy(false);
        throw error;
      }
    },
    [navigation, prepareDailyChallengeGame, startAttempt],
  );

  const onStartRanked = () => {
    if (!canStartRanked) {
      return;
    }
    void launchAttempt('ranked').catch(() => undefined);
  };

  const onPractice = () => {
    if (!canPractice) {
      return;
    }
    void launchAttempt('practice').catch(() => undefined);
  };

  return (
    <BlazeScreenBackground>
      <ScrollView
        contentContainerStyle={[styles.scroll, { width: columnWidth, maxWidth: CONTENT_MAX }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.eyebrow}>UTC CHALLENGE</Text>
        <Text style={styles.title}>DAILY CHALLENGE</Text>
        <Text style={styles.date}>{challengeDate}</Text>

        <BlazePanel style={styles.panel}>
          <Text style={styles.panelLabel}>TIME REMAINING</Text>
          <Text style={styles.panelValue}>{formatDuration(timeRemainingMs)}</Text>
          <Text style={styles.panelHint}>Resets at UTC midnight</Text>
        </BlazePanel>

        <BlazePanel style={styles.panel}>
          <Text style={styles.panelLabel}>{copy.title}</Text>
          <Text style={styles.panelDetail}>{copy.detail}</Text>
          {rankedAttempt?.verifiedScore != null ? (
            <Text style={styles.scoreLine}>
              Verified score: {rankedAttempt.verifiedScore}
            </Text>
          ) : null}
          {verifiedResult?.rank ? (
            <Text style={styles.scoreLine}>Daily rank: #{verifiedResult.rank}</Text>
          ) : null}
        </BlazePanel>

        <BlazePanel style={styles.panel}>
          <Text style={styles.panelLabel}>CHALLENGE STREAK</Text>
          <Text style={styles.panelValue}>{streakCurrent}</Text>
          <Text style={styles.panelHint}>
            Verified ranked completions on consecutive UTC days
          </Text>
        </BlazePanel>

        <BlazePanel style={styles.panel}>
          <Text style={styles.rulesTitle}>RULES</Text>
          <Text style={styles.ruleLine}>• Same seeded deck for every player today</Text>
          <Text style={styles.ruleLine}>• One ranked attempt per UTC day</Text>
          <Text style={styles.ruleLine}>• Unlimited practice — never ranks</Text>
          <Text style={styles.ruleLine}>• Ranked requires an online connection</Text>
          <Text style={styles.ruleLine}>• Attempt consumed after the first move</Text>
        </BlazePanel>

        {uiStatus === 'loading' || busy ? (
          <ActivityIndicator color={kitColors.fire.orange} style={styles.loader} />
        ) : null}

        {errorMessage && uiStatus !== 'offline' ? (
          <Text style={styles.error}>{errorMessage}</Text>
        ) : null}

        <View style={styles.actions}>
          <BlazeButton
            label="START RANKED ATTEMPT"
            size="lg"
            onPress={onStartRanked}
            disabled={!canStartRanked}
            accessibilityLabel="Start ranked daily challenge attempt"
          />
          <BlazeButton
            label="PRACTICE"
            variant="secondary"
            onPress={onPractice}
            disabled={!canPractice}
            accessibilityLabel="Practice daily challenge"
          />
          {leaderboardEnabled ? (
            <BlazeButton
              label="VIEW LEADERBOARD"
              variant="ghost"
              onPress={() => navigation.navigate('DailyChallengeLeaderboard')}
              accessibilityLabel="View daily challenge leaderboard"
            />
          ) : null}
          {!online ? (
            <Text style={styles.offlineHint}>CONNECT ONLINE FOR A RANKED ATTEMPT</Text>
          ) : null}
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
    fontSize: 32,
    fontFamily: kitTypography.families.display,
    letterSpacing: 1,
  },
  date: {
    color: kitColors.text.secondary,
    fontSize: 14,
    marginBottom: kitSpacing.sm,
  },
  panel: {
    gap: kitSpacing.xs,
  },
  panelLabel: {
    color: kitColors.fire.gold,
    fontSize: 12,
    letterSpacing: 1.2,
    fontFamily: kitTypography.families.condensed,
  },
  panelValue: {
    color: kitColors.text.primary,
    fontSize: 28,
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
  rulesTitle: {
    color: kitColors.fire.gold,
    fontSize: 12,
    letterSpacing: 1.2,
    marginBottom: kitSpacing.xs,
  },
  ruleLine: {
    color: kitColors.text.secondary,
    fontSize: 13,
    lineHeight: 20,
  },
  actions: {
    gap: kitSpacing.sm,
    marginTop: kitSpacing.md,
  },
  offlineHint: {
    color: kitColors.fire.orange,
    textAlign: 'center',
    fontSize: 13,
  },
  error: {
    color: kitColors.status.danger,
    textAlign: 'center',
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
