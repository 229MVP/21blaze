import { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { BlazeButton } from '../components/buttons/BlazeButton';
import { BlazeScreenBackground } from '../components/layout/BlazeScreenBackground';
import { LevelUpOverlay } from '../components/Progression/LevelUpOverlay';
import { XpProgressBar } from '../components/Progression/XpProgressBar';
import { ResultHero } from '../components/results/ResultHero';
import { ResultsTable } from '../components/results/ResultsTable';
import { BlazeButton as KitBlazeButton } from '../components/ui/BlazeButton';
import {
  isMonetizationBetaEnabled,
  isProgressionBetaEnabled,
  isRewardedCurrencyEnabled,
} from '../config/featureFlags';
import { PROGRESSION_CONFIG } from '../config/progressionConfig';
import { MAX_BUSTS } from '../game/constants';
import { formatTimerSeconds } from '../game/timerEngine';
import type { GameOverReason } from '../game/types';
import { trackEvent } from '../monetization/analytics';
import { showRewardedAd } from '../monetization/rewardedAdService';
import type { ResultsScreenProps } from '../navigation/navigationTypes';
import { findLocalRank, useScoreHistoryStore } from '../store/useScoreHistoryStore';
import { useGameStore } from '../store/useGameStore';
import { useProgressionStore } from '../store/useProgressionStore';
import { useWalletStore } from '../store/useWalletStore';
import { colors } from '../theme/colors';
import { radius } from '../theme/radius';
import { spacing } from '../theme/spacing';
import { fontFamilies, typography } from '../theme/typography';

function resolveParam(value: number | undefined, fallback = 0): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }

  return value;
}

function getResultTitle(
  reason: GameOverReason | undefined,
  isNewHighScore: boolean,
): string {
  if (isNewHighScore) {
    return 'BLAZING!';
  }

  switch (reason) {
    case 'timeExpired':
      return 'TIME’S UP!';
    case 'busts':
      return 'TOO HOT!';
    case 'deckEmpty':
      return 'DECK CLEARED!';
    case 'quit':
      return 'GAME ENDED';
    default:
      return 'GOOD RUN';
  }
}

