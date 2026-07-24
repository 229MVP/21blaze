import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { LevelUpOverlay } from '../components/Progression/LevelUpOverlay';
import { XpProgressBar } from '../components/Progression/XpProgressBar';
import { BlazeScreenBackground } from '../components/layout/BlazeScreenBackground';
import { ResultHero } from '../components/results/ResultHero';
import { ResultsTable } from '../components/results/ResultsTable';
import { BlazeButton } from '../components/ui/BlazeButton';
import { BlazePanel } from '../components/ui/BlazePanel';
import {
  isDailyMissionsEnabled,
  isMonetizationBetaEnabled,
  isProgressionBetaEnabled,
  isRewardedCurrencyEnabled,
} from '../config/featureFlags';
import { PROGRESSION_CONFIG } from '../config/progressionConfig';
import { MAX_BUSTS } from '../game/constants';
import { formatTimerSeconds } from '../game/timerEngine';
import type { GameOverReason } from '../game/types';
import { useReducedMotionSetting } from '../hooks/useReducedMotionSetting';
import { trackEvent } from '../monetization/analytics';
import { showRewardedAd } from '../monetization/rewardedAdService';
import type { ResultsScreenProps } from '../navigation/navigationTypes';
import { blazeAudio } from '../services/audio/blazeAudio';
import { blazeHaptics } from '../services/haptics/blazeHaptics';
import {
  findLocalRank,
  useScoreHistoryStore,
} from '../store/useScoreHistoryStore';
import { useGameStore } from '../store/useGameStore';
import { useProgressionStore } from '../store/useProgressionStore';
import { useWalletStore } from '../store/useWalletStore';
import {
  colors as kitColors,
  spacing as kitSpacing,
  typography as kitTypography,
} from '../theme/uiKit';

const CONTENT_MAX = 410;

function resolveParam(value: number | undefined, fallback = 0): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }
  return value;
}

function getResultCopy(
  reason: GameOverReason | undefined,
  isNewHighScore: boolean,
): { title: string; subtitle: string } {
  if (isNewHighScore) {
    return { title: 'BLAZING!', subtitle: 'NEW HIGH SCORE!' };
  }

  switch (reason) {
    case 'timeExpired':
      return { title: 'TIME’S UP!', subtitle: 'FINAL SCORE' };
    case 'busts':
      return { title: 'TOO HOT!', subtitle: 'MATCH ENDED' };
    case 'deckEmpty':
      return { title: 'DECK CLEARED!', subtitle: 'FINAL SCORE' };
    case 'quit':
      return { title: 'GAME ENDED', subtitle: 'FINAL SCORE' };
    default:
      return { title: 'GREAT RUN!', subtitle: 'FINAL SCORE' };
  }
}

