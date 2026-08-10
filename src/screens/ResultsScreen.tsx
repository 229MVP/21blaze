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
import { RewardedCoinButton } from '../components/ads/RewardedCoinButton';
import { PlayerTitleBadge } from '../components/cosmetics/PlayerTitleBadge';
import { ProfileFrameBadge } from '../components/cosmetics/ProfileFrameBadge';
import { ThemedVictoryEffect } from '../components/themes/ThemedVictoryEffect';
import { useResolvedVisualTheme } from '../cosmetics/useLockerCosmetics';
import { BlazeScreenBackground } from '../components/layout/BlazeScreenBackground';
import { ResultHero } from '../components/results/ResultHero';
import { ResultsTable } from '../components/results/ResultsTable';
import { BlazeButton } from '../components/ui/BlazeButton';
import { BlazePanel } from '../components/ui/BlazePanel';
import { StreakMilestoneModal } from '../components/dailyChallenge/StreakMilestoneModal';
import {
  isDailyLeaderboardEnabled,
  isDailyMissionsEnabled,
  isMonetizationBetaEnabled,
  isProgressionBetaEnabled,
  isRewardedCurrencyEnabled,
  isV1_1LockerEnabled,
  isV1_1RewardsEnabled,
} from '../config/featureFlags';
import { getCosmetic } from '../cosmetics/catalog';
import { useActiveProfileFrame } from '../cosmetics/useLockerCosmetics';
import { useCosmeticStore } from '../store/useCosmeticStore';
import { shouldSyncV1_1Reward } from '../config/economyConfig';
import { PROGRESSION_CONFIG } from '../config/progressionConfig';
import { MAX_BUSTS } from '../game/constants';
import { formatTimerSeconds } from '../game/timerEngine';
import type { GameOverReason } from '../game/types';
import { useInterstitialScreenTracking } from '../hooks/useInterstitialScreenTracking';
import { useReducedMotionSetting } from '../hooks/useReducedMotionSetting';
import { useDailyLeaderboardStore } from '../store/useDailyLeaderboardStore';
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
import { useDailyChallengeStore } from '../store/useDailyChallengeStore';
import { useAsyncDuelStore } from '../store/useAsyncDuelStore';
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
  const resolvedVisualTheme = useResolvedVisualTheme();
  useInterstitialScreenTracking('results');

  const restartGame = useGameStore((state) => state.restartGame);
  const eligibility = useGameStore((state) => state.eligibility);
  const submissionStatus = useGameStore((state) => state.submissionStatus);
  const officialResult = useGameStore((state) => state.officialResult);
  const submitVerifiedMatchIfNeeded = useGameStore(
    (state) => state.submitVerifiedMatchIfNeeded,
  );
  const gameMode = useGameStore((state) => state.gameMode);
  const dailyChallengeSession = useGameStore((state) => state.dailyChallengeSession);
  const asyncDuelSession = useGameStore((state) => state.asyncDuelSession);
  const clearDailyChallengeMode = useGameStore((state) => state.clearDailyChallengeMode);
  const clearAsyncDuelMode = useGameStore((state) => state.clearAsyncDuelMode);
  const dailyExact21Count = useGameStore((state) => state.dailyExact21Count);
  const dailyFiveCardClearCount = useGameStore((state) => state.dailyFiveCardClearCount);
  const dailyCompletionSummary = useDailyChallengeStore((state) => state.completionSummary);
  const dailySubmissionStatus = useDailyChallengeStore((state) => state.submissionStatus);
  const dailySubmissionError = useDailyChallengeStore((state) => state.submissionError);
  const rankedAttemptScore = useDailyChallengeStore(
    (state) => state.rankedAttempt?.verifiedScore,
  );
  const loadStreakStatus = useDailyLeaderboardStore((s) => s.loadStreakStatus);
  const claimStreakReward = useDailyLeaderboardStore((s) => s.claimStreakReward);
  const streakStatus = useDailyLeaderboardStore((s) => s.streakStatus);
  const loadMyDailyPosition = useDailyLeaderboardStore((s) => s.loadMyDailyPosition);
  const myDailyEntry = useDailyLeaderboardStore((s) => s.myDailyEntry);
  const dailyChallengeConfig = useDailyChallengeStore((s) => s.challenge);

  const [milestoneModal, setMilestoneModal] = useState<number | null>(null);
  const [claimBusy, setClaimBusy] = useState(false);
  const [rankLookupFailed, setRankLookupFailed] = useState(false);

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

  const v1_1RewardsOn = isV1_1RewardsEnabled();
  const claimV1_1Reward = useWalletStore((state) => state.claimV1_1Reward);
  const markV1_1RewardLocal = useWalletStore(
    (state) => state.markV1_1RewardLocal,
  );
  const v1_1RewardStatus = useWalletStore((state) => state.v1_1RewardStatus);
  const v1_1RewardByMatchId = useWalletStore(
    (state) => state.v1_1RewardByMatchId,
  );
  const v1_1Reward = matchId ? v1_1RewardByMatchId[matchId] : undefined;

  const progressionEnabled = isProgressionBetaEnabled();
  const v1_1LockerOn = isV1_1LockerEnabled();
  const activeProfileFrame = useActiveProfileFrame();
  const equippedPlayerTitle = useCosmeticStore((state) => state.equippedCosmetics.playerTitle);
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

  // After Async Duel submission settles, leave the interim Results screen.
  useEffect(() => {
    if (gameMode !== 'asyncDuel' || submissionStatus !== 'verified') {
      return;
    }
    const completion = useAsyncDuelStore.getState().lastCompletion;
    const duelId = asyncDuelSession?.duelId;
    if (!duelId) {
      return;
    }
    if (completion?.settled || completion?.status === 'completed') {
      navigation.replace('AsyncDuelResult', { duelId });
      return;
    }
    if (
      completion?.status === 'awaiting_opponent' ||
      asyncDuelSession?.participantRole === 'challenger'
    ) {
      navigation.replace('AsyncDuelChallengeSent');
    }
  }, [
    asyncDuelSession?.duelId,
    asyncDuelSession?.participantRole,
    gameMode,
    navigation,
    submissionStatus,
  ]);

  useEffect(() => {
    if (gameMode === 'dailyChallenge') {
      trackEvent('daily_challenge_result_viewed', {
        attemptType: dailyChallengeSession?.attemptType ?? 'unknown',
      });
    }
    if (gameMode === 'asyncDuel') {
      trackEvent('duel_result_viewed', {
        role: asyncDuelSession?.participantRole ?? 'unknown',
      });
    }
  }, [
    asyncDuelSession?.participantRole,
    dailyChallengeSession?.attemptType,
    gameMode,
  ]);

  useEffect(() => {
    if (
      gameMode !== 'dailyChallenge' ||
      dailyChallengeSession?.attemptType !== 'ranked' ||
      dailySubmissionStatus !== 'completed'
    ) {
      return;
    }
    void loadStreakStatus({ refresh: true }).then(() => {
      const status = useDailyLeaderboardStore.getState().streakStatus;
      const eligible = status?.eligibleRewards ?? [];
      if (eligible.length > 0) {
        const milestone = eligible[eligible.length - 1]?.milestone;
        if (milestone) {
          trackEvent('streak_milestone_earned', { milestone });
          setMilestoneModal(milestone);
        }
      }
    });
    if (dailyChallengeConfig?.challengeId) {
      void loadMyDailyPosition(dailyChallengeConfig.challengeId).catch(() => {
        setRankLookupFailed(true);
      });
    }
  }, [
    dailyChallengeConfig?.challengeId,
    dailyChallengeSession?.attemptType,
    dailySubmissionStatus,
    gameMode,
    loadMyDailyPosition,
    loadStreakStatus,
  ]);

  useEffect(() => {
    // Version 1.1A supersedes the flat 1.0 solo-coin formula with its own
    // reward flow (see the effect below) — never grant both for one match.
    // Async Duel and Daily Challenge must never grant Solo rewards.
    if (
      gameMode === 'asyncDuel' ||
      gameMode === 'dailyChallenge' ||
      !matchId ||
      gameOverReason === 'quit' ||
      v1_1RewardsOn
    ) {
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
    gameMode,
    gameOverReason,
    matchId,
    progressionEnabled,
    refreshProgression,
    score,
    v1_1RewardsOn,
  ]);

  useEffect(() => {
    if (gameMode === 'asyncDuel' || gameMode === 'dailyChallenge') {
      return;
    }
    const decision = shouldSyncV1_1Reward({
      v1_1RewardsOn,
      matchId,
      gameOverReason,
      eligibility,
    });
    if (decision === 'skip' || decision === 'wait') {
      return;
    }
    if (decision === 'local') {
      markV1_1RewardLocal(matchId!);
      return;
    }
    void claimV1_1Reward(matchId!);
  }, [
    claimV1_1Reward,
    eligibility,
    gameMode,
    gameOverReason,
    markV1_1RewardLocal,
    matchId,
    v1_1RewardsOn,
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

  const { title, subtitle } = useMemo(() => {
    if (gameMode === 'asyncDuel') {
      if (submissionStatus === 'submitting' || submissionStatus === 'idle') {
        return { title: 'VERIFYING…', subtitle: 'SUBMITTING DUEL RESULT' };
      }
      if (submissionStatus === 'failed') {
        return { title: 'SUBMISSION ISSUE', subtitle: 'COULD NOT VERIFY' };
      }
      if (asyncDuelSession?.participantRole === 'challenger') {
        return { title: 'CHALLENGE SENT', subtitle: 'WAITING FOR OPPONENT' };
      }
      return { title: 'DUEL COMPLETE', subtitle: 'OFFICIAL RESULT' };
    }
    if (
      gameMode === 'dailyChallenge' &&
      dailyChallengeSession?.attemptType === 'ranked' &&
      (dailySubmissionStatus === 'completed' || submissionStatus === 'verified')
    ) {
      return { title: 'DAILY BLAZE COMPLETE', subtitle: 'OFFICIAL RESULT' };
    }
    if (
      gameMode === 'dailyChallenge' &&
      dailyChallengeSession?.attemptType === 'practice'
    ) {
      return { title: 'PRACTICE RUN', subtitle: 'UNRANKED' };
    }
    return getResultCopy(gameOverReason, isNewHighScore);
  }, [
    asyncDuelSession?.participantRole,
    dailyChallengeSession?.attemptType,
    dailySubmissionStatus,
    gameMode,
    gameOverReason,
    isNewHighScore,
    submissionStatus,
  ]);
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
    if (gameMode === 'asyncDuel') {
      if (submissionStatus === 'verified') {
        return {
          label:
            asyncDuelSession?.participantRole === 'challenger'
              ? 'CHALLENGE SENT'
              : 'DUEL SETTLED',
          detail:
            asyncDuelSession?.participantRole === 'challenger'
              ? 'Your opponent will receive the same deck and rules.'
              : 'Official result recorded by the server.',
          tone: 'ok' as const,
        };
      }
      if (submissionStatus === 'submitting' || submissionStatus === 'idle') {
        return {
          label: 'VERIFYING RESULT…',
          detail: 'Confirming your Async Duel attempt with the server…',
          tone: 'pending' as const,
        };
      }
      if (submissionStatus === 'failed') {
        return {
          label: 'VERIFICATION FAILED',
          detail:
            useGameStore.getState().rejectionReason ??
            'Could not submit your duel result. Retry when online.',
          tone: 'warn' as const,
        };
      }
      return {
        label: 'ASYNC DUEL',
        detail: 'Awaiting official submission.',
        tone: 'pending' as const,
      };
    }

    if (gameMode === 'dailyChallenge') {
      if (dailyChallengeSession?.attemptType === 'practice') {
        return {
          label: 'PRACTICE RUN',
          detail: 'Practice scores do not affect your official Daily Blaze result.',
          tone: 'local' as const,
        };
      }

      if (
        dailySubmissionStatus === 'completed' &&
        dailyCompletionSummary
      ) {
        return {
          label: 'DAILY BLAZE COMPLETE',
          detail: 'Your official attempt is complete.',
          tone: 'ok' as const,
        };
      }

      if (
        dailySubmissionStatus === 'submitting' ||
        submissionStatus === 'submitting' ||
        submissionStatus === 'idle'
      ) {
        return {
          label: 'SUBMITTING RESULT…',
          detail: 'Recording your official Daily Blaze attempt…',
          tone: 'pending' as const,
        };
      }

      if (
        dailySubmissionStatus === 'failed' ||
        submissionStatus === 'failed'
      ) {
        return {
          label: 'SUBMISSION FAILED',
          detail:
            dailySubmissionError ?? 'Could not submit your official result. Retry when online.',
          tone: 'warn' as const,
        };
      }

      return {
        label: 'DAILY BLAZE RESULT',
        detail: 'Awaiting official submission.',
        tone: 'pending' as const,
      };
    }

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
  }, [
    asyncDuelSession?.participantRole,
    dailyChallengeSession?.attemptType,
    dailyCompletionSummary,
    dailySubmissionError,
    dailySubmissionStatus,
    eligibility,
    gameMode,
    submissionStatus,
  ]);

  const xpSummary = useMemo(() => {
    if (!progressionEnabled || gameMode === 'asyncDuel' || gameMode === 'dailyChallenge') {
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
    gameMode,
    gameOverReason,
    progression,
    progressionEnabled,
    submissionStatus,
    xpSnapshotReady,
  ]);

  const showCoinsPanel =
    isMonetizationBetaEnabled() &&
    gameMode === 'solo' &&
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

  const dailyStatsRows = useMemo(() => {
    if (gameMode !== 'dailyChallenge') {
      return null;
    }
    const summary = dailyCompletionSummary;
    const exact21 =
      summary?.exact21Count ?? dailyExact21Count;
    const fiveCard =
      summary?.fiveCardClearCount ?? dailyFiveCardClearCount;
    const bustTotal = summary?.bustCount ?? busts;
    return [
      {
        label: 'SCORE',
        value: (summary?.score ?? score).toLocaleString(),
        gold: true,
      },
      { label: 'EXACT 21', value: exact21.toLocaleString() },
      { label: 'FIVE CARD CLEARS', value: fiveCard.toLocaleString() },
      { label: 'BUSTS', value: bustTotal.toLocaleString(), danger: bustTotal >= 3 },
    ];
  }, [
    busts,
    dailyCompletionSummary,
    dailyExact21Count,
    dailyFiveCardClearCount,
    gameMode,
    score,
  ]);

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
    if (gameMode === 'asyncDuel') {
      clearAsyncDuelMode();
      navigation.navigate('AsyncDuelHub');
      return;
    }
    if (gameMode === 'dailyChallenge') {
      clearDailyChallengeMode();
      navigation.navigate('DailyChallenge');
      return;
    }
    restartGame();
    navigation.replace('Game');
  };

  const playSolo = () => {
    if (gameMode === 'asyncDuel') {
      clearAsyncDuelMode();
    }
    if (gameMode === 'dailyChallenge') {
      clearDailyChallengeMode();
    }
    navigation.navigate('Game');
  };

  const returnHome = () => {
    if (gameMode === 'asyncDuel') {
      clearAsyncDuelMode();
    }
    if (gameMode === 'dailyChallenge') {
      clearDailyChallengeMode();
    }
    navigation.reset({
      index: 0,
      routes: [{ name: 'Home', params: { fromSoloComplete: true } }],
    });
  };

  const animationKey = matchId ?? `${score}-${gameOverReason ?? 'result'}`;

  const doubleRewardSection = (
    <>
      {(showCoinsPanel || v1_1RewardStatus === 'verified') &&
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
              trackEvent('rewarded_ad_started', {
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
                } else {
                  // Client reported the ad as watched, but the
                  // server-side claim did not grant currency —
                  // never trust the client callback alone.
                  trackEvent('rewarded_ad_verification_failed');
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
    </>
  );

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

        <ThemedVictoryEffect
          trigger={isNewHighScore ? 'newHighScore' : null}
          themeId={resolvedVisualTheme.victoryEffectTheme}
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

          {v1_1LockerOn && (activeProfileFrame === 'flame' || equippedPlayerTitle) ? (
            <View style={styles.cosmeticRow} accessibilityRole="text">
              {activeProfileFrame === 'flame' ? (
                <ProfileFrameBadge variant="flame" initial="P" size={32} />
              ) : null}
              {equippedPlayerTitle ? (
                <PlayerTitleBadge
                  label={getCosmetic(equippedPlayerTitle)?.displayName ?? equippedPlayerTitle}
                />
              ) : null}
            </View>
          ) : null}

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
            rows={dailyStatsRows ?? statsRows}
            highlightedRow={isNewHighScore ? 'HIGH SCORE' : undefined}
            compact
          />

          {gameMode === 'dailyChallenge' &&
          dailyChallengeSession?.attemptType === 'ranked' &&
          dailySubmissionStatus === 'completed' ? (
            <BlazePanel style={styles.dailyMetaPanel}>
              {dailyCompletionSummary?.dailyRank != null ||
              myDailyEntry?.rank != null ? (
                <Text style={styles.dailyMetaLine} accessibilityRole="text">
                  DAILY RANK #
                  {dailyCompletionSummary?.dailyRank ?? myDailyEntry?.rank}
                </Text>
              ) : rankLookupFailed ? (
                <Text style={styles.dailyMetaMuted}>
                  RESULT SAVED — Leaderboard temporarily unavailable.
                </Text>
              ) : null}
              {dailyCompletionSummary?.currentStreak != null ? (
                <Text
                  style={styles.dailyMetaLine}
                  accessibilityLabel={`Daily streak ${dailyCompletionSummary.currentStreak} days`}
                >
                  DAILY STREAK 🔥 {dailyCompletionSummary.currentStreak}
                </Text>
              ) : null}
            </BlazePanel>
          ) : null}

          {v1_1RewardsOn &&
          gameMode === 'solo' &&
          matchId &&
          gameOverReason !== 'quit' ? (
            <BlazePanel style={styles.rewardsPanel}>
              {v1_1RewardStatus === 'syncing' ? (
                <Text style={styles.syncLabel}>SYNCING REWARDS…</Text>
              ) : null}
              {v1_1RewardStatus === 'local' ? (
                <Text style={styles.rewardsNote}>
                  LOCAL MATCH — NO ONLINE REWARDS
                </Text>
              ) : null}
              {v1_1RewardStatus === 'failed' ? (
                <>
                  <Text style={styles.rewardsNote}>
                    REWARD SYNC FAILED — RETRY AVAILABLE
                  </Text>
                  <BlazeButton
                    label="RETRY"
                    variant="ghost"
                    size="sm"
                    onPress={() => {
                      void claimV1_1Reward(matchId);
                    }}
                  />
                </>
              ) : null}
              {v1_1RewardStatus === 'verified' && v1_1Reward ? (
                <>
                  <Text style={styles.syncLabel}>REWARDS VERIFIED</Text>
                  <View style={styles.rewardsRow}>
                    {v1_1Reward.matchCoins > 0 ? (
                      <View style={styles.rewardCell}>
                        <Text style={styles.rewardLabel}>MATCH COMPLETE</Text>
                        <Text style={styles.rewardValue}>
                          +{v1_1Reward.matchCoins.toLocaleString()} Coins
                        </Text>
                      </View>
                    ) : null}
                    {v1_1Reward.firstMatchBonusCoins > 0 ? (
                      <View style={styles.rewardCell}>
                        <Text style={styles.rewardLabel}>
                          FIRST MATCH BONUS
                        </Text>
                        <Text style={styles.rewardValue}>
                          +{v1_1Reward.firstMatchBonusCoins.toLocaleString()}{' '}
                          Coins
                        </Text>
                      </View>
                    ) : null}
                    {v1_1Reward.activeTimeCoins > 0 ? (
                      <View style={styles.rewardCell}>
                        <Text style={styles.rewardLabel}>ACTIVE PLAY</Text>
                        <Text style={styles.rewardValue}>
                          +{v1_1Reward.activeTimeCoins.toLocaleString()} Coins
                        </Text>
                      </View>
                    ) : null}
                    {v1_1Reward.xpGranted > 0 ? (
                      <View style={styles.rewardCell}>
                        <Text style={styles.rewardLabel}>XP</Text>
                        <Text style={styles.rewardValue}>
                          +{v1_1Reward.xpGranted.toLocaleString()} XP
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </>
              ) : null}
              {doubleRewardSection}
              {v1_1RewardStatus === 'verified' ? (
                <RewardedCoinButton placement="results" />
              ) : null}
            </BlazePanel>
          ) : showCoinsPanel || xpSummary ? (
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

              {doubleRewardSection}
            </BlazePanel>
          ) : null}

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
            {gameMode === 'asyncDuel' ? (
              <>
                <BlazeButton
                  label={
                    submissionStatus === 'failed' ? 'RETRY SUBMIT' : 'BACK TO DUELS'
                  }
                  loading={submissionStatus === 'submitting'}
                  onPress={() => {
                    if (submissionStatus === 'failed') {
                      void submitVerifiedMatchIfNeeded();
                      return;
                    }
                    clearAsyncDuelMode();
                    navigation.navigate('AsyncDuelHub');
                  }}
                  accessibilityLabel="Back to Async Duel hub"
                />
                <BlazeButton
                  label="HOME"
                  variant="secondary"
                  onPress={returnHome}
                />
              </>
            ) : gameMode === 'dailyChallenge' &&
            dailyChallengeSession?.attemptType === 'practice' ? (
              <>
                {rankedAttemptScore != null ? (
                  <Text style={styles.challengeCompare}>
                    Your ranked score today: {rankedAttemptScore}
                  </Text>
                ) : null}
                <BlazeButton
                  label="TRY PRACTICE AGAIN"
                  onPress={playAgain}
                  accessibilityLabel="Try practice again"
                />
                <BlazeButton
                  label="RETURN TO CHALLENGE"
                  variant="secondary"
                  onPress={playAgain}
                />
              </>
            ) : gameMode === 'dailyChallenge' ? (
              <>
                {isDailyLeaderboardEnabled() ? (
                  <BlazeButton
                    label="VIEW LEADERBOARD"
                    onPress={() => navigation.navigate('DailyChallengeLeaderboard')}
                    accessibilityLabel="View Daily Blaze leaderboard"
                  />
                ) : null}
                <BlazeButton
                  label="VIEW DAILY CHALLENGE"
                  variant="secondary"
                  onPress={playAgain}
                  accessibilityLabel="View Daily Blaze challenge"
                />
                <BlazeButton
                  label="PLAY SOLO"
                  variant="ghost"
                  onPress={playSolo}
                  accessibilityLabel="Play solo mode"
                />
              </>
            ) : (
              <>
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
              </>
            )}
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

        <StreakMilestoneModal
          visible={milestoneModal != null}
          milestone={milestoneModal ?? 0}
          claiming={claimBusy}
          reduceMotion={reduceMotion}
          onDismiss={() => setMilestoneModal(null)}
          onClaim={() => {
            if (milestoneModal == null) {
              return;
            }
            setClaimBusy(true);
            void claimStreakReward(milestoneModal)
              .then(() => setMilestoneModal(null))
              .catch(() => undefined)
              .finally(() => setClaimBusy(false));
          }}
        />
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
  cosmeticRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
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
  challengeCompare: {
    color: kitColors.text.secondary,
    textAlign: 'center',
    fontSize: 14,
    marginBottom: 4,
  },
  pressed: {
    opacity: 0.88,
  },
  dailyMetaPanel: {
    gap: 4,
    alignItems: 'center',
  },
  dailyMetaLine: {
    color: kitColors.fire.gold,
    fontFamily: kitTypography.families.condensed,
    fontWeight: '700',
    fontSize: 14,
    letterSpacing: 0.6,
  },
  dailyMetaMuted: {
    color: kitColors.text.secondary,
    fontSize: 12,
    textAlign: 'center',
  },
});