export function ResultsScreen({ navigation, route }: ResultsScreenProps) {
  const restartGame = useGameStore((state) => state.restartGame);
  const eligibility = useGameStore((state) => state.eligibility);
  const submissionStatus = useGameStore((state) => state.submissionStatus);
  const officialResult = useGameStore((state) => state.officialResult);
  const submitVerifiedMatchIfNeeded = useGameStore(
    (state) => state.submitVerifiedMatchIfNeeded,
  );

  const routeScore = resolveParam(route.params?.score);
  const highScore = resolveParam(route.params?.highScore);
  const routeClearedLanes = resolveParam(route.params?.clearedLanes);
  const routeBusts = resolveParam(route.params?.busts);
  const routeCardsPlayed = resolveParam(route.params?.cardsPlayed);
  const routeTimeRemainingSeconds = resolveParam(route.params?.timeRemainingSeconds);
  const gameOverReason = officialResult?.gameOverReason ?? route.params?.gameOverReason;
  const matchId = route.params?.matchId;

  const score = officialResult?.score ?? routeScore;
  const clearedLanes = officialResult?.lanesCleared ?? routeClearedLanes;
  const busts = officialResult?.busts ?? routeBusts;
  const cardsPlayed = officialResult?.cardsPlayed ?? routeCardsPlayed;
  const timeRemainingSeconds =
    officialResult?.timeRemainingSeconds ?? routeTimeRemainingSeconds;

  const entries = useScoreHistoryStore((state) => state.entries);
  const isHydrated = useScoreHistoryStore((state) => state.isHydrated);
  const hydrateScoreHistory = useScoreHistoryStore((state) => state.hydrateScoreHistory);
  const claimSoloMatchReward = useWalletStore((state) => state.claimSoloMatchReward);
  const claimRewardedDouble = useWalletStore((state) => state.claimRewardedDouble);
  const lastSoloGrant = useWalletStore((state) => state.lastSoloGrant);
  const doubledMatchIds = useWalletStore((state) => state.doubledMatchIds);
  const [doubleBusy, setDoubleBusy] = useState(false);
  const [doubleDone, setDoubleDone] = useState(false);

  const progressionEnabled = isProgressionBetaEnabled();
  const progression = useProgressionStore((state) => state.progression);
  const pendingLevelUp = useProgressionStore((state) => state.pendingLevelUp);
  const refreshProgression = useProgressionStore((state) => state.refreshProgression);
  const acknowledgeLevelUp = useProgressionStore((state) => state.acknowledgeLevelUp);
  const levelBeforeRef = useRef<number | null>(null);
  const totalXpBeforeRef = useRef<number | null>(null);
  const [xpSnapshotReady, setXpSnapshotReady] = useState(false);

  useEffect(() => {
    void hydrateScoreHistory();
  }, [hydrateScoreHistory]);

  useEffect(() => {
    void submitVerifiedMatchIfNeeded();
  }, [submitVerifiedMatchIfNeeded]);

  useEffect(() => {
    if (!matchId || gameOverReason === 'quit') {
      return;
    }
    void (async () => {
      if (progressionEnabled && levelBeforeRef.current === null) {
        const current = useProgressionStore.getState().progression;
        if (current) {
          levelBeforeRef.current = current.level;
          totalXpBeforeRef.current = current.totalXp;
        }
      }
      await claimSoloMatchReward({
        matchId,
        score,
        gameOverReason: gameOverReason ?? 'timeExpired',
      });
      if (progressionEnabled) {
        await refreshProgression();
        setXpSnapshotReady(true);
        trackEvent('xp_earned', {
          source: 'solo_match',
          amount: PROGRESSION_CONFIG.matchXp.solo,
        });
      }
    })();
  }, [
    claimSoloMatchReward,
    gameOverReason,
    matchId,
    progressionEnabled,
    refreshProgression,
    score,
  ]);

  useEffect(() => {
    if (!progressionEnabled) {
      return;
    }
    if (levelBeforeRef.current === null && progression) {
      levelBeforeRef.current = progression.level;
      totalXpBeforeRef.current = progression.totalXp;
    }
  }, [progression, progressionEnabled]);

  const isNewHighScore = score > 0 && score >= highScore;
  const title = getResultTitle(gameOverReason, isNewHighScore);
  const localRank =
    isHydrated && matchId ? findLocalRank(entries, matchId) : null;

  const verificationLabel = useMemo(() => {
    if (eligibility === 'localOnly') {
      return 'LOCAL SCORE';
    }
    if (submissionStatus === 'verified') {
      return 'VERIFIED ONLINE';
    }
    if (submissionStatus === 'submitting' || submissionStatus === 'idle') {
      return 'VERIFYING SCORE…';
    }
    if (submissionStatus === 'failed') {
      return 'VERIFICATION FAILED';
    }
    if (submissionStatus === 'rejected') {
      return 'SCORE NOT VERIFIED';
    }
    return 'LOCAL SCORE';
  }, [eligibility, submissionStatus]);

  const verificationDetail = useMemo(() => {
    if (eligibility === 'localOnly') {
      return 'This match was saved locally and was not submitted globally.';
    }
    if (submissionStatus === 'verified') {
      return 'Official result accepted on the global leaderboard.';
    }
    if (submissionStatus === 'submitting' || submissionStatus === 'idle') {
      return 'Checking your run with the server…';
    }
    if (submissionStatus === 'failed') {
      return 'Your local score is still saved.';
    }
    return 'Your local score is still saved.';
  }, [eligibility, submissionStatus]);

  const xpSummary = useMemo(() => {
    if (!progressionEnabled) {
      return null;
    }
    if (eligibility === 'localOnly' || gameOverReason === 'quit') {
      return {
        state: 'local' as const,
        label: 'LOCAL MATCH — NO ONLINE REWARDS',
        xpEarned: 0,
        levelBefore: progression?.level ?? 1,
        levelAfter: progression?.level ?? 1,
      };
    }
    if (
      submissionStatus === 'submitting' ||
      submissionStatus === 'idle' ||
      !xpSnapshotReady
    ) {
      return {
        state: 'syncing' as const,
        label: 'SYNCING REWARDS…',
        xpEarned: 0,
        levelBefore: levelBeforeRef.current ?? progression?.level ?? 1,
        levelAfter: progression?.level ?? 1,
      };
    }
    if (submissionStatus === 'verified') {
      const beforeXp = totalXpBeforeRef.current;
      const afterXp = progression?.totalXp ?? beforeXp ?? 0;
      const earned =
        beforeXp != null ? Math.max(0, afterXp - beforeXp) : PROGRESSION_CONFIG.matchXp.solo;
      return {
        state: 'verified' as const,
        label: 'REWARDS VERIFIED',
        xpEarned: earned,
        levelBefore: levelBeforeRef.current ?? progression?.level ?? 1,
        levelAfter: progression?.level ?? 1,
      };
    }
    return {
      state: 'local' as const,
      label: 'LOCAL MATCH — NO ONLINE REWARDS',
      xpEarned: 0,
      levelBefore: progression?.level ?? 1,
      levelAfter: progression?.level ?? 1,
    };
  }, [
    eligibility,
    gameOverReason,
    progression,
    progressionEnabled,
    submissionStatus,
    xpSnapshotReady,
  ]);

  const playAgain = () => {
    restartGame();
    navigation.replace('Game');
  };

  const returnHome = () => {
    navigation.reset({
      index: 0,
      routes: [{ name: 'Home', params: { fromSoloComplete: true } }],
    });
  };

  return (
    <BlazeScreenBackground variant="dramatic" embers>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <ResultHero
          title={title}
          subtitle={isNewHighScore ? 'NEW HIGH SCORE!' : undefined}
          score={score}
          crownVisible={isNewHighScore}
          isHighScore={isNewHighScore}
        />
        {localRank ? (
          <Text
            style={styles.localRank}
            accessibilityLabel={`New local rank number ${localRank}`}
          >
            NEW LOCAL RANK #{localRank}
          </Text>
        ) : null}

        <View style={styles.verifyBanner}>
          <Text style={styles.verifyLabel}>{verificationLabel}</Text>
          <Text style={styles.verifyDetail}>{verificationDetail}</Text>
        </View>

        <ResultsTable
          rows={[
            {
              label: 'HIGH SCORE',
              value: highScore.toLocaleString(),
              gold: isNewHighScore,
            },
            { label: 'LANES CLEARED', value: clearedLanes },
            { label: 'CARDS PLAYED', value: cardsPlayed },
            { label: 'BUSTS', value: `${busts}/${MAX_BUSTS}` },
            {
              label: 'TIME REMAINING',
              value: formatTimerSeconds(timeRemainingSeconds),
              danger: timeRemainingSeconds === 0,
            },
            {
              label: 'ENDING',
              value: gameOverReason ?? '—',
            },
          ]}
        />

        {isMonetizationBetaEnabled() &&
        gameOverReason !== 'quit' &&
        matchId ? (
          <View style={styles.coinPanel}>
            <Text style={styles.coinTitle}>COINS EARNED</Text>
            <Text style={styles.coinValue}>
              +{(lastSoloGrant ?? 0).toLocaleString()}
            </Text>
            {isRewardedCurrencyEnabled() &&
            !doubleDone &&
            !(matchId && doubledMatchIds[matchId]) ? (
              <BlazeButton
                title="DOUBLE REWARD"
                variant="outline"
                loading={doubleBusy}
                onPress={() => {
                  void (async () => {
                    setDoubleBusy(true);
                    trackEvent('rewarded_ad_requested', { type: 'double_solo' });
                    const outcome = await showRewardedAd('double_solo_match_coins');
                    if (outcome.status === 'earned') {
                      trackEvent('rewarded_ad_completed');
                      const granted = await claimRewardedDouble({
                        matchId,
                        clientRewardId: outcome.clientRewardId,
                      });
                      if (granted > 0) {
                        setDoubleDone(true);
                      }
                    } else if (outcome.status === 'dismissed') {
                      trackEvent('rewarded_ad_failed', { reason: 'dismissed' });
                    } else {
                      trackEvent('rewarded_ad_failed');
                    }
                    setDoubleBusy(false);
                  })();
                }}
                fullWidth
              />
            ) : null}
            {doubleDone || (matchId && doubledMatchIds[matchId]) ? (
              <Text style={styles.doubled}>REWARD DOUBLED</Text>
            ) : null}
          </View>
        ) : null}

        {xpSummary ? (
          <View style={styles.xpPanel}>
            <Text style={styles.xpState}>{xpSummary.label}</Text>
            {xpSummary.state === 'verified' ? (
              <>
                <Text style={styles.xpEarned}>+{xpSummary.xpEarned} XP</Text>
                <Text style={styles.xpLevels}>
                  Level {xpSummary.levelBefore} → {xpSummary.levelAfter}
                </Text>
              </>
            ) : null}
            {progression ? (
              <XpProgressBar
                compact
                level={progression.level}
                currentLevelXp={progression.currentLevelXp}
                xpRequiredForNextLevel={progression.xpRequiredForNextLevel}
              />
            ) : null}
          </View>
        ) : null}

        <View style={styles.actions}>
          <KitBlazeButton label="PLAY AGAIN" onPress={playAgain} size="lg" />
          <KitBlazeButton
            label={
              submissionStatus === 'verified'
                ? 'VIEW GLOBAL RANKING'
                : 'VIEW HIGH SCORES'
            }
            variant="secondary"
            onPress={() => navigation.navigate('HighScores')}
          />
          <KitBlazeButton
            label="RETURN HOME"
            variant="ghost"
            onPress={returnHome}
          />
        </View>
      </ScrollView>

      {progressionEnabled ? (
        <LevelUpOverlay
          pending={pendingLevelUp}
          onContinue={acknowledgeLevelUp}
        />
      ) : null}
    </BlazeScreenBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
    alignItems: 'center',
    gap: spacing.md,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  title: {
    fontFamily: fontFamilies.display,
    fontSize: 48,
    lineHeight: 52,
    color: colors.primary,
    textAlign: 'center',
    textShadowColor: colors.gold,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 14,
  },
  newHigh: {
    ...typography.subtitle,
    color: colors.gold,
    fontSize: 14,
  },
  localRank: {
    fontFamily: fontFamilies.bodyBold,
    fontSize: 13,
    letterSpacing: 1,
    color: colors.brightOrange,
  },
  verifyBanner: {
    width: '100%',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.blazeSubtle,
    backgroundColor: 'rgba(0,0,0,0.28)',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    gap: 4,
  },
  verifyLabel: {
    fontFamily: fontFamilies.bodyBold,
    fontSize: 13,
    letterSpacing: 1.2,
    color: colors.gold,
    textAlign: 'center',
  },
  verifyDetail: {
    ...typography.body,
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  coinPanel: {
    width: '100%',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.blazeSubtle,
    backgroundColor: colors.backgroundCard,
    padding: spacing.md,
    alignItems: 'center',
    gap: spacing.sm,
  },
  xpPanel: {
    width: '100%',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.blazeSubtle,
    backgroundColor: 'rgba(0,0,0,0.28)',
    padding: spacing.md,
    alignItems: 'center',
    gap: spacing.sm,
  },
  xpState: {
    fontFamily: fontFamilies.bodyBold,
    letterSpacing: 1.1,
    color: colors.gold,
    textAlign: 'center',
  },
  xpEarned: {
    fontFamily: fontFamilies.display,
    fontSize: 28,
    color: colors.primary,
  },
  xpLevels: {
    ...typography.body,
    color: colors.textSecondary,
  },
  coinTitle: {
    fontFamily: fontFamilies.bodyBold,
    letterSpacing: 1.2,
    color: colors.gold,
  },
  coinValue: {
    fontFamily: fontFamilies.display,
    fontSize: 32,
    color: colors.primary,
  },
  doubled: {
    fontFamily: fontFamilies.bodyBold,
    color: colors.success,
  },
  scoreCard: {
    width: '100%',
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.blazeSubtle,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  scoreLabel: {
    ...typography.label,
    letterSpacing: 1,
  },
  scoreValue: {
    fontFamily: fontFamilies.display,
    fontSize: 52,
    lineHeight: 56,
    color: colors.brightOrange,
    textShadowColor: colors.gold,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },
  actions: {
    width: '100%',
    gap: 10,
    marginTop: spacing.xs,
  },
});