export function ResultsScreen({ navigation, route }: ResultsScreenProps) {
  const { width } = useWindowDimensions();
  const reduceMotion = useReducedMotionSetting();
  const columnWidth = Math.min(CONTENT_MAX, width - 24);

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
  const routeTimeRemainingSeconds = resolveParam(
    route.params?.timeRemainingSeconds,
  );
  const gameOverReason =
    officialResult?.gameOverReason ?? route.params?.gameOverReason;
  const matchId = route.params?.matchId;

  const score = officialResult?.score ?? routeScore;
  const clearedLanes = officialResult?.lanesCleared ?? routeClearedLanes;
  const busts = officialResult?.busts ?? routeBusts;
  const cardsPlayed = officialResult?.cardsPlayed ?? routeCardsPlayed;
  const timeRemainingSeconds =
    officialResult?.timeRemainingSeconds ?? routeTimeRemainingSeconds;

  const entries = useScoreHistoryStore((state) => state.entries);
  const isHydrated = useScoreHistoryStore((state) => state.isHydrated);
  const hydrateScoreHistory = useScoreHistoryStore(
    (state) => state.hydrateScoreHistory,
  );
  const claimSoloMatchReward = useWalletStore(
    (state) => state.claimSoloMatchReward,
  );
  const claimRewardedDouble = useWalletStore(
    (state) => state.claimRewardedDouble,
  );
  const lastSoloGrant = useWalletStore((state) => state.lastSoloGrant);
  const doubledMatchIds = useWalletStore((state) => state.doubledMatchIds);
  const [doubleBusy, setDoubleBusy] = useState(false);
  const [doubleDone, setDoubleDone] = useState(false);

  const progressionEnabled = isProgressionBetaEnabled();
  const progression = useProgressionStore((state) => state.progression);
  const dailyMissions = useProgressionStore((state) => state.dailyMissions);
  const pendingLevelUp = useProgressionStore((state) => state.pendingLevelUp);
  const refreshProgression = useProgressionStore(
    (state) => state.refreshProgression,
  );
  const acknowledgeLevelUp = useProgressionStore(
    (state) => state.acknowledgeLevelUp,
  );
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
  const highScoreFeedbackKey = matchId ?? `${score}-${gameOverReason ?? 'result'}`;

  useEffect(() => {
    if (!isNewHighScore) {
      return;
    }
    blazeAudio.play('newHighScore', `high:${highScoreFeedbackKey}`);
    blazeHaptics.highScore(`high:${highScoreFeedbackKey}`);
  }, [highScoreFeedbackKey, isNewHighScore]);

  const { title, subtitle } = getResultCopy(gameOverReason, isNewHighScore);
  const showStopwatch =
    gameOverReason === 'timeExpired' && !isNewHighScore;
  const localRank =
    isHydrated && matchId ? findLocalRank(entries, matchId) : null;
  const rankLine =
    localRank == null
      ? null
      : localRank <= 10
        ? localRank === 1
          ? 'NEW LOCAL RANK #1'
          : `LOCAL TOP 10 — #${localRank}`
        : `LOCAL RANK #${localRank}`;

  const verification = useMemo(() => {
    if (eligibility === 'localOnly') {
      return {
        label: 'LOCAL SCORE',
        detail: 'Saved locally. Online rewards were not granted.',
        tone: 'local' as const,
      };
    }
    if (submissionStatus === 'verified') {
      return {
        label: 'VERIFIED ONLINE',
        detail: 'Verified — may appear on the global leaderboard.',
        tone: 'ok' as const,
      };
    }
    if (submissionStatus === 'submitting' || submissionStatus === 'idle') {
      return {
        label: 'VERIFYING SCORE…',
        detail: 'Checking your run with the server…',
        tone: 'pending' as const,
      };
    }
    if (submissionStatus === 'failed') {
      return {
        label: 'VERIFICATION FAILED',
        detail: 'Online verification failed. Your local result is safe.',
        tone: 'warn' as const,
      };
    }
    if (submissionStatus === 'rejected') {
      return {
        label: 'SCORE NOT VERIFIED',
        detail: 'Online verification failed. Your local result is safe.',
        tone: 'warn' as const,
      };
    }
    return {
      label: 'LOCAL SCORE',
      detail: 'Saved locally. Online rewards were not granted.',
      tone: 'local' as const,
    };
  }, [eligibility, submissionStatus]);

  const xpSummary = useMemo(() => {
    if (!progressionEnabled) {
      return null;
    }
    if (eligibility === 'localOnly' || gameOverReason === 'quit') {
      return {
        state: 'local' as const,
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
        xpEarned: 0,
        levelBefore: levelBeforeRef.current ?? progression?.level ?? 1,
        levelAfter: progression?.level ?? 1,
      };
    }
    if (submissionStatus === 'verified') {
      const beforeXp = totalXpBeforeRef.current;
      const afterXp = progression?.totalXp ?? beforeXp ?? 0;
      const earned =
        beforeXp != null
          ? Math.max(0, afterXp - beforeXp)
          : PROGRESSION_CONFIG.matchXp.solo;
      return {
        state: 'verified' as const,
        xpEarned: earned,
        levelBefore: levelBeforeRef.current ?? progression?.level ?? 1,
        levelAfter: progression?.level ?? 1,
      };
    }
    return {
      state: 'local' as const,
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

  const showCoinsPanel =
    isMonetizationBetaEnabled() &&
    gameOverReason !== 'quit' &&
    Boolean(matchId);

  const coinsEarned = lastSoloGrant ?? 0;
  const rewardsLocal =
    eligibility === 'localOnly' ||
    gameOverReason === 'quit' ||
    (xpSummary?.state === 'local' && submissionStatus !== 'verified');

  const missionsProgressed = useMemo(() => {
    if (!isDailyMissionsEnabled() || !dailyMissions?.missions) {
      return 0;
    }
    return dailyMissions.missions.filter(
      (mission) => mission.isComplete || (mission.progress ?? 0) > 0,
    ).length;
  }, [dailyMissions]);

  const statsRows = useMemo(
    () => [
      {
        label: 'HIGH SCORE',
        value: highScore.toLocaleString(),
        gold: isNewHighScore,
        badge: isNewHighScore ? 'NEW' : undefined,
      },
      { label: 'LANES CLEARED', value: clearedLanes.toLocaleString() },
      { label: 'CARDS PLAYED', value: cardsPlayed.toLocaleString() },
      {
        label: 'BUSTS',
        value: `${busts}/${MAX_BUSTS}`,
        danger: busts >= MAX_BUSTS,
      },
      {
        label: 'TIME REMAINING',
        value: formatTimerSeconds(timeRemainingSeconds),
        danger: timeRemainingSeconds === 0,
      },
    ],
    [
      busts,
      cardsPlayed,
      clearedLanes,
      highScore,
      isNewHighScore,
      timeRemainingSeconds,
    ],
  );

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

  const animationKey = matchId ?? `${score}-${gameOverReason ?? 'result'}`;

  return (
    <BlazeScreenBackground
      variant="dramatic"
      embers={isNewHighScore && !reduceMotion}
    >
      <View style={styles.shell}>
        <LinearGradient
          pointerEvents="none"
          colors={
            isNewHighScore
              ? ['rgba(255,101,0,0.22)', 'transparent', 'rgba(5,7,9,0.55)']
              : showStopwatch
                ? ['rgba(120,16,8,0.35)', 'transparent', 'rgba(5,7,9,0.6)']
                : ['rgba(5,7,9,0.25)', 'transparent', 'rgba(5,7,9,0.5)']
          }
          locations={[0, 0.4, 1]}
          style={styles.heroGlow}
        />

        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { width: columnWidth, maxWidth: CONTENT_MAX },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <ResultHero
            title={title}
            subtitle={subtitle}
            score={score}
            isHighScore={isNewHighScore}
            crownVisible={isNewHighScore}
            stopwatchVisible={showStopwatch}
            rankLine={rankLine}
            reduceMotion={reduceMotion}
            animationKey={animationKey}
          />

          <View
            style={[
              styles.statusPill,
              verification.tone === 'ok' && styles.statusOk,
              verification.tone === 'warn' && styles.statusWarn,
              verification.tone === 'pending' && styles.statusPending,
            ]}
            accessibilityRole="text"
            accessibilityLabel={`${verification.label}. ${verification.detail}`}
          >
            {verification.tone === 'pending' ? (
              <ActivityIndicator size="small" color={kitColors.fire.gold} />
            ) : (
              <View
                style={[
                  styles.statusDot,
                  verification.tone === 'ok' && styles.dotOk,
                  verification.tone === 'warn' && styles.dotWarn,
                  verification.tone === 'local' && styles.dotLocal,
                ]}
              />
            )}
            <View style={styles.statusCopy}>
              <Text style={styles.statusLabel}>{verification.label}</Text>
              <Text style={styles.statusDetail} numberOfLines={2}>
                {verification.detail}
              </Text>
            </View>
          </View>

          <ResultsTable
            rows={statsRows}
            highlightedRow={isNewHighScore ? 'HIGH SCORE' : undefined}
            compact
          />

          {(showCoinsPanel || xpSummary) && (
            <BlazePanel style={styles.rewardsPanel}>
              {xpSummary?.state === 'syncing' ? (
                <Text style={styles.syncLabel}>SYNCING REWARDS…</Text>
              ) : null}
              <View style={styles.rewardsRow}>
                {showCoinsPanel ? (
                  <View style={styles.rewardCell}>
                    <Text style={styles.rewardLabel}>COINS</Text>
                    <Text style={styles.rewardValue}>
                      +{coinsEarned.toLocaleString()}
                    </Text>
                  </View>
                ) : null}
                {xpSummary ? (
                  <View style={styles.rewardCell}>
                    <Text style={styles.rewardLabel}>XP</Text>
                    <Text style={styles.rewardValue}>
                      +
                      {xpSummary.state === 'verified'
                        ? xpSummary.xpEarned.toLocaleString()
                        : '0'}
                    </Text>
                  </View>
                ) : null}
              </View>
              {rewardsLocal ? (
                <Text style={styles.rewardsNote}>
                  Connect online to earn verified rewards.
                </Text>
              ) : null}

              {showCoinsPanel &&
              isRewardedCurrencyEnabled() &&
              !doubleDone &&
              !(matchId && doubledMatchIds[matchId]) ? (
                <BlazeButton
                  label="DOUBLE REWARD"
                  variant="ghost"
                  size="sm"
                  loading={doubleBusy}
                  onPress={() => {
                    void (async () => {
                      setDoubleBusy(true);
                      trackEvent('rewarded_ad_requested', {
                        type: 'double_solo',
                      });
                      const outcome = await showRewardedAd(
                        'double_solo_match_coins',
                      );
                      if (outcome.status === 'earned') {
                        trackEvent('rewarded_ad_completed');
                        const granted = await claimRewardedDouble({
                          matchId: matchId!,
                          clientRewardId: outcome.clientRewardId,
                        });
                        if (granted > 0) {
                          setDoubleDone(true);
                        }
                      } else if (outcome.status === 'dismissed') {
                        trackEvent('rewarded_ad_failed', {
                          reason: 'dismissed',
                        });
                      } else {
                        trackEvent('rewarded_ad_failed');
                      }
                      setDoubleBusy(false);
                    })();
                  }}
                />
              ) : null}
              {doubleDone || (matchId && doubledMatchIds[matchId]) ? (
                <Text style={styles.doubled}>REWARD DOUBLED</Text>
              ) : null}
            </BlazePanel>
          )}

          {xpSummary &&
          progression &&
          xpSummary.state === 'verified' &&
          (xpSummary.xpEarned > 0 ||
            xpSummary.levelAfter > xpSummary.levelBefore) ? (
            <BlazePanel style={styles.levelPanel}>
              <Text style={styles.levelTitle}>
                Level {xpSummary.levelBefore} → {xpSummary.levelAfter}
                {xpSummary.levelAfter > xpSummary.levelBefore
                  ? '  ·  LEVEL UP'
                  : ''}
              </Text>
              <Text style={styles.levelXp}>+{xpSummary.xpEarned} XP</Text>
              <XpProgressBar
                compact
                level={progression.level}
                currentLevelXp={progression.currentLevelXp}
                xpRequiredForNextLevel={progression.xpRequiredForNextLevel}
              />
            </BlazePanel>
          ) : null}

          {missionsProgressed > 0 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${missionsProgressed} missions progressed. Open daily missions.`}
              onPress={() => navigation.navigate('DailyMissions')}
              style={({ pressed }) => [
                styles.missionChip,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.missionText}>
                {missionsProgressed} mission
                {missionsProgressed === 1 ? '' : 's'} progressed
              </Text>
              <Text style={styles.missionAction}>VIEW</Text>
            </Pressable>
          ) : null}

          <View style={styles.actions}>
            <BlazeButton
              label="PLAY AGAIN"
              onPress={playAgain}
              accessibilityLabel="Play again"
            />
            <BlazeButton
              label={
                submissionStatus === 'verified'
                  ? 'VIEW GLOBAL RANKING'
                  : 'VIEW HIGH SCORES'
              }
              variant="secondary"
              onPress={() => navigation.navigate('HighScores')}
              accessibilityLabel={
                submissionStatus === 'verified'
                  ? 'View global ranking'
                  : 'View high scores'
              }
            />
            <BlazeButton
              label="RETURN HOME"
              variant="ghost"
              onPress={returnHome}
              accessibilityLabel="Return home"
            />
          </View>
        </ScrollView>

        {progressionEnabled ? (
          <LevelUpOverlay
            pending={pendingLevelUp}
            onContinue={acknowledgeLevelUp}
          />
        ) : null}
      </View>
    </BlazeScreenBackground>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    backgroundColor: 'rgba(5,7,9,0.28)',
  },
  heroGlow: {
    ...StyleSheet.absoluteFill,
    pointerEvents: 'none',
  },
  scroll: {
    flexGrow: 1,
    alignSelf: 'center',
    paddingHorizontal: kitSpacing.md,
    paddingTop: kitSpacing.lg,
    paddingBottom: kitSpacing.xl,
    gap: kitSpacing.sm,
  },
  statusPill: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,138,0,0.28)',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  statusOk: {
    borderColor: 'rgba(66,199,106,0.45)',
  },
  statusWarn: {
    borderColor: 'rgba(255,52,38,0.4)',
  },
  statusPending: {
    borderColor: 'rgba(255,182,41,0.4)',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: kitColors.fire.brightOrange,
  },
  dotOk: { backgroundColor: kitColors.status.success },
  dotWarn: { backgroundColor: kitColors.status.danger },
  dotLocal: { backgroundColor: kitColors.fire.gold },
  statusCopy: {
    flex: 1,
    minWidth: 0,
  },
  statusLabel: {
    color: kitColors.text.primary,
    fontFamily: kitTypography.families.condensed,
    fontWeight: '700',
    fontSize: 11,
    letterSpacing: 1,
  },
  statusDetail: {
    color: kitColors.text.secondary,
    fontFamily: kitTypography.families.body,
    fontSize: 11,
  },
  rewardsPanel: {
    width: '100%',
    gap: kitSpacing.sm,
  },
  syncLabel: {
    color: kitColors.fire.gold,
    fontFamily: kitTypography.families.condensed,
    fontWeight: '700',
    fontSize: 11,
    letterSpacing: 1,
    textAlign: 'center',
  },
  rewardsRow: {
    flexDirection: 'row',
    gap: kitSpacing.md,
  },
  rewardCell: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  rewardLabel: {
    color: kitColors.text.secondary,
    fontFamily: kitTypography.families.condensed,
    fontSize: 11,
    letterSpacing: 1,
  },
  rewardValue: {
    color: kitColors.fire.gold,
    fontFamily: kitTypography.families.display,
    fontSize: 28,
  },
  rewardsNote: {
    color: kitColors.text.secondary,
    fontFamily: kitTypography.families.body,
    fontSize: 12,
    textAlign: 'center',
  },
  doubled: {
    color: kitColors.status.success,
    fontFamily: kitTypography.families.condensed,
    fontWeight: '700',
    textAlign: 'center',
    fontSize: 12,
    letterSpacing: 0.8,
  },
  levelPanel: {
    width: '100%',
    gap: 6,
    alignItems: 'center',
  },
  levelTitle: {
    color: kitColors.text.primary,
    fontFamily: kitTypography.families.condensed,
    fontWeight: '700',
    fontSize: 13,
    letterSpacing: 0.6,
  },
  levelXp: {
    color: kitColors.fire.orange,
    fontFamily: kitTypography.families.display,
    fontSize: 20,
  },
  missionChip: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,138,0,0.28)',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  missionText: {
    color: kitColors.text.secondary,
    fontFamily: kitTypography.families.condensed,
    fontSize: 12,
  },
  missionAction: {
    color: kitColors.fire.gold,
    fontFamily: kitTypography.families.condensed,
    fontWeight: '700',
    fontSize: 12,
    letterSpacing: 0.8,
  },
  actions: {
    width: '100%',
    gap: 10,
    marginTop: 4,
  },
  pressed: {
    opacity: 0.88,
  },
});
