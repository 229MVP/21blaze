import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  AppState,
  type AppStateStatus,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { BlazeButton } from '../components/BlazeButton';
import { PlayingCard } from '../components/Card/PlayingCard';
import { GameFeedbackBanner } from '../components/GameFeedback/GameFeedbackBanner';
import { GameLane } from '../components/GameLane/GameLane';
import { StreakMeter } from '../components/GameHUD/StreakMeter';
import { GameStartCountdown } from '../components/GameTimer/GameStartCountdown';
import { PauseOverlay } from '../components/GameTimer/PauseOverlay';
import { TimerDisplay } from '../components/GameTimer/TimerDisplay';
import { ScreenContainer } from '../components/ScreenContainer';
import {
  APP_NAME,
  FINAL_WARNING_SECONDS,
  LANE_IDS,
  MAX_BUSTS,
} from '../game/constants';
import type { Card } from '../game/types';
import type { GameScreenProps } from '../navigation/navigationTypes';
import { useGameStore } from '../store/useGameStore';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

export function GameScreen({ navigation }: GameScreenProps) {
  const { width } = useWindowDimensions();
  const isCompact = width < 380;

  const status = useGameStore((state) => state.status);
  const score = useGameStore((state) => state.score);
  const multiplier = useGameStore((state) => state.multiplier);
  const busts = useGameStore((state) => state.busts);
  const clearedLanes = useGameStore((state) => state.clearedLanes);
  const highScore = useGameStore((state) => state.highScore);
  const activeCard = useGameStore((state) => state.activeCard);
  const deckLength = useGameStore((state) => state.deck.length);
  const lanes = useGameStore((state) => state.lanes);
  const isProcessingMove = useGameStore((state) => state.isProcessingMove);
  const lastMoveEvent = useGameStore((state) => state.lastMoveEvent);
  const timerStatus = useGameStore((state) => state.timerStatus);
  const timeRemainingSeconds = useGameStore((state) => state.timeRemainingSeconds);
  const startCountdownValue = useGameStore((state) => state.startCountdownValue);
  const gameOverReason = useGameStore((state) => state.gameOverReason);
  const cardsPlayed = useGameStore((state) => state.cardsPlayed);

  const startGame = useGameStore((state) => state.startGame);
  const restartGame = useGameStore((state) => state.restartGame);
  const playCardToLane = useGameStore((state) => state.playCardToLane);
  const clearLastMoveEvent = useGameStore((state) => state.clearLastMoveEvent);
  const updateStartCountdown = useGameStore((state) => state.updateStartCountdown);
  const beginTimedGame = useGameStore((state) => state.beginTimedGame);
  const synchronizeTimer = useGameStore((state) => state.synchronizeTimer);
  const pauseGame = useGameStore((state) => state.pauseGame);
  const resumeGame = useGameStore((state) => state.resumeGame);
  const quitGame = useGameStore((state) => state.quitGame);

  const cardsRemaining = deckLength + (activeCard ? 1 : 0);
  const hasNavigatedToResults = useRef(false);
  const countdownSessionId = useRef(0);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  const previousScore = useRef(score);
  const previousMultiplier = useRef(multiplier);
  const previousBusts = useRef(busts);
  const [scorePulseToken, setScorePulseToken] = useState(0);
  const [multiplierPulseToken, setMultiplierPulseToken] = useState(0);
  const [multiplierFlashDanger, setMultiplierFlashDanger] = useState(false);
  const [bustPulseToken, setBustPulseToken] = useState(0);

  useEffect(() => {
    const current = useGameStore.getState();
    if (current.status !== 'playing' || current.timerStatus === 'ready') {
      startGame();
      countdownSessionId.current += 1;
    }
  }, [startGame]);

  useEffect(() => {
    if (status === 'playing' && timerStatus === 'countdown') {
      hasNavigatedToResults.current = false;
    }
  }, [status, timerStatus]);

  // 3-2-1-BLAZE countdown driven by GameScreen effects (not component timers).
  useEffect(() => {
    if (timerStatus !== 'countdown' || status !== 'playing') {
      return;
    }

    const delayMs = startCountdownValue === 0 ? 550 : 1000;
    const session = countdownSessionId.current;

    const timeoutId = setTimeout(() => {
      if (countdownSessionId.current !== session) {
        return;
      }

      if (startCountdownValue > 0) {
        updateStartCountdown(startCountdownValue - 1);
        return;
      }

      beginTimedGame(Date.now());
    }, delayMs);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [
    beginTimedGame,
    startCountdownValue,
    status,
    timerStatus,
    updateStartCountdown,
  ]);

  // Timestamp-based sync; interval is only a tick, not the source of truth.
  useEffect(() => {
    if (timerStatus !== 'running' || status !== 'playing') {
      return;
    }

    synchronizeTimer(Date.now());
    const intervalId = setInterval(() => {
      synchronizeTimer(Date.now());
    }, 250);

    return () => {
      clearInterval(intervalId);
    };
  }, [status, synchronizeTimer, timerStatus]);

  useEffect(() => {
    const onAppStateChange = (nextState: AppStateStatus) => {
      const wasActive = appStateRef.current === 'active';
      appStateRef.current = nextState;

      if (
        wasActive &&
        nextState !== 'active' &&
        useGameStore.getState().timerStatus === 'running'
      ) {
        pauseGame(Date.now());
      }
    };

    const subscription = AppState.addEventListener('change', onAppStateChange);
    return () => {
      subscription.remove();
    };
  }, [pauseGame]);

  useEffect(() => {
    if (status !== 'finished' || hasNavigatedToResults.current) {
      return;
    }

    if (!gameOverReason || gameOverReason === 'quit') {
      return;
    }

    hasNavigatedToResults.current = true;
    navigation.replace('Results', {
      score,
      highScore,
      clearedLanes,
      busts,
      gameOverReason,
      timeRemainingSeconds,
      cardsPlayed,
    });
  }, [
    busts,
    cardsPlayed,
    clearedLanes,
    gameOverReason,
    highScore,
    navigation,
    score,
    status,
    timeRemainingSeconds,
  ]);

  useEffect(() => {
    if (score > previousScore.current) {
      setScorePulseToken((token) => token + 1);
    }
    previousScore.current = score;
  }, [score]);

  useEffect(() => {
    if (multiplier > previousMultiplier.current) {
      setMultiplierFlashDanger(false);
      setMultiplierPulseToken((token) => token + 1);
    } else if (multiplier < previousMultiplier.current) {
      setMultiplierFlashDanger(true);
      setMultiplierPulseToken((token) => token + 1);
    }
    previousMultiplier.current = multiplier;
  }, [multiplier]);

  useEffect(() => {
    if (busts > previousBusts.current) {
      setBustPulseToken((token) => token + 1);
    }
    previousBusts.current = busts;
  }, [busts]);

  const handleFeedbackFinished = useCallback(() => {
    clearLastMoveEvent();
  }, [clearLastMoveEvent]);

  const confirmRestart = useCallback(() => {
    Alert.alert('Restart Game', 'Start a fresh timed run from 2:00?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Restart',
        style: 'destructive',
        onPress: () => {
          hasNavigatedToResults.current = false;
          countdownSessionId.current += 1;
          restartGame();
        },
      },
    ]);
  }, [restartGame]);

  const confirmQuitToHome = useCallback(() => {
    Alert.alert('Quit Match', 'Leave this timed run and return home?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Quit',
        style: 'destructive',
        onPress: () => {
          quitGame();
          navigation.reset({
            index: 0,
            routes: [{ name: 'Home' }],
          });
        },
      },
    ]);
  }, [navigation, quitGame]);

  const handlePause = () => {
    if (timerStatus === 'running') {
      pauseGame(Date.now());
    }
  };

  const handleResume = () => {
    resumeGame(Date.now());
  };

  const isCountdown = timerStatus === 'countdown';
  const isPaused = timerStatus === 'paused';
  const canPlay =
    status === 'playing' &&
    timerStatus === 'running' &&
    activeCard !== null &&
    !isProcessingMove;
  const showFinalBlaze =
    timerStatus === 'running' && timeRemainingSeconds <= FINAL_WARNING_SECONDS;

  return (
    <ScreenContainer style={styles.screen}>
      <GameFeedbackBanner event={lastMoveEvent} onFinished={handleFeedbackFinished} />

      <View style={styles.header}>
        <Text style={[styles.title, isCompact && styles.titleCompact]}>{APP_NAME}</Text>
      </View>

      <View style={styles.statsRow}>
        <HudStat
          label="SCORE"
          value={String(score)}
          pulseToken={scorePulseToken}
          mode="pulse"
        />
        <HudStat
          label="MULTIPLIER"
          value={`x${multiplier}`}
          pulseToken={multiplierPulseToken}
          mode={multiplierFlashDanger ? 'danger' : 'pulse'}
        />
        <HudStat
          label="BUSTS"
          value={`${busts}/${MAX_BUSTS}`}
          pulseToken={bustPulseToken}
          mode="shake"
        />
        <HudStat label="CARDS" value={String(cardsRemaining)} pulseToken={0} mode="none" />
      </View>

      <View style={styles.timerRow}>
        <TimerDisplay
          seconds={timeRemainingSeconds}
          warningThreshold={FINAL_WARNING_SECONDS}
          isPaused={isPaused}
        />
        <BlazeButton
          title="PAUSE"
          variant="secondary"
          onPress={handlePause}
          disabled={timerStatus !== 'running'}
          style={styles.pauseButton}
        />
      </View>

      {showFinalBlaze ? (
        <Text style={styles.finalBlaze}>FINAL BLAZE</Text>
      ) : null}

      <StreakMeter multiplier={multiplier} />

      <View style={styles.playArea}>
        <View style={styles.activeSection}>
          <Text style={styles.chooseLabel}>Choose a Lane</Text>
          {activeCard ? (
            <ActiveCardStage card={activeCard} compact={isCompact} />
          ) : (
            <View
              style={[
                styles.activePlaceholder,
                isCompact && styles.activePlaceholderCompact,
              ]}
            >
              <Text style={styles.placeholderText}>No card</Text>
            </View>
          )}
        </View>

        <View style={styles.lanesGrid}>
          {LANE_IDS.map((laneId) => {
            const lane = lanes.find((item) => item.id === laneId) ?? {
              id: laneId,
              cards: [],
            };
            const isEventLane = lastMoveEvent?.laneId === laneId;

            return (
              <View key={laneId} style={styles.laneCell}>
                <GameLane
                  lane={lane}
                  disabled={!canPlay}
                  onPress={() => playCardToLane(laneId)}
                  feedbackType={isEventLane ? lastMoveEvent?.type ?? null : null}
                  feedbackEventId={isEventLane ? lastMoveEvent?.id ?? null : null}
                />
              </View>
            );
          })}
        </View>

        <GameStartCountdown value={startCountdownValue} visible={isCountdown} />
        <PauseOverlay
          visible={isPaused}
          onResume={handleResume}
          onRestart={confirmRestart}
          onQuit={confirmQuitToHome}
        />
      </View>

      <View style={styles.actions}>
        <BlazeButton title="RESTART GAME" onPress={confirmRestart} />
        <BlazeButton
          title="RETURN HOME"
          variant="secondary"
          onPress={confirmQuitToHome}
        />
      </View>
    </ScreenContainer>
  );
}

type ActiveCardStageProps = {
  card: Card;
  compact: boolean;
};

function ActiveCardStage({ card, compact }: ActiveCardStageProps) {
  const opacity = useSharedValue(1);
  const scale = useSharedValue(1);

  useEffect(() => {
    opacity.value = 0.35;
    scale.value = 0.94;
    opacity.value = withTiming(1, {
      duration: 160,
      easing: Easing.out(Easing.cubic),
    });
    scale.value = withTiming(1, {
      duration: 160,
      easing: Easing.out(Easing.cubic),
    });
  }, [card.id, opacity, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View key={card.id} style={animatedStyle}>
      <PlayingCard card={card} size={compact ? 'medium' : 'large'} />
    </Animated.View>
  );
}

type HudStatProps = {
  label: string;
  value: string;
  pulseToken: number;
  mode: 'none' | 'pulse' | 'danger' | 'shake';
};

function HudStat({ label, value, pulseToken, mode }: HudStatProps) {
  const scale = useSharedValue(1);
  const shakeX = useSharedValue(0);
  const tone = useSharedValue(0);

  useEffect(() => {
    if (pulseToken <= 0 || mode === 'none') {
      return;
    }

    if (mode === 'shake') {
      shakeX.value = withSequence(
        withTiming(-3, { duration: 35 }),
        withTiming(3, { duration: 35 }),
        withTiming(-2, { duration: 35 }),
        withTiming(0, { duration: 35 }),
      );
      return;
    }

    if (mode === 'danger') {
      tone.value = withSequence(
        withTiming(1, { duration: 90 }),
        withTiming(0, { duration: 260 }),
      );
      scale.value = withSequence(
        withTiming(1.08, { duration: 90 }),
        withTiming(1, { duration: 160 }),
      );
      return;
    }

    scale.value = withSequence(
      withTiming(1.1, { duration: 90 }),
      withTiming(1, { duration: 160 }),
    );
  }, [mode, pulseToken, scale, shakeX, tone]);

  const animatedStyle = useAnimatedStyle(() => {
    const color = interpolateColor(
      tone.value,
      [0, 1],
      [colors.secondary, colors.danger],
    );

    return {
      transform: [{ translateX: shakeX.value }, { scale: scale.value }],
      color,
    };
  });

  return (
    <View style={styles.statCard}>
      <Text style={styles.statLabel}>{label}</Text>
      <Animated.Text style={[styles.statValue, animatedStyle]}>{value}</Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    overflow: 'hidden',
  },
  header: {
    alignItems: 'center',
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },
  title: {
    ...typography.title,
    color: colors.primary,
  },
  titleCompact: {
    fontSize: 24,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  pauseButton: {
    flex: 1,
    minHeight: 48,
  },
  finalBlaze: {
    ...typography.label,
    color: colors.danger,
    textAlign: 'center',
    marginBottom: spacing.sm,
    letterSpacing: 1,
  },
  playArea: {
    flex: 1,
    position: 'relative',
    minHeight: 280,
  },
  statCard: {
    flex: 1,
    minWidth: 0,
    backgroundColor: colors.backgroundSecondary,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: spacing.sm,
    paddingHorizontal: 2,
    alignItems: 'center',
  },
  statLabel: {
    ...typography.label,
    fontSize: 10,
    marginBottom: spacing.xs,
  },
  statValue: {
    ...typography.body,
    fontSize: 14,
    fontWeight: '700',
    color: colors.secondary,
  },
  activeSection: {
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
    minHeight: 140,
  },
  chooseLabel: {
    ...typography.subtitle,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  activePlaceholder: {
    width: 124,
    height: 172,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activePlaceholderCompact: {
    width: 90,
    height: 126,
  },
  placeholderText: {
    ...typography.label,
  },
  lanesGrid: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
    minHeight: 200,
  },
  laneCell: {
    width: '48%',
    flexGrow: 1,
    maxWidth: '100%',
  },
  actions: {
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
});
